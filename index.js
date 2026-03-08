process.env.TZ = "Asia/Jerusalem";

const axios = require("axios");
const crypto = require("crypto");
const cron = require("node-cron");
const fs = require("fs");

let openai = null;

try{
  if(process.env.OPENAI_API_KEY){
    const OpenAI = require("openai");
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
}catch(e){
  console.log("OpenAI לא זמין");
}

const APP_KEY = process.env.ALI_APP_KEY;
const APP_SECRET = process.env.ALI_APP_SECRET;
const TRACKING_ID = process.env.ALI_TRACKING_ID;

const CHANNEL_API_URL =
"https://dilim.clickandgo.cfd/api/import/post";

const API_KEY = "987654321";

const SENT_FILE = "sent_products.json";

let sentProducts = new Set();

if (fs.existsSync(SENT_FILE)) {
  const data = JSON.parse(fs.readFileSync(SENT_FILE));
  sentProducts = new Set(data);
}

let lastKeyword = null;
let postCounter = 0;

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
    selected =
    KEYWORDS[Math.floor(Math.random()*KEYWORDS.length)];
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
        }
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

  const response =
  await axios.get(
    "https://api-sg.aliexpress.com/sync",
    {params}
  );

  return response.data
  ?.aliexpress_affiliate_link_generate_response
  ?.resp_result
  ?.result
  ?.promotion_links
  ?.promotion_link?.[0]
  ?.promotion_link || null;

}

async function generateMarketingText(title,price){

  if(!openai){

    return `🔥 דיל חדש!

${title}

💰 מחיר: ₪${price}

🛒 שווה לבדוק!`;

  }

  try{

    const prompt = `
כתוב פוסט דיל בעברית.

אסור להמציא מוצר אחר.
התיאור חייב להיות תואם לשם המוצר בלבד.

שם המוצר:
${title}

מבנה:

שם מוצר עם אימוג'י
משפט קצר

🚀 יתרונות:
3-4 יתרונות

משפט סיום קצר.

בסוף כתוב:

💥 המחיר: ₪${price} בלבד! 💥
`;

    const completion =
    await openai.chat.completions.create({

      model:"gpt-4o-mini",

      messages:[
        {role:"user",content:prompt}
      ],

      temperature:0.9

    });

    return completion.choices[0].message.content;

  }

  catch{

    return `🔥 דיל חדש!

${title}

💰 מחיר: ₪${price}`;

  }

}

async function sendToChannel(text){

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
      }
    }

  );

}

async function fetchDeal(){

  postCounter++;

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

    page_size:50,
    page_no: Math.floor(Math.random()*20)+1

  };

  params.sign = generateSign(params);

  try{

    const response =
    await axios.get(
      "https://api-sg.aliexpress.com/sync",
      {params}
    );

    const products =
    response.data
    ?.aliexpress_affiliate_product_query_response
    ?.resp_result
    ?.result
    ?.products
    ?.product;

    if(!products?.length) return;

    let minPrice = 10;
    let maxPrice = 200;

    if(postCounter % 5 === 0){
      maxPrice = 300;
    }

    let selectedProduct = null;
    let affiliateLink = null;

    for(const product of products){

      if(!product.product_id || !product.product_detail_url || !product.product_main_image_url)
      continue;

      if(sentProducts.has(product.product_id))
      continue;

      const price =
      extractLowestPrice(product);

      if(!price || price < minPrice || price > maxPrice)
      continue;

      const link =
      await generateAffiliateLink(
        product.product_detail_url
      );

      if(link){

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

  }

  catch(err){

    console.log(err.response?.data || err.message);

  }

}

cron.schedule("*/20 8-23 * * 0-4", fetchDeal);
cron.schedule("*/20 8-14 * * 5", fetchDeal);
cron.schedule("*/20 22-23 * * 6", fetchDeal);
cron.schedule("*/20 0-1 * * 0", fetchDeal);

fetchDeal();

setInterval(()=>{},1000);
