const express = require("express");
const axios = require("axios");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 8080;

/* ===========================
   משתני סביבה
=========================== */

const APP_KEY = process.env.ALI_APP_KEY;
const APP_SECRET = process.env.ALI_APP_SECRET;
const TRACKING_ID = process.env.ALI_TRACKING_ID;

const CHAT_ENDPOINT = process.env.CHAT_ENDPOINT;
const CHAT_TOKEN = process.env.CHAT_TOKEN;

/* ===========================
   מילות מפתח לשינוי כאן
=========================== */

const KEYWORDS = [
  "wireless earbuds",
  "gaming mouse",
  "bluetooth speaker"
];

/* ===========================
   יצירת חתימה
=========================== */

function generateSign(params) {
  const sortedKeys = Object.keys(params).sort();
  let baseString = APP_SECRET;

  sortedKeys.forEach(key => {
    baseString += key + params[key];
  });

  baseString += APP_SECRET;

  return crypto
    .createHash("md5")
    .update(baseString)
    .digest("hex")
    .toUpperCase();
}

/* ===========================
   חיפוש מוצרים
=========================== */

async function searchProducts() {
  console.log("==== מתחיל חיפוש מוצרים ====");

  const keyword =
    KEYWORDS[Math.floor(Math.random() * KEYWORDS.length)];

  const timestamp = new Date().toISOString().replace("Z", "");

  const params = {
    app_key: APP_KEY,
    method: "aliexpress.affiliate.product.query",
    sign_method: "md5",
    timestamp: timestamp,
    format: "json",
    v: "2.0",
    keywords: keyword,
    tracking_id: TRACKING_ID,
    page_no: 1,
    page_size: 5
  };

  params.sign = generateSign(params);

  try {
    const response = await axios.get(
      "https://api-sg.aliexpress.com/sync",
      { params }
    );

    console.log("תגובה מלאה מה-API:");
    console.log(JSON.stringify(response.data, null, 2));

    const products =
      response.data?.aliexpress_affiliate_product_query_response
        ?.resp_result?.result?.products;

    if (!products || products.length === 0) {
      console.log("❌ לא נמצאו מוצרים");
      return;
    }

    const product = products[0];

    await sendToChat(product, keyword);
  } catch (error) {
    console.log("שגיאת API:");
    console.log(error.response?.data || error.message);
  }
}

/* ===========================
   שליחה לצ'אט
=========================== */

async function sendToChat(product, keyword) {
  const message = `
🔥 דיל חדש!
🔎 חיפוש: ${keyword}

🛍 ${product.product_title}
💰 מחיר: $${product.target_sale_price}
⭐ דירוג: ${product.evaluate_rate || "לא זמין"}

🔗 קישור:
${product.promotion_link}
`;

  try {
    await axios.post(
      CHAT_ENDPOINT,
      {
        token: CHAT_TOKEN,
        message: message
      }
    );

    console.log("✅ נשלח לצ'אט");
  } catch (err) {
    console.log("❌ שגיאה בשליחה לצ'אט");
  }
}

/* ===========================
   בדיקה ידנית
=========================== */

app.get("/test", async (req, res) => {
  await searchProducts();
  res.send("בוצע ניסיון חיפוש ושליחה");
});

/* ===========================
   ריצה אוטומטית כל 20 דקות
=========================== */

setInterval(() => {
  searchProducts();
}, 20 * 60 * 1000);

/* ===========================
   שרת פעיל
=========================== */

app.get("/", (req, res) => {
  res.send("🚀 הבוט מחובר ועובד");
});

app.listen(PORT, () => {
  console.log(`שרת פעיל על פורט ${PORT}`);
});
