const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const puppeteer = require("puppeteer");

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    // התיקון הקריטי לשרת של Koyeb:
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
  console.log("סרוק את ה-QR:");
  qrcode.generate(qr, { small: true });
});

client.on("ready", () => {
  console.log("וואטסאפ מחובר!");
});

client.initialize();

module.exports = client;
