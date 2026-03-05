process.env.TZ = "Asia/Jerusalem";

const axios = require("axios");
const crypto = require("crypto");
const cron = require("node-cron");
const fs = require("fs");
const OpenAI = require("openai");

// ======================
// OPENAI
// ======================

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// ======================
// ENV
// ======================

const APP_KEY = process.env.ALI_APP_KEY;
const APP_SECRET = process.env.ALI_APP_SECRET;
const TRACKING_ID = process.env.ALI_TRACKING_ID;

// ======================
// ClickAndGo
// ======================

const CHANNEL_API_URL = "https://dilim.clickandgo.cfd/api/import/post";
const API_KEY = "987654321";

console.log("🚂 Deals Bot Started");

// ======================
// מניעת כפילויות
// ======================

const SENT_FILE = "sent_products.json";

let sentProducts = new Set();

if (fs.existsSync(SENT_FILE)) {
  const data = JSON.parse(fs.readFileSync(SENT_FILE));
  sentProducts = new Set(data);
}

// ======================
// רוטציית מילות מפתח
// ======================

let lastKeyword = null;

function getNextKeyword() {

  const KEYWORDS = [
    "smart watch",
    "bluetooth earbuds",
    "car accessories",
    "gaming gadgets",
    "kitchen gadgets",
    "phone accessories"
  ];

  let selected;

  do {
    selected =
      KEYWORDS[Math.floor(Math.random() * KEYWORDS.length)];
  } while (selected === lastKeyword && KEYWORDS.length > 1);

  lastKeyword = selected;

  return selected;
}

// ======================
// חתימה
// ======================

function generateSign(params) {

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

// ======================
// חילוץ מחיר
// ======================

function extractLowestPrice(product) {

  let priceString =
    product.target_app_sale_price ||
    product.app_sale_price ||
    product.original_price ||
    "0";

  if (priceString.includes("-")) {

    const parts =
      priceString.split("-").map(p => parseFloat(p.trim()));

    return Math.min(...parts);
  }

  return parseFloat(priceString);
}

// ======================
// יצירת קישור שותפים
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
    ?.resp_result?.result
    ?.promotion_links?.promotion_link?.[0]
    ?.promotion_link || null;
}

// ======================
// AI כותרת ותיאור
// ======================

async function generateAITitleAndDescription(title, price) {

  const prompt = `
כתוב הודעת דילים בעברית.

שם מוצר:
${title}

מחיר:
₪${price}

כתוב:
כותרת שיווקית קצרה
ותיאור עם 3-4 יתרונות.

תחזיר JSON בלבד:

{
"title": "",
"description": ""
}
`;

  const completion =
    await openai.chat.completions.create({

      model: "gpt-4o-mini",

      messages: [
        { role: "user", content: prompt }
      ],

      temperature: 0.8
    });

  const text = completion.choices[0].message.content;

  return JSON.parse(text);
}

// ======================
// שליחה לצ'אט
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
// שליפת דיל
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

    ship_to_country: "IL",
    target_currency: "ILS"
  };

  params.sign = generateSign(params);

  try {

    const response =
      await axios.get(
        "https://api-sg.aliexpress.com/sync",
        { params }
      );

    const products =
      response.data
      ?.aliexpress_affiliate_product_query_response
      ?.resp_result?.result?.products?.product;

    if (!products?.length) return;

    let selectedProduct = null;
    let affiliateLink = null;

    for (const product of products) {

      if (sentProducts.has(product.product_id)) continue;

      const price = extractLowestPrice(product);

      // סינון עד 200 שקל
      if (!price || price <= 0 || price > 200) continue;

      const link =
        await generateAffiliateLink(product.product_detail_url);

      if (link) {

        selectedProduct = product;
        affiliateLink = link;

        sentProducts.add(product.product_id);

        fs.writeFileSync(
          SENT_FILE,
          JSON.stringify([...sentProducts])
        );

        break;
      }
    }

    if (!selectedProduct || !affiliateLink) return;

    const finalPrice =
      extractLowestPrice(selectedProduct).toFixed(2);

    const aiText =
      await generateAITitleAndDescription(
        selectedProduct.product_title,
        finalPrice
      );

    const message = {

      text: `${selectedProduct.product_main_image_url}

${aiText.title}

${aiText.description}

💰 ₪${finalPrice}

🛒 להזמנה:
${affiliateLink}`,

      author: "Deals Bot",

      timestamp: new Date().toISOString()
    };

    await sendToChannel(message);

  }

  catch (err) {

    console.log("❌ שגיאה:");

    console.log(err.response?.data || err.message);
  }
}

// ======================
// לוח זמנים
// ======================

cron.schedule("*/20 8-23 * * 0-4", fetchDeal);
cron.schedule("*/20 8-14 * * 5", fetchDeal);
cron.schedule("*/20 22-23 * * 6", fetchDeal);
cron.schedule("*/20 0-1 * * 0", fetchDeal);

fetchDeal();

setInterval(() => {}, 1000);
