const axios = require('axios');
const express = require('express');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8080;

// רשימת מילים אסורות - סינון צניעות מחמיר
const FORBIDDEN = [
    'woman', 'women', 'lady', 'girl', 'female', 'dress', 'skirt', 'bikini',
    'makeup', 'jewelry', 'fashion', 'נשים', 'אישה', 'בחורה', 'שמלה', 'חצאית', 'אופנה'
];

// פונקציה לייצור חתימה דיגיטלית לפי דרישות אלי אקספרס
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
        console.log("--- מתחיל סריקה של מוצרים טכניים נקיים ---");
        
        const secret = process.env.ALI_APP_SECRET;
        const appKey = process.env.ALI_APP_KEY;
        
        if (!secret || !appKey) {
            console.error("❌ חסרים מפתחות ALI_APP_KEY או ALI_APP_SECRET ב-Railway");
            return null;
        }

        const params = {
            app_key: appKey,
            method: 'ae.open.api.product.query',
            timestamp: new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14),
            format: 'json',
            v: '2.0',
            sign_method: 'md5',
            // מילות מפתח טכניות שנועדו להביא תוצאות נקיות
            keywords: 'computer parts, electronics, hand tools, car accessories',
            page_size: '50',
            sort: 'lastVolumeAmount10Days'
        };

        params.sign = generateSign(params, secret);

        const response = await axios.get('https://eco.taobao.com/router/rest', { params });
        
        // שליפת רשימת המוצרים מהתשובה
        const products = response.data?.ae_open_api_product_query_response?.result?.products || [];
        console.log(`אלי אקספרס החזירה ${products.length} מוצרים גולמיים.`);

        // סינון קפדני לפי גדרי הצניעות
        const safeProducts = products.filter(product => {
            const title = (product.product_title || "").toLowerCase();
            return !FORBIDDEN.some(word => title.includes(word));
        });

        if (safeProducts.length > 0) {
            const selected = safeProducts[0];
            console.log("✅ נמצא מוצר כשר ומתאים:", selected.product_title);
            return selected;
        }

        console.warn("⚠️ לא נמצאו מוצרים שעברו את סינון הצניעות.");
        return null;

    } catch (error) {
        console.error("❌ שגיאה בקריאה ל-API:", error.message);
        return null;
    }
}

// הפעלה אוטומטית של סריקה בכל פעם שהשרת עולה
fetchSafeProduct();

// דף הבית של הבוט ב-Railway
app.get('/', async (req, res) => {
    const product = await fetchSafeProduct();
    if (!product) {
        return res.send("הבוט סורק מוצרים... אנא רענן את הדף בעוד דקה.");
    }

    const message = `
📦 **מוצר טכני מומלץ (מסונן)**
━━━━━━━━━━━━━━━━
📝 ${product.product_title}
💰 מחיר: ${product.sale_price} ${product.sale_price_currency}
🔗 קישור: ${product.product_detail_url}
    `;
    res.send(`<pre>${message}</pre>`);
});

app.listen(PORT, () => {
    console.log(`🚀 השרת פעיל ומבצע סריקה בפורט ${PORT}`);
});
