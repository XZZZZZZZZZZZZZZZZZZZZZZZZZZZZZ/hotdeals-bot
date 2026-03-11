const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: '/tmp/.wwebjs_auth'
    }),
    puppeteer: {
        headless: true,
        // מחקנו מכאן את השורה שחיפשה את הנתיב לדפדפן!
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu'
        ]
    }
});

client.on('qr', (qr) => {
    console.log('--- סרוק את קוד ה-QR המופיע כאן למטה ---');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('הוואטסאפ מחובר בהצלחה בשרת החדש!');
});

client.on('auth_failure', msg => {
    console.error('שגיאת אימות:', msg);
});

client.initialize();

module.exports = client;
