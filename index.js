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
      protocolTimeout: 300000, 
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] 
    }
});

waClient.on("qr", (qr) => {
    qrcode.generate(qr, { small: true });
    const qrLink = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(qr)}`;
    console.log("\n🔗 קישור לברקוד:\n" + qrLink + "\n");
});

waClient.on("ready", () => console.log("✅ הבוט מחובר לוואטסאפ בהצלחה!"));
waClient.initialize();

const SENT_FILE = "sent_products.json";
let sentProducts = new Set();
if (fs.existsSync(SENT_FILE)) {
  sentProducts = new Set(JSON.parse(fs.readFileSync(SENT_FILE)));
}

let lastKeyword = null;
let postCounter = 0;
let keywordPages = {};

function getNextKeyword() {
  try {
    const data = JSON.parse(fs.readFileSync(KEYWORDS_FILE, "utf-8"));
    const keywords = data.keywords;
    let selected;
    do { selected = keywords[Math.floor(Math.random() * keywords.length)]; } while (selected === lastKeyword);
    lastKeyword = selected;
    return selected;
  } catch (err) { return "gadgets"; }
}

function generateSign(params) {
  const sorted = Object.keys(params).sort();
  let base = APP_SECRET;
  sorted.forEach(key => base += key + params[key]);
  base += APP_SECRET;
  return crypto.createHash("md5").update(base).digest("hex").toUpperCase();
}

async function generateMarketingText(title, price) {
  if (!openai) return `🔥 דיל חדש!\n\n${title}\n\n💰 מחיר: ₪${price}`;
  try {
    const prompt = `
משימה: כתוב פוסט שיווקי קצר וזורם בעברית לדיל מעליאקספרס.
חוק ברזל: אל תכתוב מילות תיאור כמו "כותרת:", "מה המוצר עושה:", "יתרונות:" או "סיום:". רק את הטקסט נטו!

מבנה נדרש:
1. משפט פתיחה מלהיב שכולל אייקון מתאים.
2. משפט קצר שמסביר בצורה זורמת למה צריך את המוצר הזה.
3. 4 יתרונות בלבד (כל אחד מתחיל באייקון ✅).
4. סיום קצר ומזמין.

💥 מחיר: ${price}₪ בלבד! 💥
שם המוצר: ${title}
`;
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7
    });
    return completion.choices[0].message.content;
  } catch { return `🔥 דיל חדש!\n\n${title}\n\n💰 מחיר: ₪${price}`; }
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

  while (!foundDeal && pagesSearched < 5) {
    const currentPage = keywordPages[currentKeyword];
    const params = {
      app_key: APP_KEY, method: "aliexpress.affiliate.product.query", timestamp: Date.now(),
      format: "json", v: "2.0", sign_method: "md5", keywords: currentKeyword,
      page_no: currentPage, tracking_id: TRACKING_ID, ship_to_country: "IL",
      target_currency: "ILS", target_language: "HE", sort: "SALE_PRICE_ASC"
    };
    params.sign = generateSign(params);

    try {
      const response = await axios.get("https://api-sg.aliexpress.com/sync", { params });
      const products = response.data?.aliexpress_affiliate_product_query_response?.resp_result?.result?.products?.product;

      if (!products?.length) { keywordPages[currentKeyword] = 1; break; }

      let selectedProduct = null;
      let affiliateLink = null;

      for (const product of products) {
        if (sentProducts.has(product.product_id)) continue;
        const price = parseFloat(product.target_app_sale_price?.toString().split("-")[0]);
        if (!price || price < 10 || price > 250) continue;
        if (product.sale_volume < 50) continue;

        const linkParams = {
          app_key: APP_KEY, method: "aliexpress.affiliate.link.generate", timestamp: Date.now(),
          format: "json", v: "2.0", sign_method: "md5", source_values: product.product_detail_url,
          tracking_id: TRACKING_ID, promotion_link_type: 2
        };
        linkParams.sign = generateSign(linkParams);
        const linkRes = await axios.get("https://api-sg.aliexpress.com/sync", { params: linkParams });
        const link = linkRes.data?.aliexpress_affiliate_link_generate_response?.resp_result?.result?.promotion_links?.promotion_link?.[0]?.promotion_link;

        if (link) {
          selectedProduct = product;
          affiliateLink = link;
          sentProducts.add(product.product_id);
          fs.writeFileSync(SENT_FILE, JSON.stringify([...sentProducts]));
          break;
        }
      }

      if (selectedProduct && affiliateLink) {
        foundDeal = true;
        const finalPrice = Math.floor(parseFloat(selectedProduct.target_app_sale_price?.toString().split("-")[0]) * 100) / 100;
        const messageBodyText = await generateMarketingText(selectedProduct.product_title, finalPrice);
        const resizedImage = `https://images.weserv.nl/?w=400&url=${selectedProduct.product_main_image_url.replace("https://", "")}`;

        await sendToChannel(`![](${resizedImage})\n\n${messageBodyText}\n\n🛒 לינק לרכישה:\n${affiliateLink}`);
        
        try {
          // הפקודה שפותרת את בעיית התמונה בוואטסאפ!
          const media = await MessageMedia.fromUrl(resizedImage, { unsafeMime: true });
          await waClient.sendMessage(WA_CHAT_ID, media, { caption: `${messageBodyText}\n\n🛒 לינק לרכישה:\n${affiliateLink}` });
          console.log("✅ נשלח בהצלחה לוואטסאפ עם תמונה!");
        } catch (waErr) {
          await waClient.sendMessage(WA_CHAT_ID, `${messageBodyText}\n\n🛒 לינק לרכישה:\n${affiliateLink}`);
        }
      } else {
        keywordPages[currentKeyword]++;
        pagesSearched++;
      }
    } catch (err) { break; }
  }
}

cron.schedule("*/20 8-23 * * 0-4", fetchDeal);
cron.schedule("*/20 8-14 * * 5", fetchDeal);
cron.schedule("*/20 22-23 * * 6", fetchDeal);
cron.schedule("*/20 0-1 * * 0", fetchDeal);

setTimeout(fetchDeal, 60000);
setInterval(() => {}, 1000);
