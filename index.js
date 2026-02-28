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

async function runAutoSearch() {
    console.log("--- מתחיל קריאה אוטומטית למוצרים (קטגוריה: טכנולוגיה) ---");
    try {
        const secret = process.env.ALI_APP_SECRET;
        const appKey = process.env.ALI_APP_KEY;

        const params = {
            app_key: appKey,
            method: 'ae.open.api.product.query',
            timestamp: new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14),
            format: 'json',
            v: '2.0',
            sign_method: 'md5',
            category_ids: '7,44,509', // קטגוריות: מחשבים, אלקטרוניקה, כלי עבודה
            page_size: '50'
        };

        params.sign = generateSign(params, secret);

        const response = await axios.get('https://eco.taobao.com/router/rest', { params });
        const products = response.data?.ae_open_api_product_query_response?.result?.products || [];

        console.log(`התקבלו ${products.length} מוצרים גולמיים.`);

        const safeProducts = products.filter(p => {
            const title = (p.product_title || "").toLowerCase();
            return !FORBIDDEN.some(word => title.includes(word));
        });

        if (safeProducts.length > 0) {
            console.log("✅ מוצר כשר נמצא והוכן להצגה: " + safeProducts[0].product_title);
            return safeProducts[0];
        } else {
            console.log("⚠️ לא נמצאו מוצרים מתאימים בסינון הנוכחי.");
            return null;
        }
    } catch (error) {
        console.error("❌ שגיאה בקריאה:", error.message);
        return null;
    }
}

// הפעלה אוטומטית מיד עם עליית השרת
runAutoSearch();

app.get('/', async (req, res) => {
    const product = await runAutoSearch();
    res.send(product ? `נמצא מוצר: ${product.product_title}` : "מחפש מוצרים... רענן בעוד רגע.");
});

app.listen(PORT, () => console.log(`שרת פעיל על פורט ${PORT} ומבצע סריקות.`));
