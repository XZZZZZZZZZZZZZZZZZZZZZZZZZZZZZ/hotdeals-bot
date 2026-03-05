const express = require("express");
const axios = require("axios");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 8080;


/* =========================
   משתנים
========================= */

const APP_KEY = process.env.ALI_APP_KEY;
const APP_SECRET = process.env.ALI_APP_SECRET;
const TRACKING_ID = process.env.ALI_TRACKING_ID;

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const CLICKGO_WEBHOOK = process.env.CLICKGO_WEBHOOK;


/* =========================
   הגדרות מחיר
========================= */

const MAX_PRICE_ILS = 200;
const USD_TO_ILS = 3.7;


/* =========================
   מילות חיפוש
========================= */

const KEYWORDS = [
  "bluetooth",
  "gadget",
  "headphones",
  "smart watch",
  "kitchen",
  "phone holder"
];


/* =========================
   חתימה AliExpress
========================= */

function sign(params) {

  const sorted = Object.keys(params).sort();

  let base = APP_SECRET;

  sorted.forEach(key => {
    base += key + params[key];
  });

  base += APP_SECRET;

  return crypto
    .createHash("sha256")
    .update(base)
    .digest("hex")
    .toUpperCase();

}


/* =========================
   AI כותב תיאור
========================= */

async function generateText(title, price, link) {

  const response = await axios.post(
    "https://api.openai.com/v1/chat/completions",
    {
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "אתה כותב הודעות דילים קצרות ומושכות בעברית."
        },
        {
          role: "user",
          content: `
שם מוצר:
${title}

מחיר:
${price}

קישור:
${link}

תסדר כותרת קצרה ונורמלית בעברית.
תכתוב תיאור קצר 2 שורות.
אל תשנה את המחיר.
החזר הודעה מוכנה לפרסום.
`
        }
      ]
    },
    {
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      }
    }
  );

  return response.data.choices[0].message.content;

}


/* =========================
   משיכת מוצר
========================= */

async function getProduct() {

  const keyword =
    KEYWORDS[Math.floor(Math.random() * KEYWORDS.length)];

  const timestamp = new Date()
    .toISOString()
    .replace(/[-:TZ.]/g, "")
    .slice(0, 14);

  const params = {
    method: "aliexpress.affiliate.product.query",
    app_key: APP_KEY,
    timestamp: timestamp,
    format: "json",
    v: "2.0",
    sign_method: "sha256",
    keywords: keyword,
    page_no: 1,
    page_size: 10,
    tracking_id: TRACKING_ID
  };

  params.sign = sign(params);

  const res = await axios.get(
    "https://api-sg.aliexpress.com/sync",
    { params }
  );

  const data = res.data;

  if (data.error_response) {
    console.log("❌ API error", data.error_response);
    return null;
  }

  const products =
    data.aliexpress_affiliate_product_query_response
      ?.resp_result?.result?.products;

  if (!products) return null;


  /* =========================
     סינון לפי מחיר
  ========================= */

  for (let product of products) {

    const priceUSD = parseFloat(product.target_sale_price);
    const priceILS = priceUSD * USD_TO_ILS;

    if (priceILS <= MAX_PRICE_ILS) {

      console.log("💰 מוצר מתאים:", priceILS, "₪");

      return product;

    }

  }

  console.log("❌ אין מוצר מתחת ל200₪");

  return null;

}


/* =========================
   פרסום
========================= */

async function publishDeal(product) {

  const title = product.product_title;
  const priceUSD = product.target_sale_price;
  const priceILS = (priceUSD * USD_TO_ILS).toFixed(0);

  const link = product.promotion_link;
  const image = product.product_main_image_url;

  const priceText = `${priceILS}₪`;

  const text = await generateText(title, priceText, link);

  const message = `[תמונה](${image})

${text}`;

  await axios.post(CLICKGO_WEBHOOK, {
    text: message
  });

  console.log("✅ נשלח לערוץ");

}


/* =========================
   הרצת הבוט
========================= */

async function runBot() {

  try {

    const product = await getProduct();

    if (!product) return;

    await publishDeal(product);

  } catch (err) {

    console.log("❌ שגיאה:", err.message);

  }

}


/* =========================
   שרת
========================= */

app.get("/", (req, res) => {

  res.send("🤖 bot running");

});


app.get("/run", async (req, res) => {

  await runBot();

  res.send("done");

});


/* =========================
   כל 20 דקות
========================= */

setInterval(() => {

  console.log("⏰ מחפש דיל חדש...");

  runBot();

}, 20 * 60 * 1000);


/* =========================
   הפעלת שרת
========================= */

app.listen(PORT, () => {

  console.log("🚀 server started");

});
