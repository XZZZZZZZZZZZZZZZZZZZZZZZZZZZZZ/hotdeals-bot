const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const client = new Client({
    authStrategy: new LocalAuth(),
    authTimeoutMs: 0, // מבטל את הגבלת זמן האימות
    qrMaxRetries: 10,
    puppeteer: {
        headless: true,
        executablePath: '/usr/bin/google-chrome-stable',
        protocolTimeout: 0, // מבטל את הגבלת זמן התקשורת עם הדפדפן
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--no-zygote',
            '--single-process',
            '--disable-software-rasterizer',
            '--disable-extensions',
            '--memory-pressure-off'
        ],
    }
});

// הצגת ה-QR בצורה אופטימלית
client.on('qr', (qr) => {
    console.log('--- QR RECEIVED: סרוק עכשיו ---');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('✅ וואטסאפ מחובר ומוכן לעבודה!');
});

client.on('auth_failure', (msg) => {
    console.error('❌ שגיאת אימות:', msg);
});

console.log('1. מתחיל את תהליך האתחול של הדפדפן...');
console.log('2. בשרת איטי זה עשוי לקחת מספר דקות, אנא המתן בסבלנות.');

client.initialize().catch(err => {
    console.error('❌ שגיאה קריטית באתחול:', err.message);
    // ניסיון אתחול חוזר אוטומטי במקרה של קריסה
    setTimeout(() => client.initialize(), 10000);
});

module.exports = client;
