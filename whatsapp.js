const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const client = new Client({
    authStrategy: new LocalAuth() // זה שומר את החיבור שלא תצטרך לסרוק כל פעם
});

client.on('qr', (qr) => {
    qrcode.generate(qr, {small: true});
    console.log('סרוק את הקוד עם הוואטסאפ בטלפון:');
});

client.on('ready', () => {
    console.log('הבוט מחובר ומוכן!');
});

// פונקציה זמנית כדי לגלות את ה-ID של הקבוצה/מספר
client.on('message', message => {
    console.log(`הודעה התקבלה מ: ${message.from}`);
    console.log(`תוכן ההודעה: ${message.body}`);
});

client.initialize();

module.exports = client;
