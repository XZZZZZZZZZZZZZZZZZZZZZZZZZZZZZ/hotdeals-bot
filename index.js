const axios = require('axios');
const cheerio = require('cheerio');

async function scrapeDeals() {
    try {
        // הכתובת של האתר שבו נמצאים המבצעים
        const url = 'https://www.example-deals-site.co.il'; 
        
        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });

        // טעינת הקוד של הדף לתוך Cheerio
        const $ = cheerio.load(data);
        const deals = [];

        // כאן צריך להגדיר את ה"סלקטור" - מה מחפשים בדף?
        // למשל: כל אלמנט עם קלאס של מוצר
        $('.product-card').each((index, element) => {
            const title = $(element).find('.title').text().trim();
            const price = $(element).find('.price').text().trim();
            
            deals.push({ title, price });
        });

        if (deals.length > 0) {
            console.log(`נמצאו ${deals.length} מבצעים חדשים!`);
            console.log(deals.slice(0, 3)); // מציג את 3 הראשונים לבדיקה
        } else {
            console.log('לא נמצאו מבצעים. ייתכן שהסלקטורים השתנו.');
        }

    } catch (error) {
        console.error('שגיאה בסריקת האתר:', error.message);
    }
}

// הרצה
scrapeDeals();
