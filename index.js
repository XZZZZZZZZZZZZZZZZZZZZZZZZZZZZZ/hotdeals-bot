const axios = require('axios');
const express = require('express');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8080;

// סינון מחמיר - מוודאים ששום דבר לא צנוע לא נכנס
const FORBIDDEN = [
    'woman', 'women', 'lady', 'girl', 'female', 'dress', 'skirt', 'bikini',
    'makeup', 'jewelry', 'נשים', 'אישה', 'בחורה', 'שמלה', 'חצאית', 'אופנה'
];

async function fetchSafeProduct() {
    try {
        console.log("--- מתחיל חיפוש מוצרים טכניים נקיים ---");

        const response = await axios.get('https://gw.api.alibaba.com/openapi/param2/2/portals.open/api.listPromotionProduct', {
            params: {
                appKey: process.env.ALI_APP_KEY,
                // התמקדות בכלי עבודה ואביזרי מחשב - קטגוריות נקיות יותר
                keywords: 'hand tools hardware screwdriver computer accessories mouse keyboard', 
                targetCurrency: 'USD',
                targetLanguage: 'EN',
                pageSize: 50 // מבקשים הרבה כדי שיהיה ממה לסנן
            }
        });

        const products = response.data?.result?.products || [];
        console.log(`התקבלו ${products.length} מוצרים מה-API.`);

        // סינון קפדני
        const safeProducts = products.filter(product => {
            const title = (product.productTitle || "").toLowerCase();
            // מוודא שהמילים האסורות לא מופיעות
            return !FORBIDDEN.some(word => title.includes(word));
        });

        if (safeProducts.length > 0) {
            const p = safeProducts[0];
            console.log("✅ נמצא מוצר כשר ומתאים:", p.productTitle);
            return p;
        }

        console.warn("⚠️ לא נמצאו מוצרים שעברו את סינון הצניעות במקבץ הזה.");
        return null;

    } catch (error) {
        console.error("❌ שגיאה בקריאה:", error.message);
        return null;
    }
}

app.get('/', async (req, res) => {
    const product = await fetchSafeProduct();
    if (!product) {
        return res.send("הבוט סורק כרגע מוצרים... בבקשה רענן את הדף בעוד דקה.");
    }

    const message = `
🛠️ **מוצר טכני מומלץ**
━━━━━━━━━━━━━━━━
📝 ${product.productTitle}
💰 מחיר: ${product.salePrice}
🔗 קישור: ${product.productUrl}&aff_id=${process.env.MY_AFFILIATE_ID || ''}
    `;
    res.send(`<pre>${message}</pre>`);
});

app.listen(PORT, () => console.log(`שרת רץ על פורט ${PORT}`));
