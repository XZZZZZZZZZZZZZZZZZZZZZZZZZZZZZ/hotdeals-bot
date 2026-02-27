const express = require("express");
const axios = require("axios");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 8080;

const ALI_APP_KEY = process.env.ALI_APP_KEY;
const ALI_APP_SECRET = process.env.ALI_APP_SECRET;
const ALI_TRACKING_ID = process.env.ALI_TRACKING_ID;

const KEYWORDS = "wireless earbuds";

function getTimestamp() {
  const now = new Date();
  const pad = n => (n < 10 ? "0" + n : n);
  return (
    now.getUTCFullYear() +
    "-" +
    pad(now.getUTCMonth() + 1) +
    "-" +
    pad(now.getUTCDate()) +
    " " +
    pad(now.getUTCHours()) +
    ":" +
    pad(now.getUTCMinutes()) +
    ":" +
    pad(now.getUTCSeconds())
  );
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

async function searchProducts() {
  console.log("==== התחלת חיפוש מוצרים ====");

  const params = {
    method: "aliexpress.affiliate.product.query",
    app_key: ALI_APP_KEY,
    timestamp: getTimestamp(),
    format: "json",
    v: "2.0",
    sign_method: "md5",
    keywords: KEYWORDS,
    tracking_id: ALI_TRACKING_ID
  };

  params.sign = sign(params);

  try {
    const response = await axios.get(
      "https://api-sg.aliexpress.com/sync",
      { params }
    );

    console.log("תגובה מלאה מהAPI:");
    console.log(JSON.stringify(response.data, null, 2));

    const products =
      response.data?.aliexpress_affiliate_product_query_response
        ?.resp_result?.result?.products;

    if (!products || products.length === 0) {
      console.log("❌ לא נמצאו מוצרים");
      return;
    }

    console.log("נמצא מוצר:");
    console.log(products[0].product_title);

  } catch (err) {
    console.log("❌ שגיאת API:");
    console.log(err.response?.data || err.message);
  }
}

app.get("/", (req, res) => {
  res.send("🚀 הבוט מחובר ועובד");
});

app.get("/test", async (req, res) => {
  await searchProducts();
  res.send("בוצעה בדיקה – תראה לוגים");
});

app.listen(PORT, async () => {
  console.log("שרת פועל על פורט", PORT);
  await searchProducts();
});
