const express = require("express");
const axios = require("axios");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 8080;

// ===============================
// 🔑 משתני API (Railway Variables)
// ===============================
const APP_KEY = process.env.ALI_APP_KEY;
const APP_SECRET = process.env.ALI_APP_SECRET;
const TRACKING_ID = process.env.ALI_TRACKING_ID;

// ===============================
// 🧠 מילות מפתח קבועות
// תוסיף פה מה שאתה רוצה
// ===============================
const KEYWORDS = [
  "camera",
  "security camera",
  "dash cam",
  "wireless earbuds",
  "bluetooth speaker",
  "led light",
  "phone case",
  "smart watch"
];

// ===============================
// חתימה
// ===============================
function sign(params) {
  const sortedKeys = Object.keys(params).sort();
  let baseString = APP_SECRET;

  sortedKeys.forEach(key => {
    baseString += key + params[key];
  });

  baseString += APP_SECRET;

  return crypto
    .createHash("md5")
    .update(baseString, "utf8")
    .digest("hex")
    .toUpperCase();
}

// ===============================
// בדיקה ראשית
// ===============================
app.get("/", (req, res) => {
  res.send("🚀 הבוט מחובר ועובד");
});

// ===============================
// חיפוש מוצרים
// ===============================
app.get("/search", async (req, res) => {
  try {
    const keyword =
      req.query.kw ||
      KEYWORDS[Math.floor(Math.random() * KEYWORDS.length)];

    console.log("🔍 מחפש:", keyword);

    const params = {
      app_key: APP_KEY,
      method: "aliexpress.affiliate.product.query",
      timestamp: new Date().toISOString(),
      format: "json",
      v: "2.0",
      sign_method: "md5",
      keywords: keyword,
      tracking_id: TRACKING_ID,
      page_size: 5
    };

    params.sign = sign(params);

    const response = await axios.get(
      "https://api-sg.aliexpress.com/sync",
      { params }
    );

    const products =
      response.data?.aliexpress_affiliate_product_query_response
        ?.resp_result?.result?.products;

    if (!products || products.length === 0) {
      return res.send("❌ לא נמצאו מוצרים");
    }

    let output = `🔎 תוצאות עבור: ${keyword}\n\n`;

    products.forEach(p => {
      output += `🛍 ${p.product_title}\n`;
      output += `💰 ${p.target_sale_price}\n`;
      output += `🔗 ${p.promotion_link}\n\n`;
    });

    res.send(output);

  } catch (error) {
    console.log("❌ שגיאה:", error.response?.data || error.message);
    res.send("❌ שגיאת API");
  }
});

// ===============================
app.listen(PORT, () => {
  console.log("שרת פועל על פורט", PORT);
});
