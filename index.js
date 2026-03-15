const express = require('express');
const app = express();
const port = process.env.PORT || 8080;

app.get('/', (req, res) => res.send('Bot is online!'));
app.listen(port, () => console.log(`Listening on port ${port}`));

const whatsapp = require('./whatsapp.js');
process.env.TZ = "Asia/Jerusalem";

const axios = require("axios");
const crypto = require("crypto");
const cron = require("node-cron");
const fs = require("fs");

// --- מנגנון הגנה נגד קריסות (חשוב ל-Koyeb) ---
process.on('unhandledRejection', (reason, promise) => {
  console.log('⚠️ שגיאה שנתפסה בחירום:', reason);
});
// ------------------------------------------

let openai = null;

if (process.env.OPENAI_API_KEY) {
  const OpenAI = require("openai");
  openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

const APP_KEY = process.env.ALI_APP_KEY;
const APP_SECRET = process.env.ALI_APP_SECRET;
const TRACKING_ID = process.env.ALI_TRACKING_ID;

const CHANNEL_API_URL = "https://dilim.clickandgo.cfd/api/import/post";
const API_KEY = "987654321";

// --- תיקון נתיב התיקייה ל-Koyeb כדי שלא תהיה שגיאת הרשאות ---
const DATA_DIR = "./data"; 
if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (e) {
    console.log("Error creating data dir:", e.message);
  }
}
const SENT_FILE = "./data/sent_products.json";
// ----------------------------------------

let sentProducts = new Set();

if (fs.existsSync(SENT_FILE)) {
  try {
    const data = JSON.parse(fs.readFileSync(SENT_FILE));
    sentProducts = new Set(data);
  } catch (e) {
    console.log("Error loading sent products:", e.message);
  }
}

let lastKeyword = null;

function loadKeywords(){
  try{
    const data = JSON.parse(fs.readFileSync("keywords.json"));
    return data.keywords;
  }
  catch{
    return [
      "smart watch",
      "bluetooth earbuds",
      "phone accessories",
      "car accessories",
      "kitchen gadgets",
      "gaming gadgets"
    ];
  }
}

function getNextKeyword(){
  const KEYWORDS = loadKeywords();
  let selected;
  do{
    selected = KEYWORDS[Math.floor(Math.random()*KEYWORDS.length)];
  }while(selected === lastKeyword);
  lastKeyword = selected;
  return selected;
}

function generateSign(params){
  const sorted = Object.keys(params).sort();
  let base = APP_SECRET;
  sorted.forEach(key=>{
    base += key + params[key];
  });
  base += APP_SECRET;
  return crypto
  .createHash("md5")
  .update(base)
  .digest("hex")
  .toUpperCase();
}

function extractLowestPrice(product){
  let price = product.target_app_sale_price;
  if(!price) return 0;
  price = price.toString();
  if(price.includes("-")){
    price = price.split("-")[0];
  }
  return parseFloat(price);
}

async function translateTitle(title){
  try{
    const res = await axios.get(
      "https://translate.googleapis.com/translate_a/single",
      {
        params:{
          client:"gtx",
          sl:"auto",
          tl:"he",
          dt:"t",
          q:title
        },
        timeout: 8000
      }
    );
    return res.data[0][0][0];
  }
  catch{
    return title;
  }
}

async function generateAffiliateLink(originalUrl){
  const params = {
    app_key: APP_KEY,
    method:"aliexpress.affiliate.link.generate",
    timestamp:Date.now(),
    format:"json",
    v:"2.0",
    sign_method:"md5",
    source_values:originalUrl,
    tracking_id:TRACKING_ID,
    promotion_link_type:2
  };

  params.sign = generateSign(params);

  try {
    const response = await axios.get(
      "https://api-sg.aliexpress.com/sync",
      {params, timeout: 8000}
    );
    return response.data
    ?.aliexpress_affiliate_link_generate_response
    ?.resp_result
    ?.result
    ?.promotion_links
    ?.promotion_link?.[0]
    ?.promotion_link || null;
  } catch (err) {
    console.log("Error generating affiliate link:", err.message);
    return null;
  }
}

async function generateMarketingText(title,price){
  if(!openai){
    return `🔥 דיל חדש! 🔥

📦 ${title}

מוצר שימושי במחיר מצוין שכדאי לבדוק.

🚀 יתרונות:
✅ שימושי ונוח
✅ איכות טובה
✅ מתאים לשימוש יומיומי
✅ מחיר משתלם

💰 מחיר: ₪${price}

שווה לבדוק לפני שייגמר!

`;
  }

  try{
    const prompt = `
כתוב פוסט דילים בעברית בסגנון ערוצי דילים גדולים.

מבנה חובה:

🔥 דיל חדש! 🔥

📦 שם המוצר

משפט קצר שמסביר מה המוצר עושה.

🚀 יתרונות:
4 יתרונות קצרים עם האימוג'י ✅

משפט סיום קצר שמעודד קנייה.

בסוף כתוב:

💰 מחיר: ₪${price}

שם המוצר:
${title}
`;

    const completion =
    await openai.chat.completions.create({
      model:"gpt-4o-mini",
      messages:[
        {role:"user",content:prompt}
      ],
      temperature:0.8,
      max_tokens: 300
    });
    return completion.choices[0].message.content;
  }
  catch{
    return `🔥 דיל חדש! 🔥

📦 ${title}

מוצר שימושי במחיר משתלם.

🚀 יתרונות:
✅ איכות טובה
✅ שימוש נוח
✅ מתאים ליום יום
✅ מחיר משתלם

💰 מחיר: ₪${price}

`;
  }
}

async function sendToChannel(text){
  try {
    await axios.post(
      CHANNEL_API_URL,
      {
        text:text,
        author:"Deals Bot",
        timestamp:new Date().toISOString()
      },
      {
        headers:{
          "Content-Type":"application/json",
          "X-API-Key":API_KEY
        },
        timeout: 10000
      }
    );
  } catch (err) {
    console.log("Error sending to channel API:", err.message);
  }
}

async function fetchDeal(){
  console.log("🔍 מחפש דיל חדש...");
  const params = {
    app_key:APP_KEY,
    method:"aliexpress.affiliate.product.query",
    timestamp:Date.now(),
    format:"json",
    v:"2.0",
    sign_method:"md5",
    keywords:getNextKeyword(),
    tracking_id:TRACKING_ID,
    ship_to_country:"IL",
    target_currency:"ILS",
    target_language:"HE",
    sort:"SALE_PRICE_ASC",
    page_size:20,
    page_no: Math.floor(Math.random()*50)+1
  };

  params.sign = generateSign(params);

  try{
    const response =
    await axios.get(
      "https://api-sg.aliexpress.com/sync",
      {params, timeout: 10000}
    );

    const products =
    response.data
    ?.aliexpress_affiliate_product_query_response
    ?.resp_result
    ?.result
    ?.products
    ?.product;

    if(!products?.length) return;

    const priceRanges = [
      {min:5,max:250},
      {min:1,max:270},
      {min:0.5,max:200}
    ];

    let selectedProduct = null;
    let affiliateLink = null;

    for(const product of products){
      if(sentProducts.has(product.product_id))
      continue;

      const price =
      extractLowestPrice(product);

      if(!price) continue;

      let valid = false;

      for(const range of priceRanges){
        if(price >= range.min && price <= range.max){
          valid = true;
          break;
        }
      }

      if(!valid) continue;

      const link =
      await generateAffiliateLink(
        product.product_detail_url
      );

      if(link){
        selectedProduct = product;
        affiliateLink = link;
        sentProducts.add(product.product_id);

        try {
          fs.writeFileSync(
            SENT_FILE,
            JSON.stringify([...sentProducts])
          );
        } catch (e) {
          console.log("Error saving sent file:", e.message);
        }
        break;
      }
    }

    if(!selectedProduct || !affiliateLink)
    return;

    const rawPrice =
    extractLowestPrice(selectedProduct);

    const finalPrice =
    Math.floor(rawPrice * 100) / 100;

    const translatedTitle =
    await translateTitle(selectedProduct.product_title);

    const marketingText =
    await generateMarketingText(translatedTitle,finalPrice);

    const resizedImage =
`https://images.weserv.nl/?w=400&url=${selectedProduct.product_main_image_url.replace("https://","")}`;

    const messageText = `![](${resizedImage})

${marketingText}

🛒 להזמנה:
${affiliateLink}`;

    await sendToChannel(messageText);

    const GROUP_ID = "YOUR_GROUP_ID_HERE@g.us"; 
    if (whatsapp && GROUP_ID !== "YOUR_GROUP_ID_HERE@g.us") {
        try {
            await whatsapp.sendMessage(GROUP_ID, messageText);
            console.log("🚀 נשלח לוואטסאפ בהצלחה!");
        } catch (wErr) {
            console.log("שגיאת וואטסאפ:", wErr.message);
        }
    }

  }
  catch(err){
    console.log("General fetch error:", err.message);
  }
}

cron.schedule("*/20 8-23 * * 0-4", fetchDeal);
cron.schedule("*/20 8-14 * * 5", fetchDeal);
cron.schedule("*/20 22-23 * * 6", fetchDeal);
cron.schedule("*/20 0-1 * * 0", fetchDeal);

// הוצאת ID של קבוצה
whatsapp.on('message', async (msg) => {
    if (msg.body === '!id') {
        const chat = await msg.getChat();
        const id = chat.id._serialized;

        console.log("Group ID:", id);

        await msg.reply(`ה-ID של הקבוצה הוא:\n${id}`);
    }
});
whatsapp.on('ready', () => {
    console.log("✅ הבוט מחובר ומוכן לעבודה!");
    fetchDeal();
});

setInterval(()=>{},1000);
