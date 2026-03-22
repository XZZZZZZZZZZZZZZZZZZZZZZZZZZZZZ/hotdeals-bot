process.env.TZ = "Asia/Jerusalem";

const axios = require("axios");
const crypto = require("crypto");
const cron = require("node-cron");
const fs = require("fs");
const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");

let openai = null;

if (process.env.OPENAI_API_KEY) {
  const OpenAI = require("openai");
  openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

const APP_KEY = process.env.ALI_APP_KEY;
const APP_SECRET = process.env.ALI_APP_SECRET;
const TRACKING_ID = process.env.ALI_TRACKING_ID;

// השרת שאליו נשלח המידע ראשון
const CHANNEL_API_URL = "https://dilim.clickandgo.cfd/api/import/post";
const API_KEY = "987654321";

// הגדרות וואטסאפ (ID הקבוצה שלך)
const WA_CHAT_ID = "120363407216029255@g.us"; 

// שם קובץ מילות המפתח
const KEYWORDS_FILE = "keywords.json";

// אתחול לקוח הוואטסאפ עם הגדרות חיסכון בזיכרון והארכת זמן המתנה
const waClient = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: { 
      headless: true,
      protocolTimeout: 300000, // <--- הפתרון לשגיאה! נותנים לו 5 דקות להתאמץ לפני שהוא מתייאש
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
    
    console.log("\n=========================================");
    console.log("🔗 הברקוד בטרמינל חתוך או לא נסרק? אין בעיה!");
    console.log("העתק את הקישור הבא והדבק אותו בדפדפן שלך כדי לראות ברקוד נורמלי וברור:");
    console.log(qrLink);
    console.log("=========================================\n");
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
    if (!fs.existsSync(KEYWORDS_FILE)) {
      console.log(`⚠️ הקובץ ${KEYWORDS_FILE} לא נמצא! משתמש במילת ברירת מחדל: gadgets`);
      return "gadgets";
    }

    const data = fs.readFileSync(KEYWORDS_FILE, "utf-8");
    const parsedData = JSON.parse(data);
    
    const keywords = parsedData.keywords;

    if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
      console.log(`⚠️ לא נמצאו מילים תחת "keywords" בקובץ ה-JSON!`);
      return "gadgets";
    }

    if (keywords.length === 1) {
      return keywords[0]; 
    }

    let selected;
    do {
      selected = keywords[Math.floor(Math.random() * keywords.length)];
    } while (selected === lastKeyword);

    lastKeyword = selected;
    return selected;

  } catch (err) {
    console.log(`❌ שגיאה בקריאת ${KEYWORDS_FILE}:`, err.message);
    return "gadgets"; 
  }
}

function generateSign(params) {
  const sorted = Object.keys(params).sort();
  let base = APP_SECRET;

  sorted.forEach(key => {
    base += key + params[key];
  });

  base += APP_SECRET;

  return crypto
    .createHash("md5")
    .update(base)
    .digest("hex")
    .toUpperCase();
}

function extractLowestPrice(product) {
  let price = product.target_app_sale_price;
  if (!price) return 0;
  price = price.toString();
  if (price.includes("-")) {
    price = price.split("-")[0];
  }
  return parseFloat(price);
}

async function translateTitle(title) {
  try {
    const res = await axios.get(
      "https://translate.googleapis.com/translate_a/single",
      {
        params: {
          client: "gtx",
          sl: "auto",
          tl: "he",
          dt: "t",
          q: title
        }
      }
    );
    return res.data[0][0][0];
  } catch {
    return title;
  }
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

  const response = await axios.get(
    "https://api-sg.aliexpress.com/sync",
    { params }
  );

  return response.data
    ?.aliexpress_affiliate_link_generate_response
    ?.resp_result
    ?.result
    ?.promotion_links
    ?.promotion_link?.[0]
    ?.promotion_link || null;
}

async function generateMarketingText(title, price) {
  if (!openai) {
    return `🔥 דיל חדש!\n\n${title}\n\n💰 מחיר: ₪${price}\n\n🛒 שווה לבדוק!`;
  }

  try {
    const prompt = `
משימה: כתוב פוסט שיווקי, קצר ומלהיב בעברית עבור דיל מעליאקספרס.

כותרת (הוסף אייקונים שמתאימים למוצר):
[שם המוצר מתורגם, קצר ושיווקי - ללא שמות דגמים טכניים ארוכים]

פתיחה (משפט אחד או שניים מלהיבים ורגשיים, למשל: "הגיע הזמן לשדרג...", "משהו מיוחד באמת..."):
[טקסט הפתיחה]

יתרונות (רשימה של בדיוק 4 יתרונות שיווקיים, קצרים ולעניין - כל אחד מתחיל ב-✅):
✅ [יתרון 1]
✅ [יתרון 2]
✅ [יתרון 3]
✅ [יתרון 4]

סיום (משפט סיום קצר ומזמין עם אייקון רגשי):
[טקסט סיום]

מחיר (השתמש בפורמט: 💥 מחיר: XX.XX₪ בלבד! 💥):
💥 מחיר: ${price}₪ בלבד! 💥

שם המוצר המקורי (לשימושך):
${title}
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "user", content: prompt }
      ],
      temperature: 0.8
    });

    return completion.choices[0].message.content;
  } catch {
    return `🔥 דיל חדש!\n\n${title}\n\n💰 מחיר: ₪${price}`;
  }
}

async function sendToChannel(text) {
  try {
    await axios.post(
      CHANNEL_API_URL,
      {
        text: text,
        author: "Deals Bot",
        timestamp: new Date().toISOString()
      },
      {
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": API_KEY
        }
      }
    );
    console.log("✅ הדיל נשלח לשרת/ערוץ שלך בהצלחה.");
  } catch (err) {
    console.log("❌ שגיאה בשליחה לשרת/ערוץ:", err.message);
  }
}

async function sendToWhatsApp(text) {
  try {
    await waClient.sendMessage(WA_CHAT_ID, text);
    console.log("✅ הדיל נשלח לוואטסאפ בהצלחה.");
  } catch (err) {
    console.log("❌ שגיאה בשליחה לוואטסאפ:", err.message);
  }
}

async function fetchDeal() {
  console.log("=== התחלת חיפוש דיל חדש ===");
  postCounter++;

  const currentKeyword = getNextKeyword();
  
  if (!keywordPages[currentKeyword]) {
    keywordPages[currentKeyword] = 1;
  }

  const currentPage = keywordPages[currentKeyword];
  console.log(`🔍 מחפש את המילה "${currentKeyword}" בעמוד מספר ${currentPage}...`);

  const params = {
    app_key: APP_KEY,
    method: "aliexpress.affiliate.product.query",
    timestamp: Date.now(),
    format: "json",
    v: "2.0",
    sign_method: "md5",
    keywords: currentKeyword,
    page_no: currentPage, 
    tracking_id: TRACKING_ID,
    ship_to_country: "IL",
    target_currency: "ILS",
    target_language: "HE",
    sort: "SALE_PRICE_ASC"
  };

  params.sign = generateSign(params);

  try {
    const response = await axios.get(
      "https://api-sg.aliexpress.com/sync",
      { params }
    );

    const products = response.data
      ?.aliexpress_affiliate_product_query_response
      ?.resp_result
      ?.result
      ?.products
      ?.product;

    if (!products?.length) {
      console.log(`❌ לא נמצאו מוצרים בעמוד ${currentPage}. מאפס חזרה לעמוד 1.`);
      keywordPages[currentKeyword] = 1; 
      return;
    }

    console.log(`✅ נמצאו ${products.length} מוצרים בעמוד. מתחיל סינון...`);

    const minPrice = 10;
    let maxPrice = 250;
    if (postCounter % 5 === 0) maxPrice = 300;

    let selectedProduct = null;
    let affiliateLink = null;

    for (const product of products) {
      if (sentProducts.has(product.product_id)) continue;
      const price = extractLowestPrice(product);
      if (!price || price < minPrice || price > maxPrice) continue;
      if (product.sale_volume < 50) continue;

      console.log(`✅ נמצא מוצר מתאים! מייצר לינק שותפים...`);
      const link = await generateAffiliateLink(product.product_detail_url);

      if (link) {
        selectedProduct = product;
        affiliateLink = link;
        sentProducts.add(product.product_id);
        fs.writeFileSync(SENT_FILE, JSON.stringify([...sentProducts]));
        break;
      }
    }

    if (!selectedProduct || !affiliateLink) {
      console.log(`⚠️ כל המוצרים בעמוד ${currentPage} כבר נשלחו או לא מתאימים. מעלה הילוך לעמוד ${currentPage + 1} לפעם הבאה!`);
      keywordPages[currentKeyword]++; 
      return;
    }

    console.log("✅ נמצא מוצר זהב! מכין טקסט שיווקי משודרג...");
    const rawPrice = extractLowestPrice(selectedProduct);
    const finalPrice = Math.floor(rawPrice * 100) / 100;
    
    const messageBodyText = await generateMarketingText(selectedProduct.product_title, finalPrice);
    const resizedImage = `https://images.weserv.nl/?w=400&url=${selectedProduct.product_main_image_url.replace("https://", "")}`;

    const messageText = `![](${resizedImage})\n\n${messageBodyText}\n\n🛒 לינק לרכישה:\n${affiliateLink}`;

    console.log("🚀 שולח ל-API של הערוץ...");
    await sendToChannel(messageText);
    
    console.log("🚀 מנסה לשלוח לוואטסאפ...");
    await sendToWhatsApp(messageText);

  } catch (err) {
    console.log("❌ שגיאה כללית:", err.message);
  }
}

cron.schedule("*/20 8-23 * * 0-4", fetchDeal);
cron.schedule("*/20 8-14 * * 5", fetchDeal);
cron.schedule("*/20 22-23 * * 6", fetchDeal);
cron.schedule("*/20 0-1 * * 0", fetchDeal);

console.log("⏳ השרת עלה. נותן לוואטסאפ 60 שניות להתחבר לפני החיפוש הראשון...");
setTimeout(() => {
  fetchDeal();
}, 60000);

setInterval(() => {}, 1000);
