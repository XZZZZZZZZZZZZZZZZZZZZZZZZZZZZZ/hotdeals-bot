const express = require("express");
const axios = require("axios");
const crypto = require("crypto");

const app = express();

const CHAT_ENDPOINT = "https://dilim.clickandgo.cfd/api/import/post";
const CHAT_TOKEN = "987654321";

const ALI_APP_KEY = process.env.ALI_APP_KEY;
const ALI_APP_SECRET = process.env.ALI_APP_SECRET;
const ALI_TRACKING_ID = process.env.ALI_TRACKING_ID;

function sign(params) {
  const sortedKeys = Object.keys(params).sort();
  let base = ALI_APP_SECRET;

  sortedKeys.forEach(key => {
    base += key + params[key];
  });

  base += ALI_APP_SECRET;

  return crypto
    .createHash("sha256")
    .update(base)
    .digest("hex")
    .toUpperCase();
}

async function searchAndSend() {
  try {

    const params = {
      method: "aliexpress.affiliate.product.search",
      app_key: ALI_APP_KEY,
      timestamp: new Date().toISOString(),
      format: "json",
      v: "2.0",
      sign_method: "sha256",
      keywords: "security camera",
      tracking_id: ALI_TRACKING_ID,
      target_currency: "USD",
      target_language: "EN",
      page_size: 5,
      fields: "product_title,product_main_image_url,sale_price,product_detail_url"
    };

    params.sign = sign(params);

    const response = await axios.get(
      "https://api-sg.aliexpress.com/sync",
      { params }
    );

    console.log("=== API RESPONSE START ===");
    console.log(JSON.stringify(response.data, null, 2));
    console.log("=== API RESPONSE END ===");

    const products =
      response.data?.aliexpress_affiliate_product_search_response
        ?.resp_result?.result?.products;

    if (!products || products.length === 0) {
      console.log("❌ לא נמצאו מוצרים");
      return;
    }

    const product = products[0];

    const message = `
✨ דיל חם!

📦 ${product.product_title}
💰 ${product.sale_price} $
🔗 ${product.product_detail_url}
`;

    await axios.post(
      CHAT_ENDPOINT,
      {
        text: message,
        author: "HotDeals Bot",
        timestamp: new Date().toISOString()
      },
      {
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": CHAT_TOKEN
        }
      }
    );

    console.log("✅ נשלח בהצלחה");

  } catch (err) {
    console.log("❌ שגיאה:");
    console.log(err.response?.data || err.message);
  }
}

app.get("/", (req, res) => {
  res.send("Bot Running");
});

app.get("/force", async (req, res) => {
  await searchAndSend();
  res.send("בדיקה הופעלה");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("שרת פועל על פורט " + PORT);
});
