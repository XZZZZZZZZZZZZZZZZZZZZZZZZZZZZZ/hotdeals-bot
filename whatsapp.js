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
    authTimeoutMs: 120000, // הגדלתי ל-2 דקות
    qrMaxRetries: 10,
    takeoverOnConflict: true,
    protocolTimeout: 120000 // התיקון הקריטי לשגיאה שראית
});

client.on('qr', (qr) => {
    qrcode.generate(qr, { small: true });
    const qrLink = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(qr)}`;
    console.log('--------------------------------------------------');
    console.log('🔗 קישור לסריקה:');
    console.log(qrLink);
    console.log('--------------------------------------------------');
});

client.initialize();

module.exports = client;
