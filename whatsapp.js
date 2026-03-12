const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

// הגדרות הלקוח עם תיקוני נתיב, ביטול Timeout ו-Args משופרים
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        executablePath: '/usr/bin/google-chrome-stable',
        protocolTimeout: 0, 
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--no-zygote',
            '--single-process',
            '--hide-scrollbars',
            '--disable-notifications',
            '--disable-extensions',
            '--no-first-run'
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

console.log('מאתחל את הלקוח, אנא המתן לעליית הדפדפן (זה עשוי לקחת 2-3 דקות)...');
client.initialize();

module.exports = client;
