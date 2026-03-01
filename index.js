const express = require("express");
const axios = require("axios");
const crypto = require("crypto");

const app = express();

/* ============================= */
/*   קריאת משתנים מ-Railway     */
/* ============================= */

const APP_KEY = process.env.ALI_APP_KEY;
const APP_SECRET = process.env.ALI_APP_SECRET;
const TRACKING_ID = process.env.ALI_TRACKING_ID;

const PORT = process.env.PORT || 8080;

/* ============================= */
/*       מילות מפתח             */
/* ============================= */

const KEYWORDS = [
  "wireless earbuds",
  "gaming headset",
  "smart watch",
  "bluetooth speaker",
  "power bank"
];

/* ============================= */
/*   יצירת חתימה ל-AliExpress    */
/* ============================= */

function createSign(params) {
  const sortedKeys = Object.keys(params).sort();
  let baseString = APP_SECRET;

  sortedKeys.forEach(key => {
    baseString += key + params[key];
  });

  baseString += APP_SECRET;

  return crypto.createHash("md5").update(baseString).digest("hex").toUpperCase();
}

/* ============================= */
/*   שליפת מוצרים מה-API        */
/* ============================= */

async function fetchProducts(keyword) {
  const method = "aliexpress.affiliate.product.query";
  const timestamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);

  const params = {
    method,
    app_key: APP_KEY,
    timestamp,
    format: "json",
    v: "2.0",
    sign_method: "md5",
    keywords: keyword,
    page_size: 5,
    tracking_id: TRACKING_ID
  };

  const sign = createSign(params);
  params.sign = sign;

  const url = "https://api-sg.aliexpress.com/sync";

  const response = await axios.get(url, { params });

  return response.data;
}

/* ============================= */
/*        בדיקת חיבור           */
/* ============================= */

app.get("/", (req, res) => {
  res.send("הבוט מחובר ועובד 🚀");
});

/* ============================= */
/*    בדיקה ידנית של מוצר       */
/* ============================= */

app.get("/test", async (req, res) => {
  try {
    if (!APP_KEY || !APP_SECRET || !TRACKING_ID) {
      return res.json({ error: "חסר משתנה סביבה" });
    }

    const keyword = KEYWORDS[Math.floor(Math.random() * KEYWORDS.length)];

    const data = await fetchProducts(keyword);

    res.json(data);
  } catch (err) {
    res.json({ error: err.response?.data || err.message });
  }
});

/* ============================= */
/*      שליחה כל 20 דקות        */
/* ============================= */

async function autoJob() {
  try {
    const keyword = KEYWORDS[Math.floor(Math.random() * KEYWORDS.length)];
    console.log("מחפש לפי:", keyword);

    const data = await fetchProducts(keyword);

    console.log("תוצאה מה-API:");
    console.log(JSON.stringify(data, null, 2));

  } catch (err) {
    console.log("שגיאה:");
    console.log(err.response?.data || err.message);
  }
}

setInterval(autoJob, 20 * 60 * 1000);

app.listen(PORT, () => {
  console.log("שרת פעיל על פורט", PORT);
});
