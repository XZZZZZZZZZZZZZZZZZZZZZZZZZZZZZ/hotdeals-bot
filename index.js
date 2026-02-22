const express = require("express");
const axios = require("axios");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 8080;

const APP_KEY = process.env.ALI_APP_KEY;
const APP_SECRET = process.env.ALI_APP_SECRET;
const TRACKING_ID = process.env.ALI_TRACKING_ID;

function sign(params) {
  const sortedKeys = Object.keys(params).sort();
  let baseString = APP_SECRET;

  sortedKeys.forEach(key => {
    baseString += key + params[key];
  });

  baseString += APP_SECRET;

  return crypto.createHash("md5").update(baseString).digest("hex").toUpperCase();
}

app.get("/", async (req, res) => {
  try {
    console.log("=== בדיקת יצירת לינק ===");

    const timestamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);

    const params = {
      app_key: APP_KEY,
      method: "aliexpress.affiliate.link.generate",
      timestamp: timestamp,
      format: "json",
      v: "2.0",
      sign_method: "md5",
      tracking_id: TRACKING_ID,
      promotion_link: "https://www.aliexpress.com/item/1005006142748234.html"
    };

    params.sign = sign(params);

    const response = await axios.get(
      "https://api-sg.aliexpress.com/sync",
      { params }
    );

    console.log("תשובת API:", JSON.stringify(response.data, null, 2));

    res.json(response.data);

  } catch (err) {
    console.log("שגיאה:", err.message);
    res.send("שגיאה בבדיקה");
  }
});

app.listen(PORT, () => {
  console.log("שרת פועל על פורט", PORT);
});
