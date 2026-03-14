const whatsapp = require('./whatsapp');
const axios = require('axios');
const cron = require('node-cron');

// הגדרות
const GROUP_ID = "YOUR_GROUP_ID_HERE"; // כאן תדביק את ה-ID שתקבל מהבוט
const CHANNEL_API_URL = "https://dilim.clickandgo.cfd/api/import/post";
const API_KEY = "987654321";

async function fetchDeal() {
    console.log("מבצע חיפוש דיל ושליחה...");
    try {
        // כאן הלוגיקה שלך למציאת מוצר (למשל מאליאקספרס)
        const marketingText = "דיל חדש ומטורף! 🛍️";
        const affiliateLink = "https://s.click.aliexpress.com/e/example";
        
        const fullMessage = `${marketingText}\n\n🛒 לרכישה: ${affiliateLink}`;

        // 1. שליחה לאתר שלך
        await axios.post(CHANNEL_API_URL, {
            api_key: API_KEY,
            content: fullMessage
        });

        // 2. שליחה לקבוצת הוואטסאפ (רק אם הגדרת ID)
        if (GROUP_ID !== "YOUR_GROUP_ID_HERE") {
            await whatsapp.sendMessage(GROUP_ID, fullMessage);
            console.log("הדיל נשלח לוואטסאפ!");
        }

    } catch (error) {
        console.error("שגיאה בשליחה:", error.message);
    }
}

// תזמון שליחה (כל 20 דקות)
cron.schedule('*/20 8-23 * * *', () => {
    fetchDeal();
});

// שליחה בבדיקה כשהבוט עולה
whatsapp.on('ready', () => {
    fetchDeal();
});
