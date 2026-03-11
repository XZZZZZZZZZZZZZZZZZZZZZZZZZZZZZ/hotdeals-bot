const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const client = new Client({
    // שימוש בתיקייה זמנית לכתיבת נתוני ההתחברות בשרת
    authStrategy: new LocalAuth({
        dataPath: '/tmp/.wwebjs_auth'
    }),
    puppeteer: {
        headless: true,
        // התיקון הקריטי: מחפש קודם כל את המשתנה מה-Railway ואז את כרום שהתקנו ב-Nixpacks
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || 'google-chrome-stable',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu'
        ],
    }
});

// הצגת קוד ה-QR בלוגים של Railway
client.on('qr', (qr) => {
    console.log('סרוק את קוד ה-QR הבא ב-View Logs:');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('הוואטסאפ מחובר בהצלחה בשרת!');
});

// טיפול בשגיאות התחברות
client.on('auth_failure', msg => {
    console.error('שגיאת אימות:', msg);
});

client.initialize();

module.exports = client;
