const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");

const client = new Client({
  authStrategy: new LocalAuth(),
  qrMaxRetries: 10,
  authTimeoutMs: 60000,
  puppeteer: {
    executablePath: '/usr/bin/google-chrome-stable',
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--no-first-run",
      "--no-zygote",
      "--single-process"
    ]
  }
});

client.on("qr", (qr) => {
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qr)}`;
  
  console.log("---------------------------------------------------------");
  console.log("נא לסרוק את ה-QR מהקישור הבא (מומלץ!):");
  console.log(qrImageUrl);
  console.log("---------------------------------------------------------");
  
  // גיבוי של ה-QR בתוך הלוגים
  qrcode.generate(qr, { small: true });
});

client.on("ready", () => {
  console.log("וואטסאפ מחובר בהצלחה ומוכן לעבודה!");
});

client.on("auth_failure", (msg) => {
  console.error("שגיאת התחברות:", msg);
});

client.initialize();

module.exports = client;
