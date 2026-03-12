const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

// הגדרות הלקוח עם תיקוני נתיב וזמן המתנה (Timeout)
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        executablePath: '/usr/bin/google-chrome-stable',
        protocolTimeout: 0, // מבטל את מגבלת הזמן כדי למנוע שגיאות פרוטוקול
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--no-zygote',
            '--single-process'
        ],
    }
});

// הצגת ה-QR בלוגים של השרת
client.on('qr', (qr) => {
    console.log('--- QR RECEIVED: סרוק את הקוד למטה ---');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('הוואטסאפ מחובר ומוכן לעבודה!');
});

client.on('auth_failure', (msg) => {
    console.error('שגיאת התחברות לוואטסאפ:', msg);
});

console.log('מאתחל את הלקוח, אנא המתן לעליית הדפדפן...');
client.initialize();

module.exports = client;
