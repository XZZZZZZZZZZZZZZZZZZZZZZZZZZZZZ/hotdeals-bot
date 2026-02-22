const express = require("express");
const axios = require("axios");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 8080;

/* =========================
   משתנים מהסביבה
========================= */

const ALI_APP_KEY = process.env.ALI_APP_KEY;
const ALI_APP_SECRET = process.env.ALI_APP_SECRET;
const ALI_TRACKING_ID = process.env.ALI_TRACKING_ID;

/* =========================
   מילות מפתח – כאן אתה עורך
========================= */

const KEYWORDS = [
  "מצלמה לבית",
  "מצלמה לרכב",
  "מנורת לד",
  "גאדגטים לבית"
];

/* =========================
   חתימה ל-AliExpress
========================= */

function generateSign(params) {
  const sortedKeys = Object.keys(params).sort();
  let baseString = "";

  sortedKeys.forEach(key => {
    baseString += key + params[key];
  });

  baseString = ALI_APP_SECRET + baseString + ALI_APP_SECRET;

  return crypto
    .createHash("md5")
    .update(baseString)
    .digest("hex")
    .toUpperCase();
}

/* =========================
   חיפוש מוצרים
========================= */

async function searchProducts(keyword) {
  const timestamp = new Date().toISOString();

  const params = {
    method: "aliexpress.affiliate.product.query",
    app_key: ALI_APP_KEY,
    timestamp,
    format: "json",
    v: "2.0",
    sign_method: "md5",
    keywords: keyword,
    tracking_id: ALI_TRACKING_ID
  };

  params.sign = generateSign(params);

  try {
    const response = await axios.get(
      "https://gw.api.alibaba.com/openapi/param2/2/portals.open/api.sync",
      { params }
    );

    console.log("=== תגובת API ===");
    console.log(JSON.stringify(response.data, null, 2));

    const products =
      response.data?.aliexpress_affiliate_product_query_response?.resp_result?.result?.products;

    if (!products || products.length === 0) {
      console.log("לא נמצאו מוצרים ❌");
      return null;
    }

    return products[0];

  } catch (err) {
    console.log("שגיאת API ❌");
    console.log(err.response?.data || err.message);
    return null;
  }
}

/* =========================
   שליחה לצ'אט שלך
========================= */

async function sendToChat(product) {
  if (!product) return;

  const message = `
🔥 דיל חם במיוחד!

🛒 ${product.product_title}

💰 מחיר: ${product.target_sale_price}$
⭐ דירוג: ${product.evaluate_rate}

👉 קישור:
${product.promotion_link}

`;

  await axios.post(
    "https://dilim.clickandgo.cfd/api/import/post",
    {
      text: message,
      author: "HotDeals Bot",
      timestamp: new Date().toISOString()
    },
    {
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": "987654321"
      }
    }
  );

  console.log("נשלח לצ'אט בהצלחה ✅");
}

/* =========================
   בדיקה ידנית
========================= */

app.get("/test", async (req, res) => {
  console.log("=== התחלת בדיקה ===");

  const randomKeyword =
    KEYWORDS[Math.floor(Math.random() * KEYWORDS.length)];

  console.log("מחפש לפי:", randomKeyword);

  const product = await searchProducts(randomKeyword);

  if (!product) {
    return res.send("לא נמצאו מוצרים ❌");
  }

  await sendToChat(product);

  res.send("נשלח בהצלחה 🚀");
});

app.listen(PORT, () => {
  console.log("שרת פועל על פורט", PORT);
});
