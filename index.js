const express = require("express");
const axios = require("axios");
const crypto = require("crypto");

const app = express();
app.use(express.json());

/* ============================= */
/*      הגדרות כלליות            */
/* ============================= */

const CHAT_ENDPOINT = "https://dilim.clickandgo.cfd/api/import/post";
const CHAT_TOKEN = "987654321";

const ALI_APP_KEY = process.env.ALI_APP_KEY;
const ALI_APP_SECRET = process.env.ALI_APP_SECRET;
const ALI_TRACKING_ID = process.env.ALI_TRACKING_ID;

console.log("APP_KEY:", ALI_APP_KEY ? "קיים" : "חסר");
console.log("APP_SECRET:", ALI_APP_SECRET ? "קיים" : "חסר");
console.log("TRACKING_ID:", ALI_TRACKING_ID ? "קיים" : "חסר");

/* ============================= */
/*        חתימה ל־Ali            */
/* ============================= */

function sign(params) {
  const sortedKeys = Object.keys(params).sort();
  let base = ALI_APP_SECRET;

  sortedKeys.forEach((key) => {
    base += key + params[key];
  });

  base += ALI_APP_SECRET;

  return crypto.createHmac("sha256", ALI_APP_SECRET).update(base).digest("hex").toUpperCase();
}

/* ============================= */
/*      חיפוש מוצרים             */
/* ============================= */

async function searchProducts() {
  try {
    console.log("מחפש מוצרים... 🔎");

    const params = {
      method: "aliexpress.affiliate.product.search",
      app_key: ALI_APP_KEY,
      timestamp: Date.now(),
      format: "json",
      v: "2.0",
      sign_method: "sha256",
      keywords: "home camera",
      fields: "product_title,product_main_image_url,sale_price,product_detail_url"
    };

    params.sign = sign(params);

    const response = await axios.get("https://api-sg.aliexpress.com/sync", {
      params,
    });

    console.log("API RESPONSE:", JSON.stringify(response.data));

    const products =
      response.data?.aliexpress_affiliate_product_search_response?.resp_result?.result?.products;

    if (!products || products.length === 0) {
      console.log("❌ לא נמצאו מוצרים");
      return;
    }

    const product = products[0];

    await sendToChat(product);

  } catch (err) {
    console.log("❌ שגיאת API:");
    console.log(err.response?.data || err.message);
  }
}

/* ============================= */
/*      שליחה לצ'אט              */
/* ============================= */

async function sendToChat(product) {
  const message = `
🔥 דיל חדש!

📦 ${product.product_title}
💰 מחיר: ${product.sale_price}

🔗 קישור:
${product.product_detail_url}
`;

  try {
    await axios.post(
      CHAT_ENDPOINT,
      {
        text: message,
        author: "HotDeals Bot",
        timestamp: new Date().toISOString(),
      },
      {
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": CHAT_TOKEN,
        },
      }
    );

    console.log("✅ נשלח בהצלחה!");
  } catch (err) {
    console.log("❌ שגיאה בשליחה לצ'אט:", err.message);
  }
}

/* ============================= */
/*      בדיקה מידית              */
/* ============================= */

app.get("/force", async (req, res) => {
  await searchProducts();
  res.send("בוצע ניסיון שליחה");
});

/* ============================= */

app.get("/", (req, res) => {
  res.send("HotDeals Bot Running 🚀");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("שרת פועל על פורט", PORT);
});
