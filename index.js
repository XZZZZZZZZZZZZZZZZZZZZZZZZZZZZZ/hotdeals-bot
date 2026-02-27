const express = require("express");
const axios = require("axios");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 8080;

// ====== משתנים מהסביבה (Railway) ======
const APP_KEY = process.env.ALI_APP_KEY;
const APP_SECRET = process.env.ALI_APP_SECRET;
const TRACKING_ID = process.env.ALI_TRACKING_ID;

// ====== פונקציית חתימה ======
function sign(params) {
  const sortedKeys = Object.keys(params).sort();
  let baseString = APP_SECRET;

  sortedKeys.forEach((key) => {
    baseString += key + params[key];
  });

  baseString += APP_SECRET;

  return crypto
    .createHash("md5")
    .update(baseString)
    .digest("hex")
    .toUpperCase();
}

// ====== חיפוש מוצרים ======
async function fetchProducts() {
  console.log("==== התחלת חיפוש מוצרים ====");

  const params = {
    method: "aliexpress.affiliate.product.query",
    app_key: APP_KEY,
    timestamp: new Date().toISOString().replace("T", " ").substring(0, 19),
    format: "json",
    v: "2.0",
    sign_method: "md5",

    // ===== שדות חובה =====
    tracking_id: TRACKING_ID,
    keywords: "smart watch",   // ← אתה יכול לשנות פה מילת מפתח
    page_no: 1,
    page_size: 10,
    ship_to_country: "IL",
    target_currency: "ILS",
    target_language: "EN",
    fields: "product_id,product_title,sale_price,product_detail_url"
  };

  params.sign = sign(params);

  try {
    const response = await axios.get(
      "https://api-sg.aliexpress.com/sync",
      { params }
    );

    console.log("תגובה מלאה מה-API:");
    console.log(JSON.stringify(response.data, null, 2));

  } catch (err) {
    console.error("שגיאה בקריאה ל-API:");
    console.error(err.response?.data || err.message);
  }
}

// ====== ראוט בדיקה ======
app.get("/", async (req, res) => {
  await fetchProducts();
  res.send("בדיקה נשלחה – תבדוק לוגים");
});

app.listen(PORT, () => {
  console.log("שרת פעיל על פורט", PORT);
});0
