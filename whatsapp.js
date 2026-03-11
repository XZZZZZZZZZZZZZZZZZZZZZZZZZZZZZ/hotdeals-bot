const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

// הגדרת הלקוח עם הגדרות מיוחדות לשרת (Railway)
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu'
        ],
        // בשרתים מסוימים צריך להוסיף את הנתיב לכרום, ב-Railway זה בדרך כלל לא חובה אם הגדרת nixpacks
    }
});

// הצגת קוד QR בלוגים של השרת
client.on('qr', (qr) => {
    console.log('סרוק את קוד ה-QR הבא כדי להתחבר:');
    qrcode.generate(qr, { small: true });
});

// הודעה כשהחיבור הצליח
client.on('ready', () => {
    console.log('וואטסאפ מחובר ומוכן לעבודה!');
});

// פונקציה להדפסת ה-ID של צ'אטים (כדי שתדע לאן לשלוח)
client.on('message', message => {
    if (message.body === 'בדיקה') {
        console.log('התקבלה הודעת בדיקה מ-ID:', message.from);
        message.reply('הבוט עובד!');
    }
});

client.initialize();

module.exports = client;
