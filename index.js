const axios = require("axios");
const crypto = require("crypto");
const express = require("express");

const app = express();
const PORT = process.env.PORT || 8080;

/* ===============================
   כאן אתה מוסיף מילות מפתח בקלות
================================= */

const KEYWORDS = [
  "home security camera",
  "car camera",
  "wireless security camera",
  "dash cam car",
  "indoor security camera"
];

/* =============================== */

const ALI_APP_KEY = process.env.ALI_APP_KEY;
const ALI_APP_SECRET = process.env.ALI_APP_SECRET;
const ALI_TRACKING_ID = process.env.ALI_TRACKING_ID;

/* ========= פונקציות עזר ========= */

function getTimestamp() {
  const now = new Date();
  return now.toISOString().replace(/[-:T]/g, "").split(".")[0];
}

function sign(params) {
  const sortedKeys = Object.keys(params).sort();
  let stringToSign = ALI_APP_SECRET;
  sortedKeys.forEach(key => {
    stringToSign += key + params[key];
  });
  stringToSign += ALI_APP_SECRET;

  return crypto
    .createHash("md5")
    .update(stringToSign)
    .digest("hex")
    .toUpperCase();
}

/* ========= חיפוש מוצר ========= */

async function searchProduct(keyword) {
  const params = {
    method: "aliexpress.affiliate.product.query",
    app_key: ALI_APP_KEY,
    sign_method: "md5",
    timestamp: getTimestamp(),
    format: "json",
    v: "2.0",
    keywords: keyword,
    tracking_id: ALI_TRACKING_ID,
    fields: "product_title,product_main_image_url,sale_price,product_detail_url"
  };

  params.sign = sign(params);

  try {
    const response = await axios.get(
      "https://gw.api.alibaba.com/openapi/param2/2/portals.open/api.listPromotionProduct/" + ALI_APP_KEY,
      { params }
    );

    const products =
      response.data?.result?.products || [];

    if (!products.length) {
      console.log("❌ לא נמצאו מוצרים עבור:", keyword);
      return null;
    }

    return products[Math.floor(Math.random() * products.length)];
  } catch (error) {
    console.log("❌ שגיאת API:", error.response?.data || error.message);
    return null;
  }
}

/* ========= שליחה לבדיקה ========= */

async function run() {
  const randomKeyword =
    KEYWORDS[Math.floor(Math.random() * KEYWORDS.length)];

  console.log("🔍 מחפש לפי:", randomKeyword);

  const product = await searchProduct(randomKeyword);

  if (!product) return;

  console.log("✅ מוצר נמצא:");
  console.log("כותרת:", product.product_title);
  console.log("מחיר:", product.sale_price);
  console.log("תמונה:", product.product_main_image_url);
  console.log("קישור:", product.product_detail_url);
}

/* ========= הפעלה ========= */

app.get("/force", async (req, res) => {
  await run();
  res.send("בוצעה בדיקה – תראה בלוגים");
});

app.listen(PORT, () => {
  console.log("🚀 שרת פעיל על פורט", PORT);
});
