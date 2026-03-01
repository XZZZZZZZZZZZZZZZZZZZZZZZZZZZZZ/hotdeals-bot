const axios = require('axios');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchHotDeals() {
    try {
        // מנגנון המתנה למניעת חסימות (עובד לפי הלוג שלך!)
        const delay = Math.floor(Math.random() * 10000) + 5000;
        console.log(`ממתין ${(delay/1000).toFixed(3)} שניות כדי למנוע חסימה...`);
        await sleep(delay);

        // --- חשוב: החלף את הכתובת למטה בכתובת ה-API האמיתית שלך ---
        const url = 'https://api.example.com/deals'; // שים כאן את הלינק המדויק
        
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept': 'application/json'
            }
        });

        if (response.data && response.data.length > 0) {
            console.log(`הצלחה! נמצאו ${response.data.length} מוצרים.`);
        } else {
            console.log('תוצאה מה-API: התקבלו 0 מוצרים.');
        }

    } catch (error) {
        if (error.code === 'ERR_INVALID_URL') {
            console.error('שגיאה: שכחת להזין כתובת URL תקינה בקוד!');
        } else {
            console.error('שגיאה בקריאת ה-API:', error.message);
        }
    }
}

// הרצה כל שעה
setInterval(fetchHotDeals, 3600000);
fetchHotDeals();
