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
            '--disable-extensions'
        ],
    },
    authTimeoutMs: 60000,
    qrMaxRetries: 10,
    takeoverOnConflict: true,
    protocolTimeout: 60000 
});

client.on('qr', (qr) => {
    // מדפיס לטרמינל ליתר ביטחון
    qrcode.generate(qr, { small: true });
    
    // מייצר קישור חיצוני שניתן לסרוק בקלות מהדפדפן
    const qrLink = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(qr)}`;
    console.log('--------------------------------------------------');
    console.log('🔗 קישור לסריקת ה-QR (תעתיק ותדביק בדפדפן):');
    console.log(qrLink);
    console.log('--------------------------------------------------');
});

client.initialize();

module.exports = client;
