const axios = require("axios");
const crypto = require("crypto");
const cron = require("node-cron");

// ==========================
// 🔐 Load ENV
// ==========================

const APP_KEY = process.env.ALI_APP_KEY;
const APP_SECRET = process.env.ALI_APP_SECRET;
const TRACKING_ID = process.env.ALI_TRACKING_ID;

if (!APP_KEY || !APP_SECRET || !TRACKING_ID) {
  console.error("❌ Missing API credentials in Railway Variables");
  process.exit(1);
}

console.log("✅ API Keys Loaded");

// ==========================
// ⚙️ SETTINGS
// ==========================

const KEYWORDS = [
  "smart watch",
  "bluetooth earbuds",
  "car accessories",
  "gaming gadgets"
];

let keywordIndex = 0;
let sentProducts = new Set();

// ==========================
// 🔁 Keyword rotation
// ==========================

function getNextKeyword() {
  const word = KEYWORDS[keywordIndex];
  keywordIndex = (keywordIndex + 1) % KEYWORDS.length;
  return word;
}

// ==========================
// 🔐 SIGNATURE GENERATOR
// ==========================

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

// ==========================
// 🔍 FILTER
// ==========================

function isGood(product) {
  const price = parseFloat(product.app_sale_price || 0);
  const rating = parseFloat(product.evaluate_rate || 0);

  return price >= 5 && price <= 80 && rating >= 4.5;
}

// ==========================
// 🚂 FETCH DEALS
// ==========================

async function runDealsBot() {
  try {
    const keyword = getNextKeyword();
    console.log("🔎 Searching:", keyword);

    const params = {
      app_key: APP_KEY,
      method: "aliexpress.affiliate.product.query",
      timestamp: new Date().toISOString(),
      format: "json",
      v: "2.0",
      sign_method: "md5",
      keywords: keyword,
      tracking_id: TRACKING_ID
    };

    params.sign = generateSign(params);

    const response = await axios.get(
      "https://api-sg.aliexpress.com/sync",
      { params }
    );

    const products =
      response.data?.aliexpress_affiliate_product_query_response
        ?.resp_result?.result?.products?.product || [];

    if (!products.length) {
      console.log("⚠️ No products returned");
      return;
    }

    for (const product of products) {
      if (!sentProducts.has(product.product_id) && isGood(product)) {
        sentProducts.add(product.product_id);

        console.log("🚀 NEW DEAL:");
        console.log(product.product_title);
        console.log("💰", product.app_sale_price + "$");
        console.log("🔗", product.product_detail_url);
        console.log("====================================");

        break;
      }
    }

  } catch (err) {
    console.error("❌ API ERROR:");
    console.error(err.response?.data || err.message);
  }
}

// ==========================
// ⏰ RUN EVERY 20 MINUTES
// ==========================

cron.schedule("*/20 * * * *", async () => {
  console.log("🚂 Running Deals Job...");
  await runDealsBot();
});

console.log("🔥 Deals Bot Started");
