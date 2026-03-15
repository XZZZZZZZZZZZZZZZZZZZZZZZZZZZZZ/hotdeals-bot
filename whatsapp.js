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
    // תיקון קריטי לשגיאות Timeout בשרת
    authTimeoutMs: 60000,
    qrMaxRetries: 10,
    takeoverOnConflict: true,
    protocolTimeout: 60000 
});

client.on('qr', (qr) => {
    qrcode.generate(qr, { small: true });
    console.log('--- סרוק את הקוד כדי להתחבר ---');
});

client.initialize();

module.exports = client;
