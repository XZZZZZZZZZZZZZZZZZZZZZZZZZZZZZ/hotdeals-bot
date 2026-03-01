const axios = require('axios');

// פונקציה ליצירת השהיה אקראית (כדי למנוע זיהוי כבוט)
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchHotDeals() {
    try {
        // הוספת השהיה אקראית של 5-15 שניות לפני כל פנייה
        const delay = Math.floor(Math.random() * 10000) + 5000;
        console.log(`ממתין ${delay/1000} שניות כדי למנוע חסימה...`);
        await sleep(delay);

        const url = 'YOUR_API_ENDPOINT_HERE'; // כאן שים את הכתובת של ה-API
        
        const response = await axios.get(url, {
            headers: {
                // User-Agent שמדמה דפדפן Chrome רגיל על Windows
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept': 'application/json',
                'Referer': 'https://google.com' // מקור הגעה שנראה טבעי
            }
        });

        const products = response.data;
        
        if (products && products.length > 0) {
            console.log(`הצלחה! נמצאו ${products.length} מוצרים.`);
            // כאן תוכל להמשיך את הלוגיקה של הבוט שלך
        } else {
            console.log('תוצאה מה-API: התקבלו 0 מוצרים. ייתכן שיש לעדכן את פרמטרי החיפוש.');
        }

    } catch (error) {
        console.error('שגיאה בקריאת ה-API:', error.message);
        if (error.response && error.response.status === 403) {
            console.log('אזהרה: השרת חסם את הבקשה (403 Forbidden). כדאי להגדיל את מרווחי הזמן.');
        }
    }
}

// הרצה במרווחי זמן של שעה עם "סטייה" אקראית
setInterval(fetchHotDeals, 3600000 + (Math.random() * 300000));

// הרצה ראשונית
fetchHotDeals();
