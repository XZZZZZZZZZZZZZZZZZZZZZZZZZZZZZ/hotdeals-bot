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
    return `🔥 דיל חדש!\n\n${title}\n\n💥 מחיר: ${price}₪ בלבד! 💥\n\n🛒 שווה לבדוק!`;
  }

  try {
    const prompt = `
משימה: כתוב פוסט שיווקי קצר וזורם בעברית לדיל מעליאקספרס.
חוק ברזל: אל תכתוב מילות תיאור כמו "כותרת:", "מה המוצר עושה:", "יתרונות:" או "סיום:". רק את הטקסט נטו!

מבנה נדרש:
1. משפט פתיחה מלהיב שכולל אייקון מתאים.
2. משפט קצר שמסביר בצורה פשוטה, ברורה ומלהיבה מה המטרה של המוצר ולמה צריך אותו.
3. רשימה של בדיוק 4 יתרונות שיווקיים, קצרים ולעניין (כל אחד מתחיל ב-✅).
4. משפט סיום קצר ומזמין עם אייקון רגשי.
5. חובה להדפיס בסוף הפוסט את שורת המחיר הבאה בדיוק ככה: 💥 מחיר: ${price}₪ בלבד! 💥

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
    return `🔥 דיל חדש!\n\n${title}\n\n💥 מחיר: ${price}₪ בלבד! 💥`;
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

async function fetchDeal() {
  console.log("=== התחלת חיפוש דיל חדש ===");
  postCounter++;

  const currentKeyword = getNextKeyword();
  
  if (!keywordPages[currentKeyword]) {
    keywordPages[currentKeyword] = 1;
  }

  let foundDeal = false;
  let pagesSearched = 0;
  const MAX_PAGES_TO_SEARCH = 50; 

  while (!foundDeal && pagesSearched < MAX_PAGES_TO_SEARCH) {
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
        console.log(`❌ לא נמצאו מוצרים בעמוד ${currentPage}. אולי הגענו לסוף. מאפס חזרה לעמוד 1.`);
        keywordPages[currentKeyword] = 1; 
        break; 
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

      if (selectedProduct && affiliateLink) {
        foundDeal = true;
        console.log("✅ נמצא מוצר זהב! מכין טקסט שיווקי משודרג...");
        const rawPrice = extractLowestPrice(selectedProduct);
        const finalPrice = Math.floor(rawPrice * 100) / 100;
        
        const messageBodyText = await generateMarketingText(selectedProduct.product_title, finalPrice);
        const resizedImage = `https://images.weserv.nl/?w=400&url=${selectedProduct.product_main_image_url.replace("https://", "")}`;

        const channelMessageText = `![](${resizedImage})\n\n${messageBodyText}\n\n🛒 לינק לרכישה:\n${affiliateLink}`;
        const whatsappMessageText = `${messageBodyText}\n\n🛒 לינק לרכישה:\n${affiliateLink}`;

        console.log("🚀 שולח ל-API של הערוץ...");
        await sendToChannel(channelMessageText);
        
        console.log("🚀 מכין תמונה וטקסט לשליחה לוואטסאפ...");
        try {
          const media = await MessageMedia.fromUrl(resizedImage, { unsafeMime: true });
          await waClient.sendMessage(WA_CHAT_ID, media, { caption: whatsappMessageText });
          console.log("✅ הדיל והתמונה נשלחו לוואטסאפ בהצלחה!");
        } catch (waErr) {
          console.log("⚠️ לא הצלחתי לטעון את התמונה לוואטסאפ, שולח רק טקסט בינתיים. שגיאה:", waErr.message);
          await waClient.sendMessage(WA_CHAT_ID, whatsappMessageText);
        }
        
        break; 

      } else {
        console.log(`⚠️ כל המוצרים בעמוד ${currentPage} כבר נשלחו או לא מתאימים. עובר מיד לעמוד ${currentPage + 1}...`);
        keywordPages[currentKeyword]++; 
        pagesSearched++;
      }

    } catch (err) {
      console.log("❌ שגיאה כללית במהלך סריקת העמוד:", err.message);
      break; 
    }
  }

  if (!foundDeal && pagesSearched >= MAX_PAGES_TO_SEARCH) {
    console.log(`⏳ חיפשתי ב-${MAX_PAGES_TO_SEARCH} עמודים ברצף למילה "${currentKeyword}" ולא מצאתי כלום. אני אנוח ואנסה מילה אחרת בחיפוש הבא.`);
  }
}

const cronOptions = { timezone: "Asia/Jerusalem" };
cron.schedule("*/20 8-23 * * 0-4", fetchDeal, cronOptions);
cron.schedule("*/20 8-14 * * 5", fetchDeal, cronOptions);
cron.schedule("*/20 22-23 * * 6", fetchDeal, cronOptions);
cron.schedule("*/20 0-1 * * 0", fetchDeal, cronOptions);

cron.schedule("0 3 * * *", () => {
    console.log("🔄 מבצע רענון זיכרון יומי אוטומטי! מכבה את השרת כדי ש-Koyeb ידליק אותו נקי...");
    process.exit(1); 
}, cronOptions);

console.log("⏳ השרת עלה. נותן לוואטסאפ 60 שניות להתחבר לפני החיפוש הראשון...");
setTimeout(() => {
  fetchDeal();
}, 60000);

setInterval(() => {}, 1000);
