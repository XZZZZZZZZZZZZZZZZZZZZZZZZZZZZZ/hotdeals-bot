const axios = require('axios');
const express = require('express');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8080;

const FORBIDDEN_KEYWORDS = [
    'woman', 'women', 'lady', 'girl', 'female', 'bride', 'bikini', 'dress', 'skirt',
    'נשים', 'אישה', 'בחורה', 'שמלה', 'חצאית', 'אופנה', 'טיפוח'
];

async function fetchSafeProduct() {
    try {
        console.log("מנסה למשוך מוצר עם פרמטרים מעודכנים...");

        const response = await axios.get('https://gw.api.alibaba.com/openapi/param2/2/portals.open/api.listPromotionProduct', {
            params: {
                appKey: process.env.ALI_APP_KEY,
                // הוספת פרמטרים למניעת שגיאת NullPointer
                targetCurrency: 'USD',
                targetLanguage: 'EN',
                sort: 'volumeDown', // מביא מוצרים פופולריים
                keywords: 'tools electronics gadgets car accessories', 
                pageSize: 20
            }
        });

        // בדיקה אם המבנה של התשובה תקין
        if (!response.data || !response.data.result) {
            console.error("תגובת שרת לא צפויה:", JSON.stringify(response.data));
            return null;
        }

        const products = response.data.result.products || [];

        // סינון לפי גדרי הצניעות
        const safeProducts = products.filter(product => {
            const title = (product.productTitle || "").toLowerCase();
            return !FORBIDDEN_KEYWORDS.some(word => title.includes(word));
        });

        return safeProducts.length > 0 ? safeProducts[0] : null;

    } catch (error) {
        console.error("--- שגיאה מפורטת ---");
        console.error(error.response ? error.response.data : error.message);
        return null;
    }
}

app.get('/', async (req, res) => {
    const product = await fetchSafeProduct();
    if (!product) return res.send("לא נמצא מוצר מתאים. בדוק לוגים.");

    const message = `
📦 **מוצר טכני חדש**
📝 ${product.productTitle}
💰 מחיר: ${product.salePrice}
🔗 קישור: ${product.productUrl}&aff_id=${process.env.MY_AFFILIATE_ID || ''}
    `;
    res.send(`<pre>${message}</pre>`);
});

app.listen(PORT, () => console.log(`שרת רץ על פורט ${PORT}`));
