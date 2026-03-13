const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const client = new Client({
    authStrategy: new LocalAuth(),
    // הגדרה קריטית למניעת ה-Timeout שקרה לך
    authTimeoutMs: 0, 
    qrMaxRetries: 10,
    puppeteer: {
        headless: true,
        executablePath: '/usr/bin/google-chrome-stable',
        // ביטול הגבלת זמן לחלוטין
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

client.on('qr', (qr) => {
    console.log('--- הקוד הגיע! סרוק עכשיו ---');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('✅ וואטסאפ מחובר ומוכן!');
});

// לוג כדי שנדע שהתהליך רץ ולא תקוע
console.log('מנסה להפעיל את הדפדפן... זה יכול לקחת כמה דקות, אל תתייאש.');

client.initialize().catch(err => {
    console.error('שגיאה באתחול (מנסה שוב...):', err.message);
    // ניסיון אתחול חוזר במקרה של כישלון
    setTimeout(() => client.initialize(), 5000);
});

module.exports = client;
