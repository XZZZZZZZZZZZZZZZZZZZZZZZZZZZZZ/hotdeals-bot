const axios = require("axios");
const crypto = require("crypto");
const cron = require("node-cron");

// ==========================
// 🔐 ENV (Railway Variables)
// ==========================

const APP_KEY = process.env.ALI_APP_KEY;
const APP_SECRET = process.env.ALI_APP_SECRET;
const TRACKING_ID = process.env.ALI_TRACKING_ID;

if (!APP_KEY || !APP_SECRET || !TRACKING_ID) {
  console.log("❌ חסרים מפתחות API של AliExpress");
  process.exit(1);
}

// ==========================
// 🎯 ClickAndGo Config
// ==========================

const CHANNEL_API_URL = "https://dilim.clickandgo.cfd/api/import/post";
const CHANNEL_TOKEN = "987654321";

console.log("✅ הכול נטען בהצלחה");

// ==========================
// 🔐 חתימה ל-AliExpress
// ==========================

function generateSign(params) {
  const sorted = Object.keys(params).sort();
  let base = APP_SECRET;

  sorted.forEach(key => {
    base += key + params[key];
  });

  base += APP_SECRET;

  return crypto
    .createHash("md5")
    .update(base)
    .digest("hex")
    .toUpperCase();
}

// ==========================
// 💰 סינון 1₪–120₪
/** דולר לשקל בקירוב **/
const USD_TO_ILS = 3.7;

function isInPriceRange(product) {
  const usd = parseFloat(product.app_sale_price || 0);
  const ils = usd * USD_TO_ILS;
  return ils >= 1 && ils <= 120;
}

// ==========================
// 🚂 שליפת דילים
// ==========================

async function fetchDeals() {
  console.log("🚂 מתחיל חיפוש...");

  const params = {
    app_key: APP_KEY,
    method: "aliexpress.affiliate.product.query",
    timestamp: Date.now(),
    format: "json",
    v: "2.0",
    sign_method: "md5",
    keywords: "smart watch",
    tracking_id: TRACKING_ID
  };

  params.sign = generateSign(params);

  try {
    const response = await axios.get(
      "https://api-sg.aliexpress.com/sync",
      { params }
    );

    const products =
      response.data?.aliexpress_affiliate_product_query_response
        ?.resp_result?.result?.products?.product;

    if (!products || !products.length) {
      console.log("⚠️ לא נמצאו מוצרים");
      return;
    }

    const filtered = products.find(isInPriceRange);

    if (!filtered) {
      console.log("⚠️ אין מוצר בטווח 1₪–120₪");
      return;
    }

    const usd = parseFloat(filtered.app_sale_price);
    const ils = (usd * USD_TO_ILS).toFixed(2);

    const message = {
      text: `🔥 ${filtered.product_title}
💰 ${ils} ₪
🔗 ${filtered.product_detail_url}`,
      author: "Deals Bot",
      timestamp: new Date().toISOString()
    };

    await axios.post(
      CHANNEL_API_URL,
      message,
      {
        headers: {
          Authorization: `Bearer ${CHANNEL_TOKEN}`,
          "Content-Type": "application/json"
        }
      }
    );

    console.log("✅ דיל נשלח בהצלחה לצ'אט");

  } catch (err) {
    console.log("❌ שגיאה:");
    console.log(err.response?.data || err.message);
  }
}

// ==========================
// ▶️ הרצה מיידית
// ==========================

fetchDeals();

// ==========================
// ⏰ כל 20 דקות
// ==========================

cron.schedule("*/20 * * * *", () => {
  fetchDeals();
});

// ==========================
// 🧱 שמירת תהליך חי
// ==========================

setInterval(() => {}, 1000);
