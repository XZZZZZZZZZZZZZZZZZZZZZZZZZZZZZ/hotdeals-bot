process.env.TZ = "Asia/Jerusalem";

const axios = require("axios");
const crypto = require("crypto");
const cron = require("node-cron");

// ======================
// 🔐 ENV
// ======================

const APP_KEY = process.env.ALI_APP_KEY;
const APP_SECRET = process.env.ALI_APP_SECRET;
const TRACKING_ID = process.env.ALI_TRACKING_ID;

if (!APP_KEY || !APP_SECRET || !TRACKING_ID) {
  console.log("❌ חסרים מפתחות AliExpress");
  process.exit(1);
}

// ======================
// 🎯 ClickAndGo
// ======================

const CHANNEL_API_URL = "https://dilim.clickandgo.cfd/api/import/post";
const API_KEY = "987654321";

console.log("✅ Affiliate Bot Started (IL Mode)");

// ======================
// 🔁 רוטציית מילות מפתח
// ======================

let lastKeyword = null;

function getNextKeyword() {

  const KEYWORDS = [
    "smart watch",
    "bluetooth earbuds",
    "car accessories",
    "gaming gadgets",
    "kitchen tools",
    "phone accessories"
  ];

  let selected;

  do {
    selected = KEYWORDS[Math.floor(Math.random() * KEYWORDS.length)];
  } while (selected === lastKeyword && KEYWORDS.length > 1);

  lastKeyword = selected;
  return selected;
}

// ======================
// 🚫 מניעת כפילויות
// ======================

const sentProducts = new Set();

// ======================
// 🔐 חתימה
// ======================

function generateSign(params) {
  const sorted = Object.keys(params).sort();
  let base = APP_SECRET;

  sorted.forEach(key => {
    base += key + params[key];
  });

  base += APP_SECRET;

  return crypto.createHash("md5")
    .update(base)
    .digest("hex")
    .toUpperCase();
}

// ======================
// 🌍 תרגום
// ======================

async function translateToHebrew(text) {
  try {
    const res = await axios.get(
      "https://translate.googleapis.com/translate_a/single",
      {
        params: {
          client: "gtx",
          sl: "auto",
          tl: "he",
          dt: "t",
          q: text
        }
      }
    );
    return res.data[0].map(t => t[0]).join("");
  } catch {
    return text;
  }
}

// ======================
// 💰 חילוץ מחיר (ILS מה-API)
// ======================

function extractLowestPrice(product) {

  let priceString =
    product.target_app_sale_price ||
    product.app_sale_price ||
    product.original_price ||
    "0";

  if (priceString.includes("-")) {
    const parts = priceString
      .split("-")
      .map(p => parseFloat(p.trim()));
    return Math.min(...parts);
  }

  return parseFloat(priceString);
}

// ======================
// 🔗 יצירת קישור שותפים
// ======================

async function generateAffiliateLink(originalUrl) {

  const params = {
    app_key: APP_KEY,
    method: "aliexpress.affiliate.link.generate",
    timestamp: Date.now(),
    format: "json",
    v: "2.0",
    sign_method: "md5",
    source_values: originalUrl,
    tracking_id: TRACKING_ID,
    promotion_link_type: 0
  };

  params.sign = generateSign(params);

  const response = await axios.get(
    "https://api-sg.aliexpress.com/sync",
    { params }
  );

  return response.data
    ?.aliexpress_affiliate_link_generate_response
    ?.resp_result?.result?.promotion_links?.promotion_link?.[0]
    ?.promotion_link || null;
}

// ======================
// 🧠 טקסט שיווקי משתנה
// ======================

function buildMarketingText(title, price) {

  const intros = [
    `🔥 הגיע הזמן לשדרג – ${title}`,
    `💪 ככה מקצוענים עובדים – ${title}`,
    `⚡ פתרון חכם במיוחד – ${title}`
  ];

  const bullets = [
    "✔ איכות בנייה גבוהה",
    "✔ נוחות שימוש מושלמת",
    "✔ מתאים לבית ולעבודה מקצועית",
    "✔ פתרון שחוסך זמן"
  ];

  const intro = intros[Math.floor(Math.random() * intros.length)];

  return `${intro}

${bullets.join("\n")}

💰 עכשיו רק ב־₪${price}

אל תתפשר על פחות ממצוין.`;
}

// ======================
// 🚀 שליחה לצ'אט
// ======================

async function sendToChannel(message) {

  await axios.post(CHANNEL_API_URL, message, {
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": API_KEY
    }
  });

  console.log("✅ נשלח לצ'אט");
}

// ======================
// 🚂 שליפת דיל
// ======================

async function fetchDeal() {

  console.log("🔎 מחפש דיל...");

  const params = {
    app_key: APP_KEY,
    method: "aliexpress.affiliate.product.query",
    timestamp: Date.now(),
    format: "json",
    v: "2.0",
    sign_method: "md5",
    keywords: getNextKeyword(),
    tracking_id: TRACKING_ID,

    // 🔥 חשוב – אזור ישראל
    ship_to_country: "IL",
    target_currency: "ILS"
  };

  params.sign = generateSign(params);

  try {

    const response = await axios.get(
      "https://api-sg.aliexpress.com/sync",
      { params }
    );

    const products =
      response.data?.aliexpress_affiliate_product_query_response
        ?.resp_result?.result?.products?.product;

    if (!products?.length) return;

    let selectedProduct = null;
    let affiliateLink = null;

    for (const product of products) {

      if (sentProducts.has(product.product_id)) continue;

      const price = extractLowestPrice(product);
      if (!price || price <= 0) continue;

      const link =
        await generateAffiliateLink(product.product_detail_url);

      if (link) {
        selectedProduct = product;
        affiliateLink = link;
        sentProducts.add(product.product_id);
        break;
      }
    }

    if (!selectedProduct || !affiliateLink) return;

    const finalPrice =
      extractLowestPrice(selectedProduct).toFixed(2);

    const translatedTitle =
      await translateToHebrew(selectedProduct.product_title);

    const marketingText =
      buildMarketingText(translatedTitle, finalPrice);

    const message = {
      text: `${selectedProduct.product_main_image_url}

${marketingText}

🛒 להזמנה:
${affiliateLink}`,
      author: "Deals Bot",
      timestamp: new Date().toISOString()
    };

    await sendToChannel(message);

  } catch (err) {
    console.log("❌ שגיאה:");
    console.log(err.response?.data || err.message);
  }
}

// ======================
// ⏰ לוח זמנים
// ======================

cron.schedule("*/20 8-23 * * 0-4", fetchDeal);
cron.schedule("*/20 8-14 * * 5", fetchDeal);
cron.schedule("*/20 22-23 * * 6", fetchDeal);
cron.schedule("*/20 0-1 * * 0", fetchDeal);

fetchDeal();
setInterval(() => {}, 1000);
