const axios = require('axios');
const express = require('express');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8080;

// סינון צניעות קפדני למניעת תכנים לא ראויים
const FORBIDDEN = ['woman', 'women', 'lady', 'girl', 'female', 'dress', 'skirt', 'fashion', 'נשים', 'אישה', 'שמלה'];

function generateSign(params, secret) {
    const sortedKeys = Object.keys(params).sort();
    let str = secret;
    for (const key of sortedKeys) str += key + params[key];
    str += secret;
    return crypto.createHash('md5').update(str, 'utf8').digest('hex').toUpperCase();
}

async function fetchHotDeals() {
    console.log("--- ניסיון משיכה בשיטת Hot Products ---");
    try {
        const params = {
            app_key: process.env.ALI_APP_KEY,
            method: 'ae.open.api.product.hot.query', // שינוי למתודת מוצרים חמים
            timestamp: new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14),
            format: 'json',
            v: '2.0',
            sign_method: 'md5',
            ad_id: process.env.ALI_TRACKING_ID,
            category_ids: '7,44', // קטגוריות מחשבים וכלי עבודה בלבד
            page_size: '20'
        };

        params.sign = generateSign(params, process.env.ALI_APP_SECRET);

        const response = await axios.get('https://api-sg.aliexpress.com/sync', { params });
        const products = response.data?.ae_open_api_product_hot_query_response?.result?.products || [];

        console.log(`התקבלו ${products.length} מוצרים.`);

        const safe = products.filter(p => !FORBIDDEN.some(w => (p.product_title || "").toLowerCase().includes(w)));
        if (safe.length > 0) {
            console.log("✅ נמצא מוצר כשר ראשון: " + safe[0].product_title);
        }
    } catch (e) {
        console.error("❌ שגיאה:", e.message);
    }
}

fetchHotDeals(); // הפעלה מיידית בשידור

app.get('/', (req, res) => res.send("השרת מנסה למשוך מוצרים חמים..."));
app.listen(PORT, () => console.log(`שרת פעיל על פורט ${PORT}`));
