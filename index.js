const express = require("express");
const axios = require("axios");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 8080;

const APP_KEY = process.env.ALI_APP_KEY;
const APP_SECRET = process.env.ALI_APP_SECRET;
const TRACKING_ID = process.env.ALI_TRACKING_ID;

// ===== מילות מפתח =====
const KEYWORDS = [
  "iphone",
  "samsung",
  "earbuds",
  "gaming keyboard",
  "smart watch"
];

// ===== פונקציית חתימה תקינה =====
function createSign(params) {
  const sorted = Object.keys(params)
    .sort()
    .map(key => key + params[key])
    .join("");

  const base = APP_SECRET + sorted + APP_SECRET;

  return crypto.createHash("md5").update(base).digest("hex").toUpperCase();
}

// ===== קריאה ל-API =====
async function fetchProducts() {
  try {
    const keyword =
      KEYWORDS[Math.floor(Math.random() * KEYWORDS.length)];

    const timestamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);

    const params = {
      app_key: APP_KEY,
      method: "aliexpress.affiliate.product.query",
      sign_method: "md5",
      timestamp,
      format: "json",
      v: "2.0",
      keywords: keyword,
      tracking_id: TRACKING_ID,
      page_no: 1,
      page_size: 5,
      sort: "SALE_PRICE_ASC"
    };

    const sign = createSign(params);
    params.sign = sign;

    const response = await axios.post(
      "https://api-sg.aliexpress.com/sync",
      null,
      { params }
    );

    console.log("תגובה מלאה:");
    console.log(JSON.stringify(response.data, null, 2));

  } catch (error) {
    console.log("שגיאה:");
    console.log(error.response?.data || error.message);
  }
}

// ===== טיימר כל 20 דקות =====
setInterval(fetchProducts, 20 * 60 * 1000);

// ===== בדיקה ידנית =====
app.get("/test", async (req, res) => {
  await fetchProducts();
  res.send("נשלחה קריאה ל-API");
});

app.listen(PORT, () => {
  console.log("השרת פעיל על פורט", PORT);
});
