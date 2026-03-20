const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const axios = require("axios");
const crypto = require("crypto");
const cron = require("node-cron");
const fs = require("fs");

const app = express();
const port = process.env.PORT || 8080;

// --- מערכת 1: שרת אירוח (Keep-Alive) ---
app.get('/', (req, res) => res.send('Bot Status: Online and Active'));
app.listen(port, () => console.log(`[System] Server is running on port ${port}`));

// הגדרת זמן ישראל
const ISRAEL_TZ = "Asia/Jerusalem";
process.env.TZ = ISRAEL_TZ;

// --- מערכת 2: הגדרות וואטסאפ (Puppeteer) ---
const whatsapp = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox', '--disable-setuid-sandbox',
            '--disable-dev-shm-usage', '--disable-gpu',
            '--no-zygote', '--single-process'
        ],
        protocolTimeout: 90000
    }
});

let whatsappReady = false;
let targetGroupId = "120363407216029255@g.us"; 

// --- מערכת 3: הגדרות API ומפתחות ---
const APP_KEY = process.env.ALI_APP_KEY;
const APP_SECRET = process.env.ALI_APP_SECRET;
const TRACKING_ID = process.env.ALI_TRACKING_ID;
const CHANNEL_API_URL = "https://dilim.clickandgo.cfd/api/import/post";
const API_KEY = "987654321";

const DATA_DIR = "./data"; 
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const SENT_FILE = "./data/sent_products.json";

let sentProducts = fs.existsSync(SENT_FILE) ? new Set(JSON.parse(fs.readFileSync(SENT_FILE))) : new Set();
let lastKeyword = null;

// --- מערכת 4: פונקציות עזר ---

function getNextKeyword() {
    const KEYWORDS = ["smart watch", "earbuds", "car gadgets", "tools", "camping", "home tech"];
    let selected;
    do {
        selected = KEYWORDS[Math.floor(Math.random() * KEYWORDS.length)];
    } while (selected === lastKeyword);
    lastKeyword = selected;
    return selected;
}

function generateSign(params) {
    const sorted = Object.keys(params).sort();
    let base = APP_SECRET;
    sorted.forEach(key => { base += key + params[key]; });
    base += APP_SECRET;
    return crypto.createHash("md5").update(base).digest("hex").toUpperCase();
}

async function translateTitle(title) {
    try {
        const res = await axios.get("https://translate.googleapis.com/translate_a/single", {
            params: { client: "gtx", sl: "auto", tl: "he", dt: "t", q: title },
            timeout: 8000
        });
        return res.data[0][0][0];
    } catch { return title; }
}

async function generateAffiliateLink(originalUrl) {
    const params = {
        app_key: APP_KEY, method: "aliexpress.affiliate.link.generate",
        timestamp: Date.now(), format: "json", v: "2.0", sign_method: "md5",
        source_values: originalUrl, tracking_id: TRACKING_ID, promotion_link_type: 2
    };
    params.sign = generateSign(params);
    try {
        const res = await axios.get("https://api-sg.aliexpress.com/sync", { params, timeout: 8000 });
        return res.data?.aliexpress_affiliate_link_generate_response?.resp_result?.result?.promotion_links?.promotion_link?.[0]?.promotion_link || null;
    } catch { return null; }
}

// --- מערכת 5: פונקציית הליבה - fetchDeal ---

async function fetchDeal() {
    console.log(`[Scan] מריץ סריקה עבור: ${getNextKeyword()}`);
    
    const params = {
        app_key: APP_KEY, method: "aliexpress.affiliate.product.query",
        timestamp: Date.now(), format: "json", v: "2.0", sign_method: "md5",
        keywords: lastKeyword, tracking_id: TRACKING_ID,
        ship_to_country: "IL", target_currency: "ILS", target_language: "HE", sort: "SALE_PRICE_ASC"
    };
    params.sign = generateSign(params);

    try {
        const response = await axios.get("https://api-sg.aliexpress.com/sync", { params });
        const products = response.data?.aliexpress_affiliate_product_query_response?.resp_result?.result?.products?.product;

        if (!products?.length) return;

        let selectedProduct = null;
        let affiliateLink = null;

        for (const product of products) {
            if (sentProducts.has(product.product_id)) continue;
            
            const price = parseFloat(product.target_app_sale_price || product.target_sale_price);
            if (price >= 10 && price <= 250 && product.sale_volume > 50) {
                const link = await generateAffiliateLink(product.product_detail_url);
                if (link) {
                    selectedProduct = product;
                    affiliateLink = link;
                    break;
                }
            }
        }

        if (!selectedProduct || !affiliateLink) return;

        const translatedTitle = await translateTitle(selectedProduct.product_title);
        const finalPrice = Math.floor(parseFloat(selectedProduct.target_sale_price) * 100) / 100;
        const resizedImage = `https://images.weserv.nl/?w=600&url=${selectedProduct.product_main_image_url.replace("https://","")}`;
        
        const messageText = `![](${resizedImage})\n\n🔥 *דיל חדש!*\n\n📦 ${translatedTitle}\n\n💰 *מחיר:* ₪${finalPrice}\n\n🛒 *להזמנה:* \n${affiliateLink}`;

        // שליחה ל-API של הערוץ (קורה תמיד!)
        await axios.post(CHANNEL_API_URL, { 
            text: messageText, author: "Deals Bot", timestamp: new Date().toISOString() 
        }, { headers: { "X-API-Key": API_KEY } })
        .then(() => console.log("🚀 נשלח ל-API!"))
        .catch(e => console.log("❌ שגיאה ב-API:", e.message));

        // שליחה לוואטסאפ (רק אם מחובר)
        if (whatsappReady) {
            await whatsapp.sendMessage(targetGroupId, messageText)
                .then(() => console.log("🚀 נשלח לוואטסאפ!"))
                .catch(e => console.log("❌ שגיאת וואטסאפ:", e.message));
        }

        sentProducts.add(selectedProduct.product_id);
        fs.writeFileSync(SENT_FILE, JSON.stringify([...sentProducts]));

    } catch (err) {
        console.log("❌ שגיאה כללית:", err.message);
    }
}

// --- מערכת 6: תזמון (Cron) ---
const cronOptions = { timezone: ISRAEL_TZ };
cron.schedule("*/20 8-23 * * 0-4", fetchDeal, cronOptions);
cron.schedule("*/20 8-14 * * 5", fetchDeal, cronOptions);
cron.schedule("*/20 22-23 * * 6", fetchDeal, cronOptions);
cron.schedule("*/20 0-0 * * 0", fetchDeal, cronOptions);

// --- מערכת 7: אירועי וואטסאפ ---
whatsapp.on('qr', (qr) => {
    console.log(`QR: https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(qr)}`);
});

whatsapp.on('ready', () => {
    whatsappReady = true;
    console.log("✅ וואטסאפ מחובר!");
});

whatsapp.initialize();

// --- מערכת 8: הפעלה מיידית בפריסה ---
console.log("[System] מריץ שליחה ראשונה ל-API...");
fetchDeal();
