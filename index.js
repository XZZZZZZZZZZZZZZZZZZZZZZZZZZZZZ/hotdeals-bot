const axios = require("axios");
const crypto = require("crypto");
const cron = require("node-cron");

// ======================
// 🔐 AliExpress ENV
// ======================

const APP_KEY = process.env.ALI_APP_KEY;
const APP_SECRET = process.env.ALI_APP_SECRET;
const TRACKING_ID = process.env.ALI_TRACKING_ID;

if (!APP_KEY || !APP_SECRET || !TRACKING_ID) {
  console.log("❌ חסרים מפתחות AliExpress");
  process.exit(1);
}

// ======================
// 🎯 ClickAndGo API
// ======================

const CHANNEL_API_URL = "https://dilim.clickandgo.cfd/api/import/post";
const API_KEY = "987654321";

const USD_TO_ILS = 3.7;

console.log("✅ הבוט עלה בהצלחה");

// ======================
// 🔐 חתימה ל-AliExpress
// ======================

function generateSign(params) {
  const sorted = Object.keys(params).sort();
  let base = APP_SECRET;

  sorted.forEach(key => {
    base += key + params[key];
  });

  base += APP_SECRET;

  return crypto.createHash("md5").update(base).digest("hex").toUpperCase();
}

// ======================
// 💰 סינון מחיר 1₪–120₪
// ======================

function isValidPrice(product) {
  const usd = parseFloat(product.app_sale_price || 0);
  const ils = usd * USD_TO_ILS;
  return ils >= 1 && ils <= 120;
}

// ======================
// 🚀 שליחה לצ'אט
// ======================

async function sendToChannel(message) {
  try {
    await axios.post(
      CHANNEL_API_URL,
      message,
      {
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": API_KEY
        }
      }
    );

    console.log("✅ נשלח לצ'אט");

  } catch (error) {
    console.log("❌ שגיאה בשליחה:");
    console.log("Status:", error.response?.status);
    console.log("Response:", error.response?.data || error.message);
  }
}

// ======================
// 🚂 שליפת דיל
// ======================

async function fetchDeal() {
  console.log("🔎 מחפש דיל...");

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
      console.log("⚠️ אין מוצרים");
      return;
    }

    const product = products.find(isValidPrice);

    if (!product) {
      console.log("⚠️ אין מוצר בטווח 1₪–120₪");
      return;
    }

    const usd = parseFloat(product.app_sale_price);
    const ils = (usd * USD_TO_ILS).toFixed(2);

    // 🔥 כאן השינוי היחיד – ניסוח בעברית + תמונה
    const message = {
      text: `🔥 דיל חדש במיוחד!
📦 ${product.product_title}
💰 מחיר: ${ils} ₪
🖼 תמונה: ${product.product_main_image_url}
🔗 קישור לרכישה: ${product.product_detail_url}`,
      author: "Deals Bot",
      timestamp: new Date().toISOString()
    };

    await sendToChannel(message);

  } catch (err) {
    console.log("❌ שגיאת AliExpress:");
    console.log(err.response?.data || err.message);
  }
}

// ======================
// ▶️ הרצה מיידית
// ======================

fetchDeal();

// ======================
// ⏰ כל 20 דקות
// ======================

cron.schedule("*/20 * * * *", () => {
  fetchDeal();
});

// ======================
// 🧱 שמירת תהליך חי
// ======================

setInterval(() => {}, 1000);
