const axios = require("axios");
const crypto = require("crypto");

const APP_KEY = process.env.APP_KEY;
const APP_SECRET = process.env.APP_SECRET;
const TRACKING_ID = process.env.TRACKING_ID;

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

async function testAPI() {
  console.log("🔎 מתחיל בדיקת API נקייה...");

  const params = {
    app_key: APP_KEY,
    method: "aliexpress.affiliate.product.query",
    sign_method: "md5",
    timestamp: Date.now(),
    format: "json",
    v: "2.0",
    tracking_id: TRACKING_ID,
    keywords: "iphone",
    page_no: 1,
    page_size: 3,
    fields: "product_title,promotion_link"
  };

  params.sign = generateSign(params);

  try {
    const response = await axios.post(
      "https://api-sg.aliexpress.com/sync",
      null,
      { params }
    );

    console.log("📦 תגובה מלאה מהשרת:");
    console.log(JSON.stringify(response.data, null, 2));

  } catch (err) {
    console.log("❌ שגיאה:");
    console.log(err.response?.data || err.message);
  }
}

testAPI();
