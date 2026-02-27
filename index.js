const axios = require('axios');
const express = require('express');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8080;

// רשימת מילים אסורות לסינון מחמיר (אנגלית ועברית)
const FORBIDDEN = [
    'woman', 'women', 'lady', 'girl', 'female', 'dress', 'skirt', 'bikini',
    'makeup', 'jewelry', 'fashion', 'נשים', 'אישה', 'בחורה', 'שמלה', 'חצאית'
];

async function fetchSafeProduct() {
    try {
        console.log("מבצע קריאת API מותאמת...");

        // שימוש ב-URL הישיר של ה-Portals API למניעת שגיאות שרת
        const response = await axios.get('https://gw.api.alibaba.com/openapi/param2/2/portals.open/api.listPromotionProduct', {
            params: {
                appKey: process.env.ALI_APP_KEY,
                keywords: 'SSD internal, mechanical tools, car diagnostic, computer parts', 
                targetCurrency: 'USD',
                pageSize: 40,
                local: 'en_US'
            }
        });

        // בדיקה אם המבנה תקין
        if (!response.data || !response.data.result) {
            console.error("תשובת API ריקה - בדוק את ה-App Key ב-Railway");
            return null;
        }

        const products = response.data.result.products || [];
        
        // סינון קפדני לפי גדרי הצניעות
        const safeProducts = products.filter(product => {
            const title = (product.productTitle || "").toLowerCase();
            return !FORBIDDEN.some(word => title.includes(word));
        });

        if (safeProducts.length > 0) {
            console.log("✅ נמצא מוצר תקין שעבר סינון.");
            return safeProducts[0];
        }

        console.log("⚠️ לא נמצאו מוצרים מתאימים בסינון הנוכחי.");
        return null;

    } catch (error) {
        console.error("שגיאה סופית בחיבור:", error.message);
        return null;
    }
}

app.get('/', async (req, res) => {
    const product = await fetchSafeProduct();
    
    if (!product) {
        return res.send("הבוט מחפש מוצרים כשרים... בבקשה רענן בעוד דקה.");
    }

    const message = `
📦 **המלצה למוצר טכני**
━━━━━━━━━━━━━━━━
📝 ${product.productTitle}
💰 מחיר: ${product.salePrice}
🔗 קישור: ${product.productUrl}
    `;

    res.send(`<pre>${message}</pre>`);
});

app.listen(PORT, () => console.log(`שרת רץ על פורט ${PORT}`));
