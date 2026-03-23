process.env.TZ = "Asia/Jerusalem";

const axios = require("axios");
const crypto = require("crypto");
const cron = require("node-cron");
const fs = require("fs");
const { Client, LocalAuth, MessageMedia } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");

let openai = null;

if (process.env.OPENAI_API_KEY) {
  const OpenAI = require("openai");
  openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

const APP_KEY = process.env.ALI_APP_KEY;
const APP_SECRET = process.env.ALI_APP_SECRET;
const TRACKING_ID = process.env.ALI_TRACKING_ID;

const CHANNEL_API_URL = "https://dilim.clickandgo.cfd/api/import/post";
const API_KEY = "987654321";

const WA_CHAT_ID = "120363407216029255@g.us"; 
const KEYWORDS_FILE = "keywords.json";

const waClient = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: { 
      headless: true,
      timeout: 300000, 
      protocolTimeout: 300000, 
      args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ] 
    }
});

waClient.on("qr", (qr) => {
    qrcode.generate(qr, { small: true });
    const qrLink = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(qr)}`;
    console.log("\n🔗 קישור לברקוד:\n" + qrLink + "\n");
});

waClient.on("ready", () => {
    console.log("✅ הבוט מחובר לוואטסאפ בהצלחה!");
});

waClient.on("auth_failure", msg => {
    console.error("❌ שגיאה באימות הוואטסאפ:", msg);
});

waClient.initialize();

const SENT_FILE = "sent_products.json";
let sentProducts = new Set();

if (fs.existsSync(SENT_FILE)) {
  const data = JSON.parse(fs.readFileSync(SENT_FILE));
  sentProducts = new Set(data);
}

let lastKeyword = null;
let postCounter = 0;
let keywordPages = {};

function getNextKeyword() {
  try {
    if (!fs.existsSync(KEYWORDS_FILE)) return "gadgets";
    const data = fs.readFileSync(KEYWORDS_FILE, "utf-8");
    const parsedData = JSON.parse(data);
    const keywords = parsedData.keywords;
    if (!keywords || keywords.length === 0) return "gadgets";
    let selected;
    do {
      selected = keywords[Math.floor(Math.random() * keywords.length)];
    } while (selected === lastKeyword && keywords.length > 1);
    lastKeyword = selected;
    return selected;
  } catch (err) {
    return "gadgets"; 
  }
}

function generateSign(params) {
  const sorted = Object.keys(params).sort();
  let base = APP_SECRET;
  sorted.forEach(key => { base += key + params[key]; });
  base += APP_SECRET;
  return crypto.createHash("md5").update(base).digest("hex").toUpperCase();
}

function extractLowestPrice(product) {
  let price = product.target_app_sale_price || "0";
  return parseFloat(price.toString().split("-")[0]);
}

async function generateAffiliateLink(originalUrl) {
  const params = {
    app_key: APP_KEY,
    method: "aliexpress.affiliate.link.generate",
    timestamp: Date.now(),
    format: "json",
    v: "2.0",
    sign_method: "md5",
    source_values: originalUrl,
    tracking_id: TRACKING_ID,
    promotion_link_type: 2
  };
  params.sign = generateSign(params);
  const response = await axios.get("https://api-sg.aliexpress.com/sync", { params });
  return response.data?.aliexpress_affiliate_link_generate_response?.resp_result?.result?.promotion_links?.promotion_link?.[0]?.promotion_link || null;
}

async function generateMarketingText(title, price) {
  if (!openai) return `🔥 דיל חדש!\n\n${title}\n\n💥 מחיר: ${price}₪ בלבד! 💥`;
  try {
    const prompt = `כתוב פוסט שיווקי קצר וזורם בעברית לדיל מעליאקספרס. בלי מילות כותרת. 4 יתרונות עם ✅. מחיר בסוף בפורמט: 💥 מחיר: ${price}₪ בלבד! 💥 מוצר: ${title}`;
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.8
    });
    return completion.choices[0].message.content;
  } catch {
    return `🔥 דיל חדש!\n\n${title}\n\n💥 מחיר: ${price}₪ בלבד! 💥`;
  }
}

async function sendToChannel(text) {
  try {
    await axios.post(CHANNEL_API_URL, { text, author: "Deals Bot", timestamp: new Date().toISOString() },
      { headers: { "Content-Type": "application/json", "X-API-Key": API_KEY } });
  } catch (err) { console.log("❌ שגיאה בערוץ"); }
}

async function fetchDeal() {
  console.log("=== חיפוש דיל חדש ===");
  postCounter++;
  const currentKeyword = getNextKeyword();
  if (!keywordPages[currentKeyword]) keywordPages[currentKeyword] = 1;

  let foundDeal = false;
  let pagesSearched = 0;
  const MAX_PAGES = 50; 

  while (!foundDeal && pagesSearched < MAX_PAGES) {
    const currentPage = keywordPages[currentKeyword];
    const params = {
      app_key: APP_KEY, method: "aliexpress.affiliate.product.query", timestamp: Date.now(),
      format: "json", v: "2.0", sign_method: "md5", keywords: currentKeyword,
      page_no: currentPage, tracking_id: TRACKING_ID, ship_to_country: "IL",
      target_currency: "ILS", target_language: "HE", sort: "SALE_PRICE_ASC"
    };
    params.sign = generateSign(params);

    try {
      const res = await axios.get("https://api-sg.aliexpress.com/sync", { params });
      const products = res.data?.aliexpress_affiliate_product_query_response?.resp_result?.result?.products?.product;
      if (!products?.length) { keywordPages[currentKeyword] = 1; break; }

      for (const product of products) {
        if (sentProducts.has(product.product_id)) continue;
        const price = extractLowestPrice(product);
        if (price < 10 || price > 300 || product.sale_volume < 50) continue;

        const link = await generateAffiliateLink(product.product_detail_url);
        if (link) {
          foundDeal = true;
          const finalPrice = Math.floor(price * 100) / 100;
          const body = await generateMarketingText(product.product_title, finalPrice);
          const img = `https://images.weserv.nl/?w=400&url=${product.product_main_image_url.replace("https://", "")}`;

          await sendToChannel(`![](${img})\n\n${body}\n\n🛒 לינק:\n${link}`);
          try {
            const media = await MessageMedia.fromUrl(img, { unsafeMime: true });
            await waClient.sendMessage(WA_CHAT_ID, media, { caption: `${body}\n\n🛒 לינק:\n${link}` });
          } catch { await waClient.sendMessage(WA_CHAT_ID, `${body}\n\n🛒 לינק:\n${link}`); }
          
          sentProducts.add(product.product_id);
          fs.writeFileSync(SENT_FILE, JSON.stringify([...sentProducts]));
          break;
        }
      }
      if (!foundDeal) { keywordPages[currentKeyword]++; pagesSearched++; }
    } catch (err) { break; }
  }
}

const cronOptions = { timezone: "Asia/Jerusalem" };
cron.schedule("*/20 8-23 * * 0-4", fetchDeal, cronOptions);
cron.schedule("*/20 8-14 * * 5", fetchDeal, cronOptions);
cron.schedule("*/20 22-23 * * 6", fetchDeal, cronOptions);
cron.schedule("*/20 0-1 * * 0", fetchDeal, cronOptions);

cron.schedule("0 3 * * *", () => { process.exit(1); }, cronOptions);

setTimeout(fetchDeal, 60000);
setInterval(() => {}, 1000);

// --- סוף הקוד ---
