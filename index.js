const axios = require('axios');
const express = require('express');
const crypto = require('crypto');
const cron = require('node-cron');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8080;

// רשימת מילים אסורות לסינון צניעות
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

async function fetchSafeProduct() {
    console.log(`[${new Date().toLocaleTimeString()}] סורק מוצרים טכניים...`);
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
            keywords: 'tools, electronics, computer components',
            page_size: '50'
        };

        params.sign = generateSign(params, secret);
        const response = await axios.get('https://api-sg.aliexpress.com/sync', { params });
        const products = response.data?.ae_open_api_product_query_response?.result?.products || [];

        const safeProducts = products.filter(p => {
            const title = (p.product_title || "").toLowerCase();
            return !FORBIDDEN.some(word => title.includes(word));
        });

        if (safeProducts.length > 0) {
            console.log("✅ נמצא מוצר כשר: " + safeProducts[0].product_title);
            return safeProducts[0];
        }
        return null;
    } catch (e) {
        console.error("❌ שגיאה:", e.message);
        return null;
    }
}

// --- הגדרת זמנים ---
// ימים א-ה: 10:00 עד 23:00 כל 20 דקות
cron.schedule('*/20 10-23 * * 0-4', fetchSafeProduct);

// יום שישי: 10:00 עד 14:00 (לפני שבת)
cron.schedule('*/20 10-13 * * 5', fetchSafeProduct);

// מוצאי שבת: 22:00 עד 23:00
cron.schedule('*/20 22-23 * * 6', fetchSafeProduct);

app.get('/', (req, res) => res.send("הבוט פועל ומסנן מוצרים כהלכה."));
app.listen(PORT, () => console.log(`שרת רץ על פורט ${PORT}`));
