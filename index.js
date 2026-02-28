const axios = require('axios');
const express = require('express');
const crypto = require('crypto');
const cron = require('node-cron');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8080;

// סינון צניעות קפדני - מילים שפוסלות מוצר באופן מיידי
const FORBIDDEN = [
    'woman', 'women', 'lady', 'girl', 'female', 'dress', 'skirt', 'bikini',
    'makeup', 'jewelry', 'fashion', 'נשים', 'אישה', 'בחורה', 'שמלה', 'חצאית', 'אופנה'
];

// פונקציה לייצור חתימה (Sign) עבור אלי אקספרס
function generateSign(params, secret) {
    const sortedKeys = Object.keys(params).sort();
    let str = secret;
    for (const key of sortedKeys) {
        str += key + params[key];
    }
    str += secret;
    return crypto.createHash('md5').update(str, 'utf8').digest('hex').toUpperCase();
}

// הפונקציה המרכזית למשיכת מוצרים מסוננים
async function fetchAndProcessProducts() {
    console.log(`[${new Date().toLocaleTimeString()}] מתחיל סריקה של מוצרים טכניים...`);
    
    try {
        const secret = process.env.ALI_APP_SECRET;
        const appKey = process.env.ALI_APP_KEY;
        const trackingId = process.env.ALI_TRACKING_ID;

        if (!secret || !appKey || !trackingId) {
            console.error("❌ חסרים משתני סביבה (Variables) ב-Railway!");
            return null;
        }

        const params = {
            app_key: appKey,
            method: 'ae.open.api.product.query',
            timestamp: new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14),
            format: 'json',
            v: '2.0',
            sign_method: 'md5',
            ad_id: trackingId,
            keywords: 'computer parts, tools, electronic components, ssd, cables',
            page_size: '50',
            sort: 'LAST_VOLUME_ASC'
        };

        params.sign = generateSign(params, secret);

        // שימוש בכתובת ה-API הגלובלית המעודכנת
        const response = await axios.get('https://api-sg.aliexpress.com/sync', { params });
        const products = response.data?.ae_open_api_product_query_response?.result?.products || [];

        console.log(`התקבלו ${products.length} מוצרים גולמיים מאלי אקספרס.`);

        // סינון צניעות הרמטי
        const safeProducts = products.filter(product => {
            const title = (product.product_title || "").toLowerCase();
            return !FORBIDDEN.some(word => title.includes(word));
        });

        if (safeProducts.length > 0) {
            const selected = safeProducts[0];
            console.log("✅ נמצא מוצר כשר ומתאים: " + selected.product_title);
            // כאן תוכל להוסיף פקודת שליחה לטלגרם (bot.sendMessage)
            return selected;
        }

        console.warn("⚠️ לא נמצאו מוצרים שעברו את סינון הצניעות בסבב זה.");
        return null;

    } catch (error) {
        console.error("❌ שגיאה בחיבור ל-API:", error.message);
        return null;
    }
}

// --- ניהול לוח זמנים (Cron Jobs) לפי בקשתך ---

// 1. ימים א'-ה': כל 20 דקות בין 10:00 ל-23:00
cron.schedule('*/20 10-23 * * 0-4', () => {
    fetchAndProcessProducts();
});

// 2. יום שישי: כל 20 דקות בין 10:00 ל-14:00 (שמירת שבת)
cron.schedule('*/20 10-13 * * 5', () => {
    fetchAndProcessProducts();
});

// 3. מוצאי שבת: כל 20 דקות בין 22:00 ל-23:00
cron.schedule('*/20 22-23 * * 6', () => {
    fetchAndProcessProducts();
});

// דף נחיתה לבדיקת סטטוס ב-Railway
app.get('/', async (req, res) => {
    res.send("הבוט פעיל ומתוזמן (כולל הפסקות שבת וסינון צניעות).");
});

app.listen(PORT, () => {
    console.log(`🚀 השרת רץ על פורט ${PORT}. מנוע הזמנים הופעל.`);
});
