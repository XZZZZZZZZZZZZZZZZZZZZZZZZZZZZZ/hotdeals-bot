const express = require("express");
const axios = require("axios");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 8080;

/* ===============================
   משתני סביבה
=============================== */

const ALI_APP_KEY = process.env.ALI_APP_KEY;
const ALI_APP_SECRET = process.env.ALI_APP_SECRET;
const ALI_TRACKING_ID = process.env.ALI_TRACKING_ID;

const CHAT_ENDPOINT = "https://dilim.clickandgo.cfd/api/import/post";
const CHAT_TOKEN = process.env.CHAT_TOKEN;

/* ===============================
   פונקציית חתימה
=============================== */

function signParams(params) {
  const sortedKeys = Object.keys(params).sort();
  let baseString = ALI_APP_SECRET;

  sortedKeys.forEach(key => {
    baseString += key + params[key];
  });

  baseString += ALI_APP_SECRET;

  return crypto.createHash("md5").update(baseString).digest("hex").toUpperCase();
}

/* ===============================
   בדיקה שהשרת עובד
=============================== */

app.get("/", (req, res) => {
  res.send("🚀 הבוט מחובר ועובד");
});

/* ===============================
   בדיקת שליחה לבוט
=============================== */

app.get("/send-test", async (req, res) => {
  try {
    await axios.post(CHAT_ENDPOINT, {
      token: CHAT_TOKEN,
      message: "🚀 בדיקה – אם אתה רואה את זה הבוט מחובר!"
    });

    res.send("נשלחה הודעת בדיקה");
  } catch (err) {
    console.log("שגיאת שליחה:", err.message);
    res.send("שגיאה בשליחה");
  }
});

/* ===============================
   חיפוש מוצרים מ-AliExpress
=============================== */

app.get("/search", async (req, res) => {

  if (!ALI_APP_KEY || !ALI_APP_SECRET) {
    return res.send("חסרים APP KEY או SECRET במשתני סביבה");
  }

  try {

    console.log("=== התחלת חיפוש מוצרים ===");

    const timestamp = new Date().toISOString().replace(/[-:]/g, "").split(".")[0];

    const params = {
      app_key: ALI_APP_KEY,
      method: "aliexpress.affiliate.product.query",
      sign_method: "md5",
      timestamp: timestamp,
      format: "json",
      v: "2.0",
      keywords: "wireless camera",
      tracking_id: ALI_TRACKING_ID
    };

    params.sign = signParams(params);

    const response = await axios.get("https://api-sg.aliexpress.com/sync", {
      params
    });

    console.log("תגובה מלאה:", JSON.stringify(response.data));

    const products =
      response.data?.aliexpress_affiliate_product_query_response?.resp_result?.result?.products;

    if (!products || products.length === 0) {
      console.log("לא נמצאו מוצרים");
      return res.send("לא נמצאו מוצרים");
    }

    const product = products[0];

    await axios.post(CHAT_ENDPOINT, {
      token: CHAT_TOKEN,
      message: `🔥 מוצר חדש!\n${product.product_title}\n${product.product_detail_url}`
    });

    res.send("נמצא מוצר ונשלח לבוט");

  } catch (err) {
    console.log("שגיאת API:", err.response?.data || err.message);
    res.send("שגיאה בחיפוש");
  }
});

/* ===============================
   הפעלת השרת
=============================== */

app.listen(PORT, () => {
  console.log("שרת פועל על פורט", PORT);
});
