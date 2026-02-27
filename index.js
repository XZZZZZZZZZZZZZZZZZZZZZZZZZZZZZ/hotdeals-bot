const express = require("express");
const axios = require("axios");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 8080;

const APP_KEY = process.env.ALI_APP_KEY;
const APP_SECRET = process.env.ALI_APP_SECRET;
const TRACKING_ID = process.env.ALI_TRACKING_ID;

// דף בית
app.get("/", (req, res) => {
  res.send("🚀 הבוט עובד ומחובר");
});

// חיפוש מוצרים
app.get("/search", async (req, res) => {
  console.log("=== התחלת חיפוש מוצרים ===");

  try {
    const keywords = req.query.search || "smart watch";

    const params = {
      app_key: APP_KEY,
      method: "aliexpress.affiliate.product.query",
      sign_method: "sha256",
      timestamp: new Date().toISOString(),
      format: "json",
      v: "2.0",
      keywords: keywords,
      tracking_id: TRACKING_ID,
      page_size: 5
    };

    const sortedKeys = Object.keys(params).sort();
    let signString = APP_SECRET;
    sortedKeys.forEach(key => {
      signString += key + params[key];
    });
    signString += APP_SECRET;

    const sign = crypto
      .createHash("sha256")
      .update(signString)
      .digest("hex")
      .toUpperCase();

    params.sign = sign;

    const response = await axios.get(
      "https://api-sg.aliexpress.com/sync",
      { params }
    );

    console.log("תשובת API מלאה:");
    console.log(JSON.stringify(response.data, null, 2));

    res.json(response.data);

  } catch (error) {
    console.log("שגיאה:");
    console.log(error.response?.data || error.message);
    res.status(500).send("שגיאה בקריאה ל-API");
  }
});

app.listen(PORT, () => {
  console.log("שרת פועל על פורט " + PORT);
});
