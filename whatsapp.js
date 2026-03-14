const { Client, LocalAuth } = require("whatsapp-web.js");

const client = new Client({
    authStrategy: new LocalAuth(),
    qrMaxRetries: 15,
    authTimeoutMs: 90000, // הגדלנו לדקה וחצי כדי למנוע כשלים
    puppeteer: {
        executablePath: '/usr/bin/google-chrome-stable',
        headless: true,
        args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-gpu",
            "--no-zygote",
            "--single-process"
        ]
    }
});

client.on("qr", (qr) => {
    // יצירת קישור נקי שנסרק בקלות
    const cleanQRUrl = `https://api.qrserver.com/v1/create-qr-code/?size=350x350&data=${encodeURIComponent(qr)}`;
    
    console.log("\n--- צעד לחיבור הוואטסאפ ---");
    console.log("1. פתח את הקישור הבא בדפדפן:");
    console.log(cleanQRUrl);
    console.log("2. סרוק את הקוד שמופיע שם מיד.");
    console.log("---------------------------\n");
});

client.on("ready", () => {
    console.log("✅ וואטסאפ מחובר בהצלחה!");
});

client.on("disconnected", (reason) => {
    console.log("וואטסאפ התנתק:", reason);
});

client.initialize();

module.exports = client;
