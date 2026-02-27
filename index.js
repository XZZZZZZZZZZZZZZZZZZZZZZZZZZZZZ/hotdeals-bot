const axios = require('axios');
const express = require('express');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8080;

// סינון הרמטי - מילים שאסור שיופיעו בכותרת
const FORBIDDEN = [
    'woman', 'women', 'lady', 'girl', 'female', 'dress', 'skirt', 'bikini',
    'makeup', 'jewelry', 'fashion', 'נשים', 'אישה', 'בחורה', 'שמלה', 'חצאית'
];

async function fetchSafeProduct() {
    try {
        console.log("סורק מוצרים בקטגוריות טכניות נקיות...");

        // שימוש בפרמטרים המדויקים למניעת שגיאת NullPointer
        const response = await axios.get('https://gw.api.alibaba.com/openapi/param2/2/portals.open/api.listPromotionProduct', {
            params: {
                appKey: process.env.ALI_APP_KEY,
                admitad_ad_id: process.env.MY_AFFILIATE_ID, // לפעמים נדרש בשם הזה
                trackingId: process.env.MY_AFFILIATE_ID,   // ולפעמים בשם הזה
                keywords: 'computer hardware components, professional hand tools', 
                pageSize: 40,
                sort: 'lastVolumeAmount10Days'
            }
        });

        const products = response.data?.result?.products || [];
        
        // סינון קפדני לפי גדרי הצניעות
        const safeProducts = products.filter(product => {
            const title = (product.productTitle || "").toLowerCase();
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
    
    if (!product) {
        return res.send("הבוט סורק מוצרים כשרים... בבקשה רענן בעוד רגע.");
    }

    const message = `
⚙️ **מוצר טכני שנמצא בסינון**
━━━━━━━━━━━━━━━━
📝 ${product.productTitle}
💰 מחיר: ${product.salePrice}
🔗 קישור: ${product.productUrl}
    `;

    res.send(`<pre>${message}</pre>`);
});

app.listen(PORT, () => console.log(`שרת פעיל על פורט ${PORT}`));
