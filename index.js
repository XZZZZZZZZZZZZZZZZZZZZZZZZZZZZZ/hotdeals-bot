const express = require("express");
const axios = require("axios");
const crypto = require("crypto");

const app = express();

const CHAT_ENDPOINT = "https://dilim.clickandgo.cfd/api/import/post";
const CHAT_TOKEN = "987654321";

// משתנים מהשרת
const ALI_APP_KEY = process.env.ALI_APP_KEY;
const ALI_APP_SECRET = process.env.ALI_APP_SECRET;
const ALI_TRACKING_ID = process.env.ALI_TRACKING_ID;

// ===== פונקציית חתימה =====
function sign(params) {
  const sortedKeys = Object.keys(params).sort();
  let baseString = ALI_APP_SECRET;

  sortedKeys.forEach(key => {
    baseString += key + params[key];
  });

  baseString += ALI_APP_SECRET;

  return crypto.createHash("md5").update(baseString).digest("hex").toUpperCase();
}

// ===== חיפוש מוצרים =====
async function fetchProducts() {
  try {
    console.log("=== התחלת בקשת API ===");

    const params = {
      app_key: ALI_APP_KEY,
      method: "aliexpress.affiliate.product.search",
      sign_method: "md5",
      timestamp: new Date().toISOString(),
      format: "json",
      v: "2.0",
      keywords: "smart camera home",
      tracking_id: ALI_TRACKING_ID,
      page_no: 1,
      page_size: 5
    };

    params.sign = sign(params);

    const response = await axios.get("https://api-sg.aliexpress.com/sync", {
      params
    });

    console.log("תגובה מלאה:");
    console.log(JSON.stringify(response.data, null, 2));

    const products =
      response.data?.aliexpress_affiliate_product_search_response
        ?.resp_result?.result?.products;

    if (!products || products.length === 0) {
      console.log("❌ לא נמצאו מוצרים");
      return;
    }

    const product = products[0];

    const message = `
🔥 ${product.product_title}

💰 מחיר: ${product.target_app_sale_price}
⭐ דירוג: ${product.evaluate_rate}

🔗 ${product.promotion_link}
`;

    await axios.post(
      CHAT_ENDPOINT,
      {
        text: message,
        author: "HotDeals Bot",
        timestamp: new Date().toISOString()
      },
      {
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": CHAT_TOKEN
        }
      }
    );

    console.log("✅ נשלח בהצלחה לצ'אט");

  } catch (error) {
    console.log("❌ שגיאה:");
    if (error.response) {
      console.log(JSON.stringify(error.response.data, null, 2));
    } else {
      console.log(error.message);
    }
  }
}

// ===== שרת =====
app.get("/", (req, res) => {
  res.send("HotDeals Bot is running 🚀");
});

// שליחה אוטומטית אחרי 10 שניות
setTimeout(() => {
  fetchProducts();
}, 10000);

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log("שרת פועל על פורט " + PORT);
});
