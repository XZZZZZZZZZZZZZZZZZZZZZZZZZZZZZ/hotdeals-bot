const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

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
            '--no-zygote'
        ],
    }
});

client.on('qr', (qr) => {
    console.log('--- הנה הקוד! אם הוא נראה מפוזר, הקטן את המסך ---');
    // הוספנו true כאן כדי להכריח את ה-QR להיות קטן וברור יותר
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('✅ מחובר בהצלחה!');
});

console.log('מנסה להפעיל את הדפדפן... המתן 2 דקות');
client.initialize().catch(err => console.log('שגיאת אתחול:', err));

module.exports = client;
