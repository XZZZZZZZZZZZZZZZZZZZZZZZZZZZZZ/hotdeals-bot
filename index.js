const axios = require('axios');
require('dotenv').config();

// רשימת מילות מפתח לחסימה - ליתר ביטחון
const FORBIDDEN_KEYWORDS = ['woman', 'women', 'lady', 'girl', 'female', 'fashion', 'jewelry'];

async function fetchAndPostProduct() {
    try {
        console.log("מתחיל חיפוש מוצרים מותאם...");

        // 1. הגדרת מילת חיפוש בטוחה (למשל: כלי עבודה, גאדג'טים לבית, אביזרי רכב)
        const searchKeyword = "home tools gadgets"; 

        const response = await axios.get('https://gw.api.alibaba.com/openapi/param2/2/portals.open/api.listPromotionProduct', {
            params: {
                appKey: process.env.ALI_APP_KEY,
                fields: "productTitle,productUrl,salePrice,productMainImageUrl",
                keywords: searchKeyword,
                pageSize: 20 // מושכים יותר כדי שנוכל לסנן ידנית בקוד
            }
        });

        const allProducts = response.data?.result?.products || [];
        
        // 2. סינון מוצרים - מוודאים שהכותרת לא מכילה מילים לא מתאימות
        const safeProducts = allProducts.filter(product => {
            const title = product.productTitle.toLowerCase();
            return !FORBIDDEN_KEYWORDS.some(word => title.includes(word));
        });

        if (safeProducts.length === 0) {
            console.log("לא נמצאו מוצרים העונים לדרישות הסינון.");
            return;
        }

        // בוחרים את המוצר הראשון שעבר את הסינון
        const product = safeProducts[0];

        // 3. יצירת תיאור יפה והודעה
        const message = `
🌟 **מוצר חדש ומעניין שמצאתי עבורכם!** 🌟

📝 **תיאור:** ${product.productTitle}
💰 **מחיר:** ${product.salePrice}
🖼️ **תמונה:** ${product.productMainImageUrl}

🔗 **לרכישה דרך קישור השותפים שלי:**
${product.productUrl}&aff_id=${process.env.MY_AFFILIATE_ID}

---
*המבצע לזמן מוגבל!*
        `;

        // 4. שליחה לצ'אט (כאן אתה מחבר את ה-Bot API של הטלגרם או המערכת שלך)
        await sendToChat(message);
        
        console.log("המוצר הועלה בהצלחה לצ'אט!");

    } catch (error) {
        console.error("שגיאה בתהליך:", error.message);
    }
}

// פונקציה דמיונית לשליחה - תחליף אותה ב-API של הצ'אט שלך
async function sendToChat(text) {
    // דוגמה לשליחה לטלגרם:
    // await axios.post(`https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`, {
    //     chat_id: process.env.CHAT_ID,
    //     text: text,
    //     parse_mode: 'Markdown'
    // });
    console.log("הודעה נשלחה:\n", text);
}

// הפעלה
fetchAndPostProduct();
