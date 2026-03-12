const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

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
            '--disable-setuid-sandbox',
            '--no-first-run',
            '--no-default-browser-check',
            '--disable-extensions'
        ],
    }
});

client.on('qr', (qr) => {
    console.log('--- QR RECEIVED ---');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('✅ וואטסאפ מחובר!');
});

// הוספת לוג כדי לראות איפה זה נתקע בדיוק
console.log('1. מתחיל את תהליך האתחול...');

client.initialize().then(() => {
    console.log('2. האתחול הסתיים, מחכה ל-QR או לחיבור...');
}).catch(err => {
    console.error('❌ שגיאה באתחול:', err);
});

module.exports = client;
