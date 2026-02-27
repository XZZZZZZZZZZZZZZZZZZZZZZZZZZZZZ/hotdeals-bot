const axios = require("axios");
const crypto = require("crypto");

const APP_KEY = process.env.APP_KEY;
const APP_SECRET = process.env.APP_SECRET;
const TRACKING_ID = process.env.TRACKING_ID;

function generateSign(params) {
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

async function fetchHotProducts() {
  try {
    const params = {
      app_key: APP_KEY,
      method: "aliexpress.affiliate.hotproduct.query",
      sign_method: "md5",
      timestamp: Date.now(),
      format: "json",
      v: "2.0",
      tracking_id: TRACKING_ID,
      page_no: 1,
      page_size: 5
    };

    params.sign = generateSign(params);

    const response = await axios.post(
      "https://api-sg.aliexpress.com/sync",
      null,
      { params }
    );

    const products =
      response.data?.aliexpress_affiliate_hotproduct_query_response
        ?.resp_result?.result?.products;

    if (!products || products.length === 0) {
      console.log("❌ עדיין אין מוצרים");
      return;
    }

    const product = products[0];

    console.log("🔥 מוצר חם:");
    console.log(product.product_title);
    console.log(product.promotion_link);

  } catch (err) {
    console.log("❌ שגיאה:", err.response?.data || err.message);
  }
}

async function startBot() {
  console.log("🚀 הבוט האוטומטי התחיל");

  await fetchHotProducts();

  setInterval(async () => {
    await fetchHotProducts();
  }, 20 * 60 * 1000);
}

startBot();
