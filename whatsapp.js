const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");

let ready = false;

const client = new Client({
  authStrategy: new LocalAuth({
    clientId: "deals-bot"
  }),
  puppeteer: {
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--no-first-run",
      "--no-zygote",
      "--single-process"
    ]
  }
});

client.on("qr", qr => {
  console.log("סרוק את ה-QR כדי לחבר את WhatsApp:");
  qrcode.generate(qr, { small: true });
});

client.on("ready", () => {
  ready = true;
  console.log("WhatsApp מחובר");
});

client.on("disconnected", () => {
  ready = false;
  console.log("WhatsApp התנתק");
});

client.initialize();

async function sendWhatsApp(message) {
  if (!ready) {
    console.log("WhatsApp עדיין לא מחובר");
    return;
  }

  try {
    const groupId = "PUT_GROUP_ID_HERE";
    await client.sendMessage(groupId, message);
    console.log("נשלח ל-WhatsApp");
  } catch (err) {
    console.log("שגיאה בשליחה ל-WhatsApp:", err.message);
  }
}

module.exports = { sendWhatsApp };
