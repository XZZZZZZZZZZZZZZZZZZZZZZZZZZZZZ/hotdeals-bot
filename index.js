const axios = require('axios');
const express = require('express');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8080;

// סינון צניעות הרמטי - מילים שאסור שיופיעו בכותרת
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
        console.log("--- סורק מוצרי חומרה ואלקטרוניקה בחיפוש רחב ---");
        
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
            // שינוי מילת חיפוש למילה שתמיד מחזירה תוצאות באלי אקספרס
            keywords: 'cable, adapter, computer components, tools', 
            page_size: '50',
            sort: 'LAST_VOLUME_DESC' 
        };

        params.sign = generateSign(params, secret);

        const response = await axios.get('https://eco.taobao.com/router/rest', { params });
        
        // שליפת רשימת המוצרים
        const result = response.data?.ae_open_api_product_query_response?.result;
        const products = result?.products || [];

        console.log(`אלי אקספרס החזירה ${products.length} מוצרים למערכת.`);

        // סינון קפדני לפי גדרי הצניעות
        const safeProducts = products.filter(product => {
            const title = (product.product_title || "").toLowerCase();
            return !FORBIDDEN.some(word => title.includes(word));
        });

        if (safeProducts.length > 0) {
            const selected = safeProducts[0];
            console.log("✅ מוצר כשר ומתאים נמצא:", selected.product_title);
            return selected;
        }

        console.warn("⚠️ לא נמצאו מוצרים מתאימים לאחר סינון הצניעות.");
        return null;

    } catch (error) {
        console.error("❌ שגיאה סופית בחיבור:", error.message);
        return null;
    }
}

// הפעלה אוטומטית בכל פעם שהשרת עולה
fetchSafeProduct();

app.get('/', async (req, res) => {
    const product = await fetchSafeProduct();
    if (!product) return res.send("הבוט סורק מוצרים כשרים... בבקשה רענן בעוד דקה.");

    res.send(`
        <div style="direction: rtl; font-family: sans-serif; padding: 20px;">
            <h2>⚙️ מוצר טכני שנמצא בסינון</h2>
            <hr>
            <p><strong>שם המוצר:</strong> ${product.product_title}</p>
            <p><strong>מחיר:</strong> ${product.sale_price} ${product.sale_price_currency}</p>
            <a href="${product.product_detail_url}" target="_blank" style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">לצפייה במוצר באלי אקספרס</a>
        </div>
    `);
});

app.listen(PORT, () => console.log(`🚀 השרת פעיל בפורט ${PORT}`));
