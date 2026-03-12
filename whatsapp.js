const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

// הגדרות הלקוח - חסכוני במשאבים כדי למנוע קריסות
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        executablePath: '/usr/bin/google-chrome-stable',
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

// הגדרת QR משופרת ללוגים
client.on('qr', (qr) => {
    console.log('--- סרוק את הקוד למטה ---');
    // inverse: true הופך צבעים כדי שהטלפון יזהה את זה על רקע שחור
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
