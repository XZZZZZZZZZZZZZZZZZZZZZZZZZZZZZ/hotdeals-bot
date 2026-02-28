const axios = require('axios');
const express = require('express');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8080;

const FORBIDDEN = [
    'woman', 'women', 'lady', 'girl', 'female', 'dress', 'skirt', 'bikini',
    'makeup', 'jewelry', 'fashion', 'נשים', 'אישה', 'בחורה', 'שמלה', 'חצאית'
];

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
    try {
        console.log("--- מתחיל סריקה אוטומטית של מוצרים טכניים ---");
        
        const secret = process.env.ALI_APP_SECRET;
        const appKey = process.env.ALI_APP_KEY;
        
        if (!secret || !appKey) {
            console.error("❌ שגיאה: חסרים מפתחות ALI_APP_KEY או ALI_APP_SECRET");
            return null;
        }

        const params = {
            app_key: appKey,
            method: 'ae.open.api.product.query',
            timestamp: new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14),
            format: 'json',
            v: '2.0',
            sign_method: 'md5',
            keywords: 'SSD drive, mechanical tools, multimeter, networking switch',
            page_size: '40'
        };

        params.sign = generateSign(params, secret);

        const response = await axios.get('https://eco.taobao.com/router/rest', { params });
        const products = response.data?.ae_open_api_product_query_response?.result?.products || [];

        console.log(`נמצאו ${products.length} מוצרים גולמיים. מתחיל סינון...`);

        const safeProducts = products.filter(product => {
            const title = (product.product_title || "").toLowerCase();
            return !FORBIDDEN.some(word => title.includes(word));
        });

        if (safeProducts.length > 0) {
            console.log("✅ נמצא מוצר כשר ומתאים:", safeProducts[0].product_title);
            return safeProducts[0];
        }

        console.warn("⚠️ לא נמצאו מוצרים שעברו את סינון הצניעות.");
        return null;

    } catch (error) {
        console.error("❌ שגיאה בחיבור ל-API:", error.message);
        return null;
    }
}

// הפעלה אוטומטית ברגע שהשרת עולה
fetchSafeProduct();

app.get('/', async (req, res) => {
    const product = await fetchSafeProduct();
    res.send(product ? `נמצא מוצר: ${product.product_title}` : "סורק כרגע...");
});

app.listen(PORT, () => console.log(`🚀 השרת פעיל ומבצע סריקה בפורט ${PORT}`));
