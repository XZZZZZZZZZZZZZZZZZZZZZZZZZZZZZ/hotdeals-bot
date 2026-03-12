const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

// הגדרות הלקוח - כולל תיקון ה-Timeout והנתיב לדפדפן
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
            '--single-process'
        ],
    }
});

// הצגת ה-QR בלוגים
client.on('qr', (qr) => {
    console.log('--- סרוק את הקוד למטה ---');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('הוואטסאפ מחובר ומוכן!');
});

client.on('auth_failure', (msg) => {
    console.error('שגיאת התחברות:', msg);
});

client.initialize();

module.exports = client;
