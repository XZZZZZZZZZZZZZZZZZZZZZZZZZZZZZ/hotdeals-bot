const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");

const client = new Client({
  authStrategy: new LocalAuth(),
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
  // זה הקישור שיצר לך תמונה אמיתית ונקייה של ה-QR
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qr)}`;
  
  console.log("------------------------------------------");
  console.log("סרוק את ה-QR מהקישור הבא:");
  console.log(qrImageUrl);
  console.log("------------------------------------------");
  
  // משאיר את הישן רק לגיבוי למטה
  qrcode.generate(qr, { small: true });
});

client.on("ready", () => {
  console.log("וואטסאפ מחובר בהצלחה!");
});

client.initialize();

module.exports = client;
