const axios = require('axios');
const express = require('express');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8080;

// סינון מחמיר - מוודאים שאין תוכן שאינו עומד בגדרי הצניעות
const FORBIDDEN = ['woman', 'women', 'girl', 'lady', 'female', 'dress', 'skirt', 'fashion', 'נשים', 'אישה', 'שמלה'];

function generateSign(params, secret) {
    const sortedKeys = Object.keys(params).sort();
    let str = secret;
    for (const key of sortedKeys) {
        str += key + params[key];
    }
    str += secret;
    return crypto.createHash('md5').update(str, 'utf8').digest('hex').toUpperCase();
}

async function fetchAliExpressProduct() {
    try {
        const secret = process.env.ALI_APP_SECRET;
        const appKey = process.env.ALI_APP_KEY;
        
        if (!secret || !appKey) return { error: "Missing keys in Railway" };

        const params = {
            app_key: appKey,
            method: 'ae.open.api.product.query',
            session: '', 
            timestamp: new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14),
            format: 'json',
            v: '2.0',
            sign_method: 'md5',
            keywords: 'cpu processor, screwdriver set, ssd drive', // קטגוריות טכניות נקיות
            page_size: '20'
        };

        params.sign = generateSign(params, secret);

        const response = await axios.get('https://eco.taobao.com/router/rest', { params });
        
        // בדיקת סינון צניעות על התוצאות
        const products = response.data?.ae_open_api_product_query_response?.result?.products || [];
        const safeProducts = products.filter(p => !FORBIDDEN.some(word => p.product_title.toLowerCase().includes(word)));

        return safeProducts.length > 0 ? safeProducts[0] : null;

    } catch (error) {
        console.error("פרטי שגיאה:", error.response ? error.response.data : error.message);
        return null;
    }
}

app.get('/', async (req, res) => {
    const product = await fetchAliExpressProduct();
    if (!product) return res.send("מבצע סריקה... אם מופיעה שגיאה 500 בלוגים, יש לבדוק את ה-Secret Key.");
    res.json(product);
});

app.listen(PORT, () => console.log(`שרת אלי אקספרס פעיל על פורט ${PORT}`));
