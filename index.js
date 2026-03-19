const express = require('express');
const app = express();
const port = process.env.PORT || 8080;

// --- מערכת 1: שרת אירוח (Keep-Alive) ---
app.get('/', (req, res) => res.send('Bot Status: Online and Active'));
app.listen(port, () => console.log(`[System] Server is running on port ${port}`));

// --- מערכת 2: הגדרות ליבה וספריות ---
const { Client, LocalAuth } = require('whatsapp-web.js'); // תיקון: ייבוא ישיר של הספרייה

// תיקון קריטי: הגדרות Puppeteer למניעת שגיאת detached Frame וקריסות בשרת
const whatsapp = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--no-zygote',
            '--single-process'
        ],
        protocolTimeout: 60000 // תיקון: מונע ניתוק בזמן שליחת הודעות כבדות
    }
});

whatsapp.initialize(); // הפעלת הלקוח

process.env.TZ = "Asia/Jerusalem"; // הגדרת זמן ישראל

const axios = require("axios");
const crypto = require("crypto");
const cron = require("node-cron");
const fs = require("fs");

// טיפול בשגיאות גלובלי למניעת קריסת הבוט
process.on('unhandledRejection', (reason, promise) => {
    console.log('⚠️ שגיאה קריטית שנתפסה במערכת:', reason);
});

let whatsappReady = false;

// --- מערכת 3: זיהוי קבוצה (ID) ---
let targetGroupId = "120363407216029255@g.us"; 

// --- מערכת 4: בינה מלאכותית (OpenAI) ---
let openai = null;
if (process.env.OPENAI_API_KEY) {
    const OpenAI = require("openai");
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

// מפתחות אפיליאייט ו-API
const APP_KEY = process.env.ALI_APP_KEY;
const APP_SECRET = process.env.ALI_APP_SECRET;
const TRACKING_ID = process.env.ALI_TRACKING_ID;
const CHANNEL_API_URL = "https://dilim.clickandgo.cfd/api/import/post";
const API_KEY = "987654321";

// --- מערכת 5: ניהול נתונים ומניעת כפילויות ---
const DATA_DIR = "./data"; 
if (!fs.existsSync(DATA_DIR)) {
    try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (e) { console.log("Data folder error"); }
}
const SENT_FILE = "./data/sent_products.json";

// --- מערכת 6: סינון מחירים (עודכן לטווח רחב יותר כדי למנוע חסימת מוצרים) ---
const MIN_PRICE = 10; // תיקון: מ-5 ל-1
const MAX_PRICE = 300; // תיקון: מ-300 ל-1000

let sentProducts = new Set();
if (fs.existsSync(SENT_FILE)) {
    try {
        const data = JSON.parse(fs.readFileSync(SENT_FILE));
        sentProducts = new Set(data);
    } catch (e) { console.log("Sent file loading error"); }
}

// --- מערכת 7: ניהול מילות מפתח (Keywords) ---
let lastKeyword = null;
function loadKeywords(){
    try {
        if (fs.existsSync("keywords.json")) {
            const data = JSON.parse(fs.readFileSync("keywords.json"));
            return data.keywords;
        }
    } catch (e) { console.log("Using default keywords"); }
    return ["smart watch", "earbuds", "car gadgets", "tools", "camping", "home tech"];
}

function getNextKeyword(){
    const KEYWORDS = loadKeywords();
    let selected;
    do {
        selected = KEYWORDS[Math.floor(Math.random() * KEYWORDS.length)];
    } while(selected === lastKeyword && KEYWORDS.length > 1);
    lastKeyword = selected;
    return selected;
}

// --- מערכת 8: מנוע אליאקספרס (חתימה ולינקים) ---
function generateSign(params){
    const sorted = Object.keys(params).sort();
    let base = APP_SECRET;
    sorted.forEach(key => { base += key + params[key]; });
    base += APP_SECRET;
    return crypto.createHash("md5").update(base).digest("hex").toUpperCase();
}

function extractLowestPrice(product){
    let price = product.target_app_sale_price || product.target_sale_price;
    if(!price) return 0;
    price = price.toString().split("-")[0];
    return parseFloat(price);
}

// --- מערכת 9: תרגום ושיווק (Google & OpenAI) ---
async function translateTitle(title){
    try {
        const res = await axios.get("https://translate.googleapis.com/translate_a/single", {
            params: { client: "gtx", sl: "auto", tl: "he", dt: "t", q: title },
            timeout: 8000
        });
        return res.data[0][0][0];
    } catch (err) { return title; }
}

async function generateAffiliateLink(originalUrl){
    const params = {
        app_key: APP_KEY,
        method: "aliexpress.affiliate.link.generate",
        timestamp: Date.now(),
        format: "json",
        v: "2.0",
        sign_method: "md5",
        source_values: originalUrl,
        tracking_id: TRACKING_ID,
        promotion_link_type: 2
    };
    params.sign = generateSign(params);
    try {
        const response = await axios.get("https://api-sg.aliexpress.com/sync", { params, timeout: 8000 });
        return response.data?.aliexpress_affiliate_link_generate_response?.resp_result?.result?.promotion_links?.promotion_link?.[0]?.promotion_link || null;
    } catch (err) { return null; }
}

async function generateMarketingText(title, price) {
    if (!openai) {
        return `🔥 *דיל חדש!* 🔥\n\n📦 ${title}\n\n💰 *מחיר:* ₪${price}\n\nאל תפספסו! 👇`;
    }
    try {
        const prompt = `כתוב פוסט שיווקי אטרקטיבי בעברית, מלא באימוג'ים, לפי המבנה:
1. שם המוצר (אימוג'י בולט).
2. תיאור קצר.
3. 4 יתרונות (עם ✅).
4. משפט סיום.
5. מחיר: ₪${price}
פרטי המוצר: ${title}`;
        
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.8
        });
        return completion.choices[0].message.content;
    } catch (err) { return `🔥 *${title}*\n\n💰 *מחיר:* ₪${price}`; }
}

// --- מערכת 10: פונקציית הליבה - fetchDeal ---
async function fetchDeal(){
    console.log(`[Scan] מריץ חיפוש עבור: ${getNextKeyword()}`);
    const params = {
        app_key: APP_KEY,
        method: "aliexpress.affiliate.product.query",
        timestamp: Date.now(),
        format: "json",
        v: "2.0",
        sign_method: "md5",
        keywords: lastKeyword,
        tracking_id: TRACKING_ID,
        ship_to_country: "IL",
        target_currency: "ILS",
        target_language: "HE",
        sort: "SALE_PRICE_ASC",
        page_size: 40,
        page_no: Math.floor(Math.random() * 30) + 1
    };
    params.sign = generateSign(params);

    try {
        const response = await axios.get("https://api-sg.aliexpress.com/sync", { params });
        const products = response.data?.aliexpress_affiliate_product_query_response?.resp_result?.result?.products?.product;
        
        if(!products || products.length === 0) return;

        let selectedProduct = null;
        let affiliateLink = null;

        for (const product of products) {
            if(sentProducts.has(product.product_id)) continue;
            const price = extractLowestPrice(product);
            
            if(price >= MIN_PRICE && price <= MAX_PRICE) {
                const link = await generateAffiliateLink(product.product_detail_url);
                if (link) {
                    selectedProduct = product;
                    affiliateLink = link;
                    sentProducts.add(product.product_id);
                    fs.writeFileSync(SENT_FILE, JSON.stringify([...sentProducts]));
                    break;
                }
            }
        }

        if(!selectedProduct || !affiliateLink) return;

        const translatedTitle = await translateTitle(selectedProduct.product_title);
        const finalPrice = Math.floor(extractLowestPrice(selectedProduct) * 100) / 100;
        const marketingText = await generateMarketingText(translatedTitle, finalPrice);
        const resizedImage = `https://images.weserv.nl/?w=600&url=${selectedProduct.product_main_image_url.replace("https://","")}`;
        const messageText = `![](${resizedImage})\n\n${marketingText}\n\n🛒 *לינק לרכישה:* \n${affiliateLink}`;
        
        await axios.post(CHANNEL_API_URL, { text: messageText, author: "Deals Bot", timestamp: new Date().toISOString() }, { headers: { "X-API-Key": API_KEY } }).catch(e => {});
        
        if (whatsappReady && targetGroupId) {
            try {
                await whatsapp.sendMessage(targetGroupId, messageText);
                console.log("🚀 נשלח לוואטסאפ בהצלחה!");
            } catch (whatsappError) {
                console.log("❌ WhatsApp Send Error:", whatsappError.message);
            }
        } else {
            console.log("⚠️ וואטסאפ לא מוכן או שחסר ID של קבוצה");
        }
    } catch (error) {
        console.log("❌ שגיאה כללית באחזור הדיל:", error.message);
    }
}

// --- מערכת 11: תזמון (Cron) ---
cron.schedule("*/20 8-23 * * 0-4", fetchDeal); 
cron.schedule("*/20 8-14 * * 5", fetchDeal);   
cron.schedule("*/20 22-23 * * 6", fetchDeal);  
cron.schedule("*/20 0-0 * * 0", fetchDeal);    

// --- מערכת 12: הפעלת וואטסאפ ו-Logs ---
whatsapp.on('qr', (qr) => {
    // תיקון: הדפסת לינק לסריקה בתוך הלוגים של Koyeb
    console.log('-------------------------------------------');
    console.log('🔗 קישור לסריקה:');
    console.log(`https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(qr)}`);
    console.log('-------------------------------------------');
});

whatsapp.on('ready', async () => {
    whatsappReady = true;
    console.log("✅ וואטסאפ מחובר ומוכן!");
    
    if (targetGroupId) {
        try {
            await whatsapp.sendMessage(targetGroupId, "הבוט התחבר בהצלחה! מנסה לשלוח מוצר ראשון...");
            console.log("🚀 הודעת בדיקה נשלחה לקבוצה!");
            
            // תיקון: הפעלה מיידית של חיפוש מוצר ברגע החיבור
            fetchDeal(); 
        } catch (err) {
            console.log("❌ שגיאה בהפעלה ראשונית:", err.message);
        }
    }
});
