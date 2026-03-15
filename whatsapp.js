const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu'
        ]
    }
});

client.on('qr', (qr) => {
    // 1. מדפיס את ה-QR כטקסט (בשביל הגיבוי)
    qrcode.generate(qr, {small: true});
    
    // 2. מייצר קישור שתוכל להעתיק ולפתוח בדפדפן כדי לראות את ה-QR כתמונה
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

client.on('auth_failure', msg => {
    console.error('❌ שגיאת אימות:', msg);
});

client.initialize();

module.exports = client;
