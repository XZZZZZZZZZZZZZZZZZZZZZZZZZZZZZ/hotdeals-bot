const axios = require('axios');
const express = require('express');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8080;

// רשימת מילים אסורות לשמירה על סביבה נקייה
const FORBIDDEN = [
    'woman', 'women', 'lady', 'girl', 'female', 'dress', 'skirt', 'bikini',
    'makeup', 'jewelry', 'fashion', 'נשים', 'אישה', 'בחורה', 'שמלה', 'חצאית'
];

// פונקציה לחישוב החתימה (Sign) שאלי אקספרס דורשים
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
        const secret = process.env.ALI_APP_SECRET;
        const appKey = process.env.ALI_APP_KEY;
        
        if (!secret || !appKey) {
            console.error("חסרים מפתחות ALI_APP_KEY או ALI_APP_SECRET ב-Railway");
            return null;
        }

        const params = {
            app_key: appKey,
            method: 'ae.open.api.product.query',
            timestamp: new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14),
            format: 'json',
            v: '2.0',
            sign_method: 'md5',
            // מיקוד במוצרי חומרה וכלי עבודה נקיים
            keywords: 'computer components, mechanical hand tools, soldering iron station',
            page_size: '40'
        };

        params.sign = generateSign(params, secret);

        const response = await axios.get('https://eco.taobao.com/router/rest', { params });
        
        const result = response.data?.ae_open_api_product_query_response?.result;
        const products = result?.products || [];

        // סינון קפדני לפי גדרי הצניעות
        const safeProducts = products.filter(product => {
            const title = (product.product_title || "").toLowerCase();
            return !FORBIDDEN.some(word => title.includes(word));
        });

        return safeProducts.length > 0 ? safeProducts[0] : null;

    } catch (error) {
        console.error("שגיאה בקריאת ה-API:", error.message);
        return null;
    }
}

app.get('/', async (req, res) => {
    const product = await fetchSafeProduct();
    if (!product) return res.send("הבוט סורק מוצרים... רענן בעוד דקה.");

    const message = `
⚙️ **מוצר טכני שנמצא בסינון**
━━━━━━━━━━━━━━━━
📝 ${product.product_title}
💰 מחיר: ${product.sale_price}
🔗 קישור: ${product.product_detail_url}
    `;
    res.send(`<pre>${message}</pre>`);
});

app.listen(PORT, () => console.log(`שרת אלי אקספרס פעיל על פורט ${PORT}`));
