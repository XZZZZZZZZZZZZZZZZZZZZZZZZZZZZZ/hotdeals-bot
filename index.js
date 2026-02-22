const express = require("express");
const axios = require("axios");
const crypto = require("crypto");

const app = express();

const PORT = process.env.PORT || 8080;

const ALI_APP_KEY = process.env.ALI_APP_KEY;
const ALI_APP_SECRET = process.env.ALI_APP_SECRET;
const ALI_TRACKING_ID = process.env.ALI_TRACKING_ID;

const CHAT_ENDPOINT = process.env.CHAT_ENDPOINT;
const CHAT_TOKEN = process.env.CHAT_TOKEN;

// =====================
// 🔑 מילות מפתח לחיפוש
// =====================
const KEYWORDS = [
  "wireless camera",
  "car camera",
  "security camera",
];

// =====================
// חתימה ל־AliExpress
// =====================
function sign(params) {
  const sorted = Object.keys(params).sort();
  let baseString = ALI_APP_SECRET;

  sorted.forEach(key => {
    baseString += key + params[key];
  });

  baseString += ALI_APP_SECRET;

  return crypto
    .createHash("md5")
    .update(baseString)
    .digest("hex")
    .toUpperCase();
}

// =====================
// חיפוש מוצר
// =====================
async function searchProduct(keyword) {
  const timestamp = new Date().toISOString().replace(/[-:T.]/g, "").slice(0, 14);

  const params = {
    method: "aliexpress.affiliate.product.query",
    app_key: ALI_APP_KEY,
    sign_method: "md5",
    timestamp: timestamp,
    format: "json",
    v: "2.0",
    keywords: keyword,
    tracking_id: ALI_TRACKING_ID,
  };

  params.sign = sign(params);

  const response = await axios.get("https://api-sg.aliexpress.com/sync", {
    params,
  });

  return response.data;
}

// =====================
// שליחה לצ'אט
// =====================
async function sendToChat(text) {
  await axios.post(
    CHAT_ENDPOINT,
    {
      token: CHAT_TOKEN,
      message: text,
    },
    {
      headers: { "Content-Type": "application/json" },
    }
  );
}

// =====================
// חיפוש ושליחה
// =====================
async function runBot() {
  console.log("=== התחלת חיפוש מוצרים ===");

  for (let keyword of KEYWORDS) {
    try {
      const data = await searchProduct(keyword);

      const products =
        data?.aliexpress_affiliate_product_query_response?.resp_result
          ?.result?.products;

      if (products && products.length > 0) {
        const product = products[0];

        const message = `
🔥 דיל חדש!

📦 ${product.product_title}
💰 מחיר: ${product.target_sale_price}
🔗 ${product.promotion_link}
        `;

        await sendToChat(message);

        console.log("נשלח מוצר:", keyword);
        return;
      }
    } catch (err) {
      console.log("שגיאה במילת מפתח:", keyword);
    }
  }

  console.log("לא נמצאו מוצרים");
}

// =====================
// בדיקת דפדפן
// =====================
app.get("/", (req, res) => {
  res.send("הבוט עובד תקין 🚀");
});

// =====================
// שליחה ידנית לבדיקה
// =====================
app.get("/force", async (req, res) => {
  await runBot();
  res.send("ניסיון שליחה בוצע");
});

// =====================

app.listen(PORT, () => {
  console.log("שרת פועל על פורט", PORT);
});
