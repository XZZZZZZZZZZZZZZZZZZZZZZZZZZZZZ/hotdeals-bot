const axios = require('axios');
const express = require('express');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8080;

// סינון צניעות הרמטי
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
    try {
        console.log("--- מנסה למשוך מוצרים מקטגוריית מחשבים (ID: 7) ---");
        
        const secret = process.env.ALI_APP_SECRET;
        const appKey = process.env.ALI_APP_KEY;

        const params = {
            app_key: appKey,
            method: 'ae.open.api.product.query',
            timestamp: new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14),
            format: 'json',
            v: '2.0',
            sign_method: 'md5',
            category_ids: '7', // קטגוריית Computer & Office
            page_size: '50'
        };

        params.sign = generateSign(params, secret);

        const response = await axios.get('https://eco.taobao.com/router/rest', { params });
        const products = response.data?.ae_open_api_product_query_response?.result?.products || [];

        console.log(`התקבלו ${products.length} מוצרים מה-API.`);

        const safeProducts = products.filter(p => {
            const title = (p.product_title || "").toLowerCase();
            return !FORBIDDEN.some(word => title.includes(word));
        });

        return safeProducts.length > 0 ? safeProducts[0] : null;

    } catch (error) {
        console.error("שגיאה:", error.message);
        return null;
    }
}

app.get('/', async (req, res) => {
    const product = await fetchSafeProduct();
    if (!product) return res.send("עדיין מתקבלות 0 תוצאות מאלי אקספרס. בודק הגדרות חשבון...");
    res.send(`נמצא מוצר כשר: ${product.product_title}`);
});

app.listen(PORT, () => console.log(`שרת רץ על פורט ${PORT}`));
