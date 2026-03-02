const axios = require("axios");
const crypto = require("crypto");
const cron = require("node-cron");

// ==================
// ENV
// ==================

const APP_KEY = process.env.ALI_APP_KEY;
const APP_SECRET = process.env.ALI_APP_SECRET;
const TRACKING_ID = process.env.ALI_TRACKING_ID;

if (!APP_KEY || !APP_SECRET || !TRACKING_ID) {
  console.log("❌ חסרים מפתחות API");
  process.exit(1);
}

console.log("✅ API נטען");

// ==================
// חתימה
// ==================

function generateSign(params) {
  const sorted = Object.keys(params).sort();
  let base = APP_SECRET;

  sorted.forEach(key => {
    base += key + params[key];
  });

  base += APP_SECRET;

  return crypto.createHash("md5").update(base).digest("hex").toUpperCase();
}

// ==================
// חיפוש
// ==================

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

    console.log("תגובה התקבלה");

    const products =
      response.data?.aliexpress_affiliate_product_query_response
        ?.resp_result?.result?.products?.product;

    if (!products || !products.length) {
      console.log("לא נמצאו מוצרים");
      return;
    }

    // 🔥 סינון לפי 1₪–120₪
    const filtered = products.find(product => {
      const usd = parseFloat(product.app_sale_price || 0);
      const ils = usd * 3.7;
      return ils >= 1 && ils <= 120;
    });

    if (!filtered) {
      console.log("לא נמצא מוצר בטווח 1₪–120₪");
      return;
    }

    const usd = parseFloat(filtered.app_sale_price);
    const ils = (usd * 3.7).toFixed(2);

    console.log("🔥 דיל:");
    console.log(filtered.product_title);
    console.log(ils + " ₪");
    console.log(filtered.product_detail_url);

  } catch (err) {
    console.log("❌ שגיאה:");
    console.log(err.response?.data || err.message);
  }
}

// ==================
// הרצה מיידית
// ==================

fetchDeals();

// ==================
// כל 20 דקות
// ==================

cron.schedule("*/20 * * * *", () => {
  fetchDeals();
});

// ==================
// לשמור תהליך חי
// ==================

setInterval(() => {}, 1000);
