const axios = require('axios');
const express = require('express');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8080;

// רשימת מילים אסורות לסינון מחמיר
const FORBIDDEN_KEYWORDS = [
    'woman', 'women', 'lady', 'girl', 'female', 'bride', 'bikini', 'dress', 'skirt',
    'נשים', 'אישה', 'בחורה', 'שמלה', 'חצאית', 'אופנה', 'טיפוח'
];

async function fetchSafeProduct() {
    try {
        console.log("מנסה למשוך מוצר מאלי אקספרס...");

        // בדיקה אם המפתח קיים בכלל
        if (!process.env.ALI_APP_KEY) {
            console.error("שגיאה: חסר משתנה ALI_APP_KEY ב-Railway Variables");
            return null;
        }

        const response = await axios.get('https://gw.api.alibaba.com/openapi/param2/2/portals.open/api.listPromotionProduct', {
            params: {
                appKey: process.env.ALI_APP_KEY,
                keywords: 'mechanical tools home improvement car accessories', 
                pageSize: 20
            }
        });

        const products = response.data?.result?.products || [];

        // סינון מוצרים לפי גדרי הצניעות
        const safeProducts = products.filter(product => {
            const title = product.productTitle.toLowerCase();
            return !FORBIDDEN_KEYWORDS.some(word => title.includes(word));
        });

        if (safeProducts.length === 0) {
            console.log("לא נמצאו מוצרים שתואמים את הסינון.");
            return null;
        }

        return safeProducts[0];

    } catch (error) {
        // התיקון החשוב: הדפסת השגיאה המפורטת מהשרת
        console.error("--- שגיאה מפורטת מהשרת ---");
        if (error.response) {
            console.error("סטטוס:", error.response.status);
            console.error("נתונים:", JSON.stringify(error.response.data));
        } else {
            console.error("הודעת שגיאה:", error.message);
        }
        console.error("--------------------------");
        return null;
    }
}

app.get('/', async (req, res) => {
    const product = await fetchSafeProduct();

    if (!product) {
        return res.status(500).send("שגיאה במשיכת המוצר. בדוק את ה-Logs ב-Railway לפרטים נוספים.");
    }

    const message = `
📦 **המלצה על מוצר טכני**
━━━━━━━━━━━━━━━━
📝 ${product.productTitle}
💰 מחיר: ${product.salePrice}
🔗 קישור: ${product.productUrl}&aff_id=${process.env.MY_AFFILIATE_ID || ''}
    `;

    res.send(`<pre>${message}</pre>`);
});

app.listen(PORT, () => {
    console.log(`השרת פעיל על פורט ${PORT}`);
});
