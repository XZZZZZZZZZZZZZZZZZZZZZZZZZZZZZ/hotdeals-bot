const axios = require("axios");
const crypto = require("crypto");

// =========================
// הגדרות
// =========================
const APP_KEY = process.env.APP_KEY;
const APP_SECRET = process.env.APP_SECRET;
const TRACKING_ID = process.env.TRACKING_ID;

const KEYWORDS = [
  "wireless earbuds",
  "gaming keyboard",
  "smart watch",
  "led strip lights",
  "car accessories"
];

// =========================
// יצירת חתימה נכונה
// =========================
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

// =========================
// שליפת מוצרים
// =========================
async function fetchProducts() {
  try {
    const keyword = KEYWORDS[Math.floor(Math.random() * KEYWORDS.length)];

    const params = {
      app_key: APP_KEY,
      method: "aliexpress.affiliate.product.query",
      sign_method: "md5",
      timestamp: Date.now(),
      format: "json",
      v: "2.0",
      keywords: keyword,
      tracking_id: TRACKING_ID,
      page_no: 1,
      page_size: 5
    };

    params.sign = generateSign(params);

    const response = await axios.post(
      "https://api-sg.aliexpress.com/sync",
      null,
      { params }
    );

    const data =
      response.data?.aliexpress_affiliate_product_query_response
        ?.resp_result?.result?.products;

    if (!data || data.length === 0) {
      console.log("❌ לא נמצאו מוצרים");
      return;
    }

    const product = data[0];

    console.log("🔥 מוצר חדש:");
    console.log(product.product_title);
    console.log(product.promotion_link);

  } catch (err) {
    console.log("❌ שגיאה:", err.response?.data || err.message);
  }
}

// =========================
// ריצה כל 20 דקות
// =========================
async function startBot() {
  console.log("🚀 הבוט האוטומטי התחיל");

  await fetchProducts();

  setInterval(async () => {
    await fetchProducts();
  }, 20 * 60 * 1000);
}

startBot();
