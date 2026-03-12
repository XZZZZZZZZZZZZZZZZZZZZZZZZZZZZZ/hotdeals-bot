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
            '--disable-extensions',
            '--no-first-run'
        ],
    }
});

client.on('qr', (qr) => {
    console.log('--- QR RECEIVED ---');
    qrcode.generate(qr, { small: true });
    console.log('סרוק את הקוד שלמעלה כדי להתחבר');
});

client.on('ready', () => {
    console.log('הוואטסאפ מחובר ומוכן!');
});

client.on('auth_failure', (msg) => {
    console.error('שגיאת אימות:', msg);
});

console.log('מאתחל את הלקוח... זה עשוי לקחת כמה דקות ב-Koyeb');
client.initialize().catch(err => console.error('שגיאה באתחול:', err));

module.exports = client;
