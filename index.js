const express = require("express");
const axios = require("axios");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 8080;

/* =============================
   משתני סביבה
============================= */

const ALI_APP_KEY = process.env.ALI_APP_KEY;
const ALI_APP_SECRET = process.env.ALI_APP_SECRET;
const ALI_TRACKING_ID = process.env.ALI_TRACKING_ID;

/* =============================
   פונקציית חתימה תקינה ל-AliExpress
============================= */

function generateSign(params) {
  const sortedKeys = Object.keys(params).sort();

  let baseString = ALI_APP_SECRET;

  sortedKeys.forEach(key => {
    if (params[key] !== undefined && params[key] !== null) {
      baseString += key + params[key];
    }
  });

  baseString += ALI_APP_SECRET;

  return crypto
    .createHash("md5")
    .update(baseString)
    .digest("hex")
    .toUpperCase();
}

/* =============================
   חיפוש מוצרים
============================= */

async function searchProducts() {
  try {
    console.log("=== התחלת חיפוש מוצרים ===");

    const timestamp = new Date().toISOString();

    const params = {
      app_key: ALI_APP_KEY,
      method: "aliexpress.affiliate.product.query",
      sign_method: "md5",
      timestamp: timestamp,
      format: "json",
      v: "2.0",
      keywords: "smart watch",   // ← מילות מפתח כאן
      page_no: 1,
      page_size: 5,
      tracking_id: ALI_TRACKING_ID
    };

    params.sign = generateSign(params);

    const response = await axios.get(
      "https://api-sg.aliexpress.com/sync",
      { params }
    );

    console.log("תגובה מלאה מה-API:");
    console.log(JSON.stringify(response.data, null, 2));

    const products =
      response.data?.aliexpress_affiliate_product_query_response
        ?.resp_result?.result?.products;

    if (!products || products.length === 0) {
      console.log("❌ לא נמצאו מוצרים");
      return [];
    }

    console.log("✅ נמצאו מוצרים:", products.length);
    return products;

  } catch (error) {
    console.log("❌ שגיאה מה-API:");
    console.log(error.response?.data || error.message);
    return [];
  }
}

/* =============================
   ראוטים
============================= */

app.get("/", (req, res) => {
  res.send("🚀 הבוט מחובר ועובד");
});

app.get("/test", async (req, res) => {
  const products = await searchProducts();
  res.json(products);
});

/* =============================
   הפעלה
============================= */

app.listen(PORT, () => {
  console.log("שרת פעיל על פורט " + PORT);
});
