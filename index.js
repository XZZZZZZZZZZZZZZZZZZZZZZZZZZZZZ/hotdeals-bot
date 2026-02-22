const express = require("express");
const axios = require("axios");
const crypto = require("crypto");

const app = express();

/* ===========================
   משתנים מהשרת (Railway)
=========================== */

const ALI_APP_KEY = process.env.ALI_APP_KEY;
const ALI_APP_SECRET = process.env.ALI_APP_SECRET;
const ALI_TRACKING_ID = process.env.ALI_TRACKING_ID;

/* ===========================
   הגדרות
=========================== */

const PORT = process.env.PORT || 8080;

// כאן אפשר להוסיף מילות מפתח בעתיד
const KEYWORDS = [
  "security camera",
  "car camera",
  "wireless camera"
];

/* ===========================
   חתימה ל-AliExpress
=========================== */

function sign(params) {
  const sorted = Object.keys(params)
    .sort()
    .map(key => key + params[key])
    .join("");

  const signStr = ALI_APP_SECRET + sorted + ALI_APP_SECRET;

  return crypto
    .createHash("md5")
    .update(signStr)
    .digest("hex")
    .toUpperCase();
}

/* ===========================
   שליפת מוצרים חמים
=========================== */

async function getHotProducts() {
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:T.]/g, "")
    .slice(0, 14);

  const params = {
    method: "aliexpress.affiliate.hotproduct.query",
    app_key: ALI_APP_KEY,
    sign_method: "md5",
    timestamp: timestamp,
    format: "json",
    v: "2.0",
    tracking_id: ALI_TRACKING_ID,
  };

  params.sign = sign(params);

  const response = await axios.get(
    "https://api-sg.aliexpress.com/sync",
    { params }
  );

  return response.data;
}

/* ===========================
   שליחה לצ'אט
=========================== */

async function sendToChat(product) {
  const CHAT_ENDPOINT =
    "https://dilim.clickandgo.cfd/api/import/post";
  const CHAT_TOKEN = "987654321"; // אם צריך לשנות תשנה כאן

  const message = `
🔥 ${product.product_title}

💰 מחיר: $${product.target_app_sale_price}

👉 קישור:
${product.promotion_link}
`;

  await axios.post(
    CHAT_ENDPOINT,
    {
      token: CHAT_TOKEN,
      message: message,
    }
  );
}

/* ===========================
   הפעלת הבוט
=========================== */

async function runBot() {
  console.log("=== התחלת חיפוש מוצרים ===");

  try {
    const data = await getHotProducts();

    const products =
      data?.aliexpress_affiliate_hotproduct_query_response
        ?.resp_result?.result?.products;

    if (!products || products.length === 0) {
      console.log("לא נמצאו מוצרים");
      return;
    }

    const product = products[0];

    console.log("נמצא מוצר:", product.product_title);

    await sendToChat(product);

    console.log("נשלח בהצלחה ✅");

  } catch (err) {
    console.log("שגיאת API ❌");
    console.log(err.response?.data || err.message);
  }
}

/* ===========================
   ראוטים
=========================== */

app.get("/", (req, res) => {
  res.send("הבוט פעיל 🚀");
});

app.get("/force", async (req, res) => {
  await runBot();
  res.send("ניסיון שליחה הופעל");
});

/* ===========================
   הפעלה
=========================== */

app.listen(PORT, () => {
  console.log("שרת פועל על פורט " + PORT);
});
