const express = require("express");
const axios = require("axios");
const crypto = require("crypto");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 8080;

/* משתנים מהשרת */

const APP_KEY = process.env.ALI_APP_KEY;
const APP_SECRET = process.env.ALI_APP_SECRET;
const TRACKING_ID = process.env.ALI_TRACKING_ID;

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const CLICKGO_WEBHOOK = process.env.CLICKGO_WEBHOOK;

/* הגדרות */

const MAX_PRICE_ILS = 200;
const USD_TO_ILS = 3.7;

const KEYWORDS = [
"bluetooth",
"gadget",
"headphones",
"smart watch",
"kitchen",
"phone holder"
];

const SENT_FILE = "sent_products.json";

/* יצירת קובץ כפילויות */

if (!fs.existsSync(SENT_FILE)) {
fs.writeFileSync(SENT_FILE, JSON.stringify([]));
}

function loadSent(){
return JSON.parse(fs.readFileSync(SENT_FILE));
}

function saveSent(list){
fs.writeFileSync(SENT_FILE, JSON.stringify(list));
}

function alreadySent(id){
const sent = loadSent();
return sent.includes(id);
}

function markSent(id){
const sent = loadSent();
sent.push(id);
saveSent(sent);
}

/* timestamp תקין */

function getTimestamp(){

const now = new Date();

const yyyy = now.getFullYear();
const mm = String(now.getMonth()+1).padStart(2,'0');
const dd = String(now.getDate()).padStart(2,'0');

const hh = String(now.getHours()).padStart(2,'0');
const mi = String(now.getMinutes()).padStart(2,'0');
const ss = String(now.getSeconds()).padStart(2,'0');

return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
}

/* חתימה */

function sign(params){

const sorted = Object.keys(params).sort();

let base = APP_SECRET;

sorted.forEach(key=>{
base += key + params[key];
});

base += APP_SECRET;

return crypto
.createHash("sha256")
.update(base)
.digest("hex")
.toUpperCase();

}

/* AI */

async function generateText(title,price,link){

try{

const response = await axios.post(
"https://api.openai.com/v1/chat/completions",
{
model:"gpt-4o-mini",
messages:[
{
role:"system",
content:"כתוב הודעת דיל קצרה בעברית עם אימוג'ים."
},
{
role:"user",
content:`
שם מוצר:
${title}

מחיר:
${price}

קישור:
${link}

כתוב הודעת דיל קצרה בעברית.
אל תשנה את המחיר.
`
}
]
},
{
headers:{
Authorization:`Bearer ${OPENAI_API_KEY}`,
"Content-Type":"application/json"
}
}
);

return response.data.choices[0].message.content;

}catch(e){

return `🔥 דיל חדש

${title}

💰 מחיר: ${price}
🔗 ${link}`;

}

}

/* שליפת מוצר */

async function getProduct(){

const keyword =
KEYWORDS[Math.floor(Math.random()*KEYWORDS.length)];

const timestamp = getTimestamp();

const params={
method:"aliexpress.affiliate.product.query",
app_key:APP_KEY,
timestamp:timestamp,
format:"json",
v:"2.0",
sign_method:"sha256",
keywords:keyword,
page_no:1,
page_size:10,
tracking_id:TRACKING_ID
};

params.sign = sign(params);

const res = await axios.get(
"https://api-sg.aliexpress.com/sync",
{
params,
headers:{
"Content-Type":"application/json"
}
}
);

const data = res.data;

if(data.error_response){
console.log("API ERROR",data.error_response);
return null;
}

const products =
data.aliexpress_affiliate_product_query_response
?.resp_result?.result?.products;

if(!products) return null;

for(let product of products){

const id = product.product_id;

if(alreadySent(id)) continue;

const priceUSD = parseFloat(product.target_sale_price);
const priceILS = priceUSD * USD_TO_ILS;

if(priceILS <= MAX_PRICE_ILS){

markSent(id);
return product;

}

}

return null;

}

/* פרסום */

async function publish(product){

const title = product.product_title;

const priceUSD = parseFloat(product.target_sale_price);
const priceILS = (priceUSD * USD_TO_ILS).toFixed(2);

const link =
product.promotion_link ||
product.product_detail_url;

const image = product.product_main_image_url;

const priceText = `${priceILS}₪`;

const text = await generateText(title,priceText,link);

const message=`${image}

${text}`;

await axios.post(CLICKGO_WEBHOOK,{
text:message
});

console.log("נשלח דיל");

}

/* ריצה */

async function runBot(){

try{

const product = await getProduct();

if(!product){
console.log("לא נמצא מוצר מתאים");
return;
}

await publish(product);

}catch(err){

console.log("שגיאה:",err.message);

}

}

/* שרת */

app.get("/",(req,res)=>{
res.send("bot running");
});

app.get("/run",async(req,res)=>{
await runBot();
res.send("done");
});

/* ריצה מידית */

runBot();

/* כל 20 דקות */

setInterval(()=>{
runBot();
},20*60*1000);

/* הפעלת שרת */

app.listen(PORT,()=>{
console.log("server started");
});
