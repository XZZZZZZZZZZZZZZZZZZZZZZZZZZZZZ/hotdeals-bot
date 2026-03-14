const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        handleSIGTERM: false,
        handleSIGINT: false
    }
});

client.on('qr', (qr) => {
    console.log('סרוק את קוד ה-QR הבא ב-Logs של Koyeb:');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('✅ וואטסאפ מחובר ומוכן!');
});

client.initialize();

// השורה הזו היא מה שגורם לשורה 7 ב-index.js לעבוד!
module.exports = client;
