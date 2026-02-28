const axios = require('axios');
const express = require('express');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8080;

// סינון צניעות הרמטי
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
        console.log("--- סורק מוצרים בקטגוריות טכנולוגיה ותחזוקה ---");
        
        const secret = process.env.ALI_APP_SECRET;
        const appKey = process.env.ALI_APP_KEY;
        
        if (!secret || !appKey) {
            console.error("❌ חסרים מפתחות ב-Railway");
            return null;
        }

        const params = {
            app_key: appKey,
            method: 'ae.open.api.product.query',
            timestamp: new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14),
            format: 'json',
            v: '2.0',
            sign_method: 'md5',
            // חיפוש רחב יותר כדי להבטיח תוצאות
            keywords: 'tools, hardware, storage, electronics accessories',
            page_size: '50',
            sort: 'LAST_VOLUME_ASC' 
        };

        params.sign = generateSign(params, secret);

        const response = await axios.get('https://eco.taobao.com/router/rest', { params });
        
        // שליפת רשימת המוצרים
        const result = response.data?.ae_open_api_product_query_response?.result;
        const products = result?.products || [];

        console.log(`אלי אקספרס החזירה ${products.length} מוצרים למערכת.`);

        // סינון קפדני
        const safeProducts = products.filter(product => {
            const title = (product.product_title || "").toLowerCase();
            return !FORBIDDEN.some(word => title.includes(word));
        });

        if (safeProducts.length > 0) {
            const selected = safeProducts[0];
            console.log("✅ מוצר כשר נמצא:", selected.product_title);
            return selected;
        }

        console.warn("⚠️ לא נמצאו מוצרים שעברו את הסינון.");
        return null;

    } catch (error) {
        console.error("❌ שגיאה:", error.message);
        return null;
    }
}

// הפעלה אוטומטית בכל פעם שהשרת עולה
fetchSafeProduct();

app.get('/', async (req, res) => {
    const product = await fetchSafeProduct();
    if (!product) return res.send("הבוט מחפש... אנא רענן בעוד דקה.");

    res.send(`
        <div style="direction: rtl; font-family: sans-serif;">
            <h2>⚙️ מוצר טכני שנמצא</h2>
            <hr>
            <p><strong>שם:</strong> ${product.product_title}</p>
            <p><strong>מחיר:</strong> ${product.sale_price} ${product.sale_price_currency}</p>
            <a href="${product.product_detail_url}" target="_blank">לצפייה במוצר</a>
        </div>
    `);
});

app.listen(PORT, () => console.log(`🚀 המערכת רצה בפורט ${PORT}`));
