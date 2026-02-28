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

async function fetchNow() {
    console.log("--- בדיקת תקשורת אגרסיבית מול אלי אקספרס ---");
    try {
        const params = {
            app_key: process.env.ALI_APP_KEY,
            method: 'ae.open.api.product.query',
            timestamp: new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14),
            format: 'json',
            v: '2.0',
            sign_method: 'md5',
            ad_id: process.env.ALI_TRACKING_ID,
            keywords: 'iphone', // מילת חיפוש חזקה לבדיקה
            page_size: '10'
        };

        params.sign = generateSign(params, process.env.ALI_APP_SECRET);

        const response = await axios.get('https://api-sg.aliexpress.com/sync', { params });
        const products = response.data?.ae_open_api_product_query_response?.result?.products || [];

        if (products.length > 0) {
            console.log(`✅ הצלחה! התקבלו ${products.length} מוצרים.`);
            // סינון צניעות לפני הצגה
            const safe = products.filter(p => !FORBIDDEN.some(w => (p.product_title || "").toLowerCase().includes(w)));
            if (safe.length > 0) console.log("מוצר ראשון כשר: " + safe[0].product_title);
        } else {
            console.log("❌ עדיין מתקבלים 0 מוצרים. אלי אקספרס חוסמת את הבקשה.");
        }
    } catch (e) {
        console.error("❌ שגיאה טכנית:", e.message);
    }
}

// הפעלה מיידית
fetchNow();

// תזמון כל 20 דקות (כולל שמירת שבת וחופש בשישי)
cron.schedule('*/20 10-23 * * 0-4', fetchNow);
cron.schedule('*/20 10-13 * * 5', fetchNow);
cron.schedule('*/20 22-23 * * 6', fetchNow);

app.get('/', (req, res) => res.send("הבוט מנסה למשוך נתונים... בדוק Logs."));
app.listen(PORT, () => console.log(`שרת רץ על פורט ${PORT}`));
