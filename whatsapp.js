const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

// הגדרות הלקוח עם דגש על חיסכון במשאבים
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--no-first-run',
            '--no-zygote',
            '--single-process'
        ],
    }
});

// הדפסת QR קטן יותר - בדרך כלל נסרק הרבה יותר טוב ב-Railway
client.on('qr', (qr) => {
    console.log('סרוק את קוד ה-QR המופיע כאן למטה:');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('הוואטסאפ מחובר בהצלחה!');
});

client.on('auth_failure', (msg) => {
    console.error('שגיאת התחברות:', msg);
});

client.initialize();

module.exports = client;
