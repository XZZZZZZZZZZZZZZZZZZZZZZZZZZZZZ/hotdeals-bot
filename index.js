const express = require("express");
const axios = require("axios");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 8080;

// ===== משתנים מהשרת (Railway Variables) =====
const APP_KEY = process.env.ALI_APP_KEY;
const APP_SECRET = process.env.ALI_APP_SECRET;
const TRACKING_ID = process.env.ALI_TRACKING_ID;

// ===== מילות מפתח =====
const KEYWORDS = [
  "phone",
  "gadget",
  "kitchen",
  "electronics"
];

// ===== פונקציית חתימה תקינה ל-AliExpress =====
function sign(params) {
  const sortedKeys = Object.keys(params).sort();
  let baseString = APP_SECRET;

  sortedKeys.forEach(key => {
    baseString += key + params[key];
  });

  baseString += APP_SECRET;

  return crypto
    .createHash("sha256")
    .update(baseString)
    .digest("hex")
    .toUpperCase();
}

// ===== קריאה ל-AliExpress =====
async function fetchProducts() {
  try {
    const keyword =
      KEYWORDS[Math.floor(Math.random() * KEYWORDS.length)];

    const timestamp = new Date()
      .toISOString()
      .replace(/[-:TZ.]/g, "")
      .slice(0, 14);

    const params = {
      method: "aliexpress.affiliate.product.query",
      app_key: APP_KEY,
      timestamp: timestamp,
      format: "json",
      v: "2.0",
      sign_method: "sha256",
      keywords: keyword,
      page_no: 1,
      page_size: 5,
      tracking_id: TRACKING_ID
    };

    params.sign = sign(params);

    console.log("🔎 מחפש מוצרים עבור:", keyword);

    const response = await axios.get(
      "https://api-sg.aliexpress.com/sync",
      { params }
    );

    const data = response.data;

    if (data.error_response) {
      console.log("❌ שגיאת API:");
      console.log(data.error_response);
      return;
    }

    const products =
      data.aliexpress_affiliate_product_query_response
        ?.resp_result?.result?.products;

    if (!products || products.length === 0) {
      console.log("❌ אין מוצרים");
      return;
    }

    const product = products[0];

    console.log("✅ מוצר נמצא:");
    console.log(product.product_title);
    console.log(product.promotion_link);

  } catch (err) {
    console.log("❌ שגיאה כללית:");
    console.log(err.message);
  }
}

// ===== בדיקת שרת =====
app.get("/", (req, res) => {
  res.send("🚀 הבוט מחובר ועובד");
});

// ===== הרצה ידנית =====
app.get("/run", async (req, res) => {
  await fetchProducts();
  res.send("🔄 הופעלה בדיקה");
});

// ===== הרצה אוטומטית כל 20 דקות =====
setInterval(() => {
  console.log("⏰ הרצה אוטומטית...");
  fetchProducts();
}, 20 * 60 * 1000);

// ===== הפעלת שרת =====
app.listen(PORT, () => {
  console.log("🚀 שרת פעיל על פורט", PORT);
});
