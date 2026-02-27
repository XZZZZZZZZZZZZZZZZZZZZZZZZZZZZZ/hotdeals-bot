const axios = require('axios');
const express = require('express');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8080;

// רשימת מילים אסורות לסינון הרמטי
const FORBIDDEN = [
    'woman', 'women', 'lady', 'girl', 'female', 'dress', 'skirt', 'bikini',
    'makeup', 'jewelry', 'נשים', 'אישה', 'בחורה', 'שמלה', 'חצאית', 'אופנה'
];

async function fetchSafeProduct() {
    try {
        console.log("סורק מוצרים בקטגוריות טכניות נקיות...");

        const response = await axios.get('https://gw.api.alibaba.com/openapi/param2/2/portals.open/api.listPromotionProduct', {
            params: {
                appKey: process.env.ALI_APP_KEY,
                // חיפוש ממוקד בציוד היקפי למחשב וכלי עבודה ידניים
                keywords: 'SSD internal drive, computer processor, mechanical screwdriver set, networking switch', 
                targetCurrency: 'USD',
                targetLanguage: 'EN',
                pageSize: 50 
            }
        });

        const products = response.data?.result?.products || [];
        
        // סינון קפדני של התוצאות
        const safeProducts = products.filter(product => {
            const title = (product.productTitle || "").toLowerCase();
            return !FORBIDDEN.some(word => title.includes(word));
        });

        if (safeProducts.length > 0) {
            return safeProducts[0];
        }

        return null;
    } catch (error) {
        console.error("שגיאה בקריאת ה-API:", error.message);
        return null;
    }
}

app.get('/', async (req, res) => {
    const product = await fetchSafeProduct();
    
    if (!product) {
        return res.send("הבוט סורק מוצרים... בבקשה רענן את הדף בעוד רגע.");
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

app.listen(PORT, () => console.log(`שרת פעיל על פורט ${PORT}`));
