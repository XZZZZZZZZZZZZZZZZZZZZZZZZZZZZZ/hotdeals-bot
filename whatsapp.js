const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        // הוספת הגדרות יציבות לשרתים חלשים
        protocolTimeout: 0, // מבטל את זמן הקצוב שגרם לשגיאה שלך
        executablePath: process.env.CHROME_PATH || null,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu',
            '--disable-extensions'
        ]
    }
});

client.on('qr', (qr) => {
    qrcode.generate(qr, {small: true});
    const qrLink = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(qr)}&size=300x300`;
    console.log('--------------------------------------------------');
    console.log('🔗 קישור לסריקה נוחה בדפדפן:');
    console.log(qrLink);
    console.log('--------------------------------------------------');
});

client.on('ready', () => {
    console.log('✅ הבוט מחובר ומוכן לעבודה!');
});

client.on('authenticated', () => {
    console.log('🔐 החיבור אומת בהצלחה');
});

client.initialize().catch(err => console.error('❌ שגיאה באתחול הבוט:', err));

module.exports = client;
