process.env.TZ = "Asia/Jerusalem";

const axios = require("axios");
const crypto = require("crypto");
const cron = require("node-cron");
const fs = require("fs");

let openai = null;

if (process.env.OPENAI_API_KEY) {

  const OpenAI = require("openai");

  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });

}

// =================
// AliExpress ENV
// =================

const APP_KEY = process.env.ALI_APP_KEY;
const APP_SECRET = process.env.ALI_APP_SECRET;
const TRACKING_ID = process.env.ALI_TRACKING_ID;

// =================
// ClickAndGo
// =================

const CHANNEL_API_URL =
"https://dilim.clickandgo.cfd/api/import/post";

const API_KEY = "987654321";

console.log("🚂 Deals Bot Started");

// =================
// מניעת כפילויות
// =================

const SENT_FILE = "sent_products.json";

let sentProducts = new Set();

if (fs.existsSync(SENT_FILE)) {

  const data = JSON.parse(
    fs.readFileSync(SENT_FILE)
  );

  sentProducts = new Set(data);
}

// =================
// מילות מפתח
// =================

let lastKeyword = null;

function getNextKeyword() {

  const KEYWORDS = [

    "smart watch",
    "bluetooth earbuds",
    "phone accessories",
    "car accessories",
    "kitchen gadgets",
    "gaming gadgets"

  ];

  let selected;

  do {

    selected =
      KEYWORDS[Math.floor(
        Math.random() * KEYWORDS.length
      )];

  } while (selected === lastKeyword);

  lastKeyword = selected;

  return selected;
}

// =================
// חתימת API
// =================

function generateSign(params) {

  const sorted =
    Object.keys(params).sort();

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

// =================
// מחיר אמיתי
// =================

function extractLowestPrice(product) {

  let priceString =
    product.target_app_sale_price ||
    product.app_sale_price ||
    product.sale_price ||
    product.original_price ||
    "0";

  priceString = priceString.toString();

  if (priceString.includes("-")) {

    priceString =
      priceString.split("-")[0];

  }

  return parseFloat(priceString);
}

// =================
// קישור שותפים
// =================

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

// =================
// AI תיאור
// =================

async function generateMarketingText(title, price) {

  if (!openai) {

    return `🔥 דיל חדש!

${title}

💰 מחיר: ₪${price}`;

  }

  try {

    const prompt = `
כתוב פוסט דילים בעברית בלבד.

אין להשתמש באנגלית.

שם מוצר:
${title}

מחיר:
₪${price}

מבנה:

כותרת עם אימוג'י
תיאור קצר
4 יתרונות עם אימוג'י
משפט מכירה
שורת מחיר
`;

    const completion =
      await openai.chat.completions.create({

        model: "gpt-4o-mini",

        messages: [
          { role: "user", content: prompt }
        ],

        temperature: 0.9

      });

    return completion
      .choices[0]
      .message
      .content;

  }

  catch {

    return `🔥 דיל חדש!

${title}

💰 מחיר: ₪${price}`;
  }
}

// =================
// שליחה לערוץ
// =================

async function sendToChannel(text) {

  await axios.post(

    CHANNEL_API_URL,

    {

      text: text,
      author: "Deals Bot",
      timestamp: new Date().toISOString()

    },

    {

      headers: {

        "Content-Type": "application/json",
        "X-API-Key": API_KEY

      }

    }

  );

  console.log("✅ נשלח לצ'אט");
}

// =================
// חיפוש דיל
// =================

async function fetchDeal() {

  console.log("🔎 מחפש דיל...");

  const params = {

    app_key: APP_KEY,
    method:
    "aliexpress.affiliate.product.query",
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
      ?.resp_result
      ?.result
      ?.products
      ?.product;

    if (!products?.length) return;

    let selectedProduct = null;
    let affiliateLink = null;

    for (const product of products) {

      if (sentProducts.has(
        product.product_id
      )) continue;

      const price =
        extractLowestPrice(product);

      if (!price || price > 200)
      continue;

      const link =
        await generateAffiliateLink(
          product.product_detail_url
        );

      if (link) {

        selectedProduct = product;
        affiliateLink = link;

        sentProducts.add(
          product.product_id
        );

        fs.writeFileSync(

          SENT_FILE,

          JSON.stringify(
            [...sentProducts]
          )

        );

        break;
      }
    }

    if (!selectedProduct
      || !affiliateLink) return;

    const finalPrice =
      extractLowestPrice(
        selectedProduct
      ).toFixed(2);

    const marketingText =
      await generateMarketingText(

        selectedProduct.product_title,
        finalPrice

      );

    const messageText = `![תמונה](${selectedProduct.product_main_image_url})

${marketingText}

🛒 להזמנה:
${affiliateLink}`;

    await sendToChannel(messageText);

  }

  catch (err) {

    console.log("❌ שגיאה:");

    console.log(
      err.response?.data
      || err.message
    );

  }
}

// =================
// מערכת שעות
// =================

cron.schedule(
"*/20 8-23 * * 0-4",
fetchDeal
);

cron.schedule(
"*/20 8-14 * * 5",
fetchDeal
);

cron.schedule(
"*/20 22-23 * * 6",
fetchDeal
);

cron.schedule(
"*/20 0-1 * * 0",
fetchDeal
);

fetchDeal();

setInterval(() => {}, 1000);
