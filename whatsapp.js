const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const client = new Client({
    // שימוש בתיקייה זמנית כדי למנוע בעיות הרשאות בשרת
    authStrategy: new LocalAuth({
        dataPath: '/tmp/.wwebjs_auth'
    }),
    puppeteer: {
        headless: true,
        // משתמש בדפדפן שהתקנו בשרת דרך המשתנים שהוספנו
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu'
        ],
    }
});

// הצגת ה-QR בלוגים
client.on('qr', (qr) => {
    console.log('סרוק את קוד ה-QR הבא ב-View Logs:');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('הוואטסאפ מחובר בהצלחה בשרת!');
});

// טיפול בשגיאות כדי שהשרת לא יקרוס מיד
client.on('auth_failure', msg => {
    console.error('שגיאת אימות:', msg);
});

client.initialize();

module.exports = client;
