const axios = require("axios");
const crypto = require("crypto");
const express = require("express");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;

const APP_KEY = process.env.ALI_APP_KEY;
const APP_SECRET = process.env.ALI_APP_SECRET;
const TRACKING_ID = process.env.ALI_TRACKING_ID;
const SERVER_URL = process.env.MY_SERVER_URL;

// ===== מילות מפתח =====
const KEYWORDS = [
  "wireless earbuds",
  "smart watch",
  "gaming headset",
  "led lights",
  "bluetooth speaker"
];

// ===== חתימה =====
function createSignature(params) {
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

// ===== שליפת מוצר =====
async function fetchProduct() {
  const keyword = KEYWORDS[Math.floor(Math.random() * KEYWORDS.length)];

  const params = {
    app_key: APP_KEY,
    method: "aliexpress.affiliate.product.query",
    sign_method: "md5",
    timestamp: new Date().toISOString(),
    format: "json",
    keywords: keyword,
    page_no: 1,
    page_size: 1,
    target_currency: "USD",
    target_language: "EN",
    tracking_id: TRACKING_ID
  };

  params.sign = createSignature(params);

  const response = await axios.post(
    "https://api-sg.aliexpress.com/sync",
    null,
    { params }
  );

  return response.data;
}

// ===== שליחה לשרת שלך =====
async function sendToMyServer(message) {
  await axios.post(SERVER_URL, {
    text: message
  });
}

// ===== בוט אוטומטי =====
async function runBot() {
  try {
    console.log("🚀 מחפש מוצר...");

    const data = await fetchProduct();

    const products =
      data?.aliexpress_affiliate_product_query_response?.resp_result?.result
        ?.products?.product;

    if (!products || products.length === 0) {
      console.log("❌ אין מוצרים");
      return;
    }

    const product = products[0];

    const message = `
🔥 ${product.product_title}

💰 Price: ${product.target_sale_price}
⭐ Rating: ${product.evaluate_rate}

🔗 ${product.promotion_link}
`;

    console.log("✅ שולח לשרת שלך");
    await sendToMyServer(message);

  } catch (err) {
    console.error("❌ שגיאה:", err.response?.data || err.message);
  }
}

// ===== כל 20 דקות =====
setInterval(runBot, 20 * 60 * 1000);

// ===== בדיקה ידנית =====
app.get("/test", async (req, res) => {
  await runBot();
  res.send("בוצע ניסיון שליחה");
});

app.listen(PORT, () => {
  console.log("שרת פעיל על פורט", PORT);
});
