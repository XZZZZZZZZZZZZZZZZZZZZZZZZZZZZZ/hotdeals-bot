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

  return crypto
    .createHash("md5")
    .update(baseString)
    .digest("hex")
    .toUpperCase();
}

async function fetchProduct() {
  const timestamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);

  const params = {
    app_key: APP_KEY,
    method: "aliexpress.affiliate.product.query",
    sign_method: "md5",
    timestamp: timestamp,
    format: "json",
    v: "2.0",
    keywords: "gadget",
    fields:
      "product_id,product_title,sale_price,promotion_link,product_main_image_url",
    tracking_id: TRACKING_ID,
    page_size: 5
  };

  params.sign = sign(params);

  const response = await axios.get(
    "https://gw.api.alibaba.com/openapi/param2/2/portals.open/api",
    { params }
  );

  const products =
    response.data?.aliexpress_affiliate_product_query_response?.resp_result
      ?.result?.products?.product;

  if (!products || products.length === 0) {
    console.log("❌ אין מוצרים");
    return null;
  }

  return products[Math.floor(Math.random() * products.length)];
}

async function sendToChat(product) {
  if (!product) return;

  const message = `
🔥 ${product.product_title}
💰 מחיר: ${product.sale_price}
🔗 ${product.promotion_link}
`;

  await axios.post("https://dilim.clickandgo.cfd/send", {
    message: message
  });

  console.log("✅ נשלח לצ'אט");
}

async function runBot() {
  console.log("🚀 בוט רץ...");

  try {
    const product = await fetchProduct();
    await sendToChat(product);
  } catch (err) {
    console.log("❌ שגיאה:", err.response?.data || err.message);
  }
}

setInterval(runBot, 20 * 60 * 1000);
runBot();

app.get("/", (req, res) => {
  res.send("השרת פעיל");
});

app.listen(PORT, () => {
  console.log("שרת פעיל על פורט", PORT);
});
