const axios = require('axios');
const express = require('express');
const crypto = require('crypto');
const cron = require('node-cron');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8080;

// סינון צניעות קפדני
const FORBIDDEN = ['woman', 'women', 'lady', 'girl', 'female', 'dress', 'skirt', 'fashion', 'נשים', 'אישה', 'שמלה'];

function generateSign(params, secret) {
    const sortedKeys = Object.keys(params).sort();
    let str = secret;
    for (const key of sortedKeys) {
        str += key + params[key];
    }
    str += secret;
    return crypto.createHash('md5').update(str, 'utf8').digest('hex').toUpperCase();
}

async function fetchAndLog() {
    console.log(`[${new Date().toLocaleTimeString()}] --- מבצע קריאת API עכשיו! ---`);
    try {
        const secret = process.env.ALI_APP_SECRET;
        const appKey = process.env.ALI_APP_KEY;
        const adId = process.env.ALI_TRACKING_ID;

        const params = {
            app_key: appKey,
            method: 'ae.open.api.product.query',
            timestamp: new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14),
            format: 'json',
            v: '2.0',
            sign_method: 'md5',
            ad_id: adId,
            keywords: 'tools, computer accessories, electronic components',
            page_size: '20'
        };

        params.sign = generateSign(params, secret);

        const response = await axios.get('https://api-sg.aliexpress.com/sync', { params });
        const products = response.data?.ae_open_api_product_query_response?.result?.products || [];

        console.log(`תוצאה מה-API: התקבלו ${products.length} מוצרים.`);

        const safeProducts = products.filter(p => {
            const title = (p.product_title || "").toLowerCase();
            return !FORBIDDEN.some(word => title.includes(word));
        });

        if (safeProducts.length > 0) {
            console.log("✅ נמצא מוצר כשר: " + safeProducts[0].product_title);
        } else if (products.length > 0) {
            console.log("⚠️ מוצרים נמצאו אך כולם נפסלו בסינון הצניעות.");
        }
    } catch (e) {
        console.error("❌ שגיאת API קריטית:", e.message);
    }
}

// --- הפעלה מיידית ברגע שהשרת עולה ---
fetchAndLog();

// --- הגדרת לוח זמנים (כל 20 דקות) ---
// א-ה: 10:00-23:00
cron.schedule('*/20 10-23 * * 0-4', fetchAndLog);
// שישי: 10:00-14:00
cron.schedule('*/20 10-13 * * 5', fetchAndLog);
// מוצ"ש: 22:00-23:00
cron.schedule('*/20 22-23 * * 6', fetchAndLog);

app.get('/', (req, res) => res.send("הבוט פועל ומבצע קריאות API אוטומטיות."));
app.listen(PORT, () => console.log(`שרת רץ על פורט ${PORT} ומבצע סריקות.`));
