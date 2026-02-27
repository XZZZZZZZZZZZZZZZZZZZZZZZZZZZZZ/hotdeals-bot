const express = require("express");
const axios = require("axios");
const crypto = require("crypto");

const app = express();

const PORT = process.env.PORT || 8080;

const APP_KEY = process.env.ALI_APP_KEY;
const APP_SECRET = process.env.ALI_APP_SECRET;
const TRACKING_ID = process.env.ALI_TRACKING_ID;

function generateSign(params) {
  const sortedKeys = Object.keys(params).sort();

  let baseString = APP_SECRET;

  sortedKeys.forEach(key => {
    baseString += key + params[key];
  });

  baseString += APP_SECRET;

  return crypto
    .createHash("md5")
    .update(baseString, "utf8")
    .digest("hex")
    .toUpperCase();
}

app.get("/", (req, res) => {
  res.send("🚀 Bot is running");
});

app.get("/test", async (req, res) => {
  try {
    const timestamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);

    const params = {
      method: "aliexpress.affiliate.product.query",
      app_key: APP_KEY,
      sign_method: "md5",
      timestamp: timestamp,
      format: "json",
      v: "2.0",
      keywords: "iphone",
      tracking_id: TRACKING_ID
    };

    params.sign = generateSign(params);

    const response = await axios.get(
      "https://api-sg.aliexpress.com/sync",
      { params }
    );

    console.log("API RESPONSE:", JSON.stringify(response.data, null, 2));

    res.json(response.data);

  } catch (error) {
    console.error(error.response?.data || error.message);
    res.send("API Error");
  }
});

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
