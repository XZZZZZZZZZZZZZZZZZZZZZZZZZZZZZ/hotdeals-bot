const axios = require('axios');
const express = require('express');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8080;

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

async function fetchProducts() {
    try {
        console.log("--- מבצע ניסיון משיכה מעודכן ---");
        const secret = process.env.ALI_APP_SECRET;
        const appKey = process.env.ALI_APP_KEY;
        const trackingId = process.env.ALI_TRACKING_ID; // ודא שהוספת את זה ב-Railway!

        const params = {
            app_key: appKey,
            method: 'ae.open.api.product.query',
            timestamp: new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14),
            format: 'json',
            v: '2.0',
            sign_method: 'md5',
            ad_id: trackingId, // חשוב מאוד!
            keywords: 'electronics, tools, phone accessories',
            page_size: '50'
        };

        params.sign = generateSign(params, secret);

        // שימוש בכתובת ה-API הגלובלית החדשה
        const response = await axios.get('https://api-sg.aliexpress.com/sync', { params });
        
        const products = response.data?.ae_open_api_product_query_response?.result?.products || [];
        console.log(`התקבלו ${products.length} מוצרים מה-API.`);

        const safeProducts = products.filter(p => {
            const title = (p.product_title || "").toLowerCase();
            return !FORBIDDEN.some(word => title.includes(word));
        });

        if (safeProducts.length > 0) {
            console.log("✅ נמצא מוצר תקין: " + safeProducts[0].product_title);
            return safeProducts[0];
        }
        return null;
    } catch (error) {
        console.error("❌ שגיאה:", error.message);
        return null;
    }
}

// הפעלה לבדיקה
fetchProducts();

app.get('/', async (req, res) => {
    const p = await fetchProducts();
    res.send(p ? `נמצא: ${p.product_title}` : "עדיין מחזיר 0 תוצאות. בדוק Tracking ID.");
});

app.listen(PORT, () => console.log(`שרת רץ על פורט ${PORT}`));
