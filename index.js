const express = require("express");
const axios = require("axios");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 8080;

const APP_KEY = process.env.ALI_APP_KEY;
const APP_SECRET = process.env.ALI_APP_SECRET;
const TRACKING_ID = process.env.ALI_TRACKING_ID;

function createSign(params) {
  const sorted = Object.keys(params).sort();
  let base = APP_SECRET;

  sorted.forEach(key => {
    base += key + params[key];
  });

  base += APP_SECRET;

  return crypto
    .createHash("md5")
    .update(base)
    .digest("hex")
    .toUpperCase();
}

app.get("/", (req, res) => {
  res.send("Server OK");
});

app.get("/api-test", async (req, res) => {
  try {
    const params = {
      method: "aliexpress.affiliate.product.query",
      app_key: APP_KEY,
      sign_method: "md5",
      timestamp: Date.now(),
      format: "json",
      v: "2.0",
      keywords: "iphone",
      page_no: 1,
      page_size: 3,
      tracking_id: TRACKING_ID
    };

    params.sign = createSign(params);

    const response = await axios.post(
      "https://api-sg.aliexpress.com/sync",
      null,
      { params }
    );

    res.json(response.data);

  } catch (err) {
    res.json({ error: err.response?.data || err.message });
  }
});

app.listen(PORT, () => {
  console.log("Server started on port " + PORT);
});
