const axios = require("axios");
const crypto = require("crypto");

// =============================
// 🔐 פרטי API מה-ENV
// =============================
const APP_KEY = process.env.APP_KEY;
const APP_SECRET = process.env.APP_SECRET;
const TRACKING_ID = process.env.TRACKING_ID;

// =============================
// ⚙️ הגדרות בוט
// =============================

// מילות מפתח (תוכל לשנות חופשי)
const KEYWORDS = [
  "smart watch",
  "bluetooth speaker",
  "wireless earbuds",
  "gaming mouse"
];

// שעות פעילות (לפי שעון ישראל)
const START_HOUR = 9;   // מתחיל ב-09:00
const END_HOUR = 23;    // עד 23:00

// כל כמה זמן לשלוח (בדקות)
const INTERVAL_MINUTES = 20;

// =============================
// 🧠 בדיקת טווח שעות
// =============================
function isWithinActiveHours() {
  const now = new Date();
  const israelHour = new Date(
    now.toLocaleString("en-US", { timeZone: "Asia/Jerusalem" })
  ).getHours();

  return israelHour >= START_HOUR && israelHour < END_HOUR;
}

// =============================
// 🔑 חתימת API
// =============================
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

// =============================
// 📦 קריאת מוצרים לפי מילת מפתח
// =============================
async function fetchProductByKeyword(keyword) {
  const params = {
    app_key: APP_KEY,
    method: "aliexpress.affiliate.product.query",
    sign_method: "md5",
    timestamp: Date.now(),
    format: "json",
    v: "2.0",
    tracking_id: TRACKING_ID,
    keywords: keyword,
    page_no: 1,
    page_size: 5,
    fields: "product_title,promotion_link,app_sale_price"
  };

  params.sign = generateSign(params);

  const response = await axios.post(
    "https://api-sg.aliexpress.com/sync",
    null,
    { params }
  );

  return response.data?.aliexpress_affiliate_product_query_response
    ?.resp_result?.result?.products || [];
}

// =============================
// 🚀 שליחה אוטומטית
// =============================
async function runBot() {
  if (!isWithinActiveHours()) {
    console.log("⏰ מחוץ לשעות פעילות");
    return;
  }

  const randomKeyword =
    KEYWORDS[Math.floor(Math.random() * KEYWORDS.length)];

  console.log("🔎 מחפש לפי:", randomKeyword);

  try {
    const products = await fetchProductByKeyword(randomKeyword);

    if (!products.length) {
      console.log("❌ לא נמצאו מוצרים");
      return;
    }

    const product =
      products[Math.floor(Math.random() * products.length)];

    console.log("🔥 מוצר שנבחר:");
    console.log(product.product_title);
    console.log(product.promotion_link);

    // כאן תכניס את פונקציית השליחה לצ'אט שלך

  } catch (err) {
    console.log("❌ שגיאה:");
    console.log(err.response?.data || err.message);
  }
}

// =============================
// ▶️ הפעלה
// =============================
console.log("🚀 הבוט האוטומטי הופעל");

runBot();
setInterval(runBot, INTERVAL_MINUTES * 60 * 1000);
