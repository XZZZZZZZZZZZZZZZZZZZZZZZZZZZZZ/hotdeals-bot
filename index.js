process.env.TZ = "Asia/Jerusalem";

const axios = require("axios");
const crypto = require("crypto");
const cron = require("node-cron");
const fs = require("fs");
const http = require("http"); // ✨ התוספת שלנו ללוח הבקרה!

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
const SENT_FILE = "./bot_data/sent_products.json";

// ==========================================
// ✨ הגדרות Green API החדשות והמהירות! ✨
// ==========================================
const GREEN_API_URL = "https://7107.api.greenapi.com"; 
const GREEN_API_ID = "7107571319"; 
const GREEN_API_TOKEN = "7869922969b9444cba16f8edb61b6c7a1e63843e7c414b228c"; 

// ==========================================
// ✨ משתנים ללוח הבקרה (Dashboard) ✨
// ==========================================
let isFetching = false;
let botStatus = "🟢 יושב בשקט וממתין לטיימר הבא...";
let lastSentDealTime = "עדיין לא נשלח בסבב הזה";

let sentProducts = new Set();

if (!fs.existsSync("./bot_data")) {
    fs.mkdirSync("./bot_data", { recursive: true });
}

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
      return "gadgets";
    }

    const data = fs.readFileSync(KEYWORDS_FILE, "utf-8");
    const parsedData = JSON.parse(data);
    const keywords = parsedData.keywords;

    if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
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
  let price = product.target_app_sale_price;
  if (!price) return 0;
  price = price.toString();
  if (price.includes("-")) price = price.split("-")[0];
  return parseFloat(price);
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

  try {
    const response = await axios.get("https://api-sg.aliexpress.com/sync", { params });
    return response.data?.aliexpress_affiliate_link_generate_response?.resp_result?.result?.promotion_links?.promotion_link?.[0]?.promotion_link || null;
  } catch (err) {
    return null;
  }
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
      messages: [{ role: "user", content: prompt }],
      temperature: 0.8
    });

    return completion.choices[0].message.content;
  } catch (err) {
    return `🔥 דיל חדש!\n\n${title}\n\n💥 מחיר: ${price}₪ בלבד! 💥`;
  }
}

async function sendToChannel(text) {
  try {
    await axios.post(
      CHANNEL_API_URL,
      { text: text, author: "Deals Bot", timestamp: new Date().toISOString() },
      { headers: { "Content-Type": "application/json", "X-API-Key": API_KEY } }
    );
  } catch (err) {
    console.log("❌ שגיאה בשליחה לשרת/ערוץ:", err.message);
  }
}

async function sendToGreenApi(imgUrl, text) {
    try {
        const endpoint = `${GREEN_API_URL}/waInstance${GREEN_API_ID}/sendFileByUrl/${GREEN_API_TOKEN}`;
        const payload = { chatId: WA_CHAT_ID, urlFile: imgUrl, fileName: "deal.jpg", caption: text };
        await axios.post(endpoint, payload);
    } catch (err) {
        try {
            const textEndpoint = `${GREEN_API_URL}/waInstance${GREEN_API_ID}/sendMessage/${GREEN_API_TOKEN}`;
            await axios.post(textEndpoint, { chatId: WA_CHAT_ID, message: text });
        } catch (textErr) {}
    }
}

async function fetchDeal() {
  if (isFetching) return;
  
  isFetching = true;
  botStatus = "🔍 מתחיל סריקה של עליאקספרס..."; // עדכון לוח הבקרה

  try {
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
      botStatus = `🔍 מחפש דילים חמים תחת המילה "${currentKeyword}" בעמוד ${currentPage}...`; // עדכון חי

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
        const response = await axios.get("https://api-sg.aliexpress.com/sync", { params });
        const products = response.data?.aliexpress_affiliate_product_query_response?.resp_result?.result?.products?.product;

        if (!products?.length) {
          keywordPages[currentKeyword] = 1; 
          break; 
        }

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

          const link = await generateAffiliateLink(product.product_detail_url);
          if (link) {
            selectedProduct = product;
            affiliateLink = link;
            break;
          }
        }

        if (selectedProduct && affiliateLink) {
          foundDeal = true;
          botStatus = "🚀 מכין טקסט שיווקי ומשגר את הדיל!"; // עדכון חי
          
          const rawPrice = extractLowestPrice(selectedProduct);
          const finalPrice = Math.floor(rawPrice * 100) / 100;
          
          const messageBodyText = await generateMarketingText(selectedProduct.product_title, finalPrice);
          const imgUrl = `https://images.weserv.nl/?w=400&url=${selectedProduct.product_main_image_url.replace("https://", "")}`;

          const fullText = `${messageBodyText}\n\n🛒 לינק לרכישה:\n${affiliateLink}`;
          const channelMessageText = `![](${imgUrl})\n\n${fullText}`;
          
          await sendToChannel(channelMessageText);
          await sendToGreenApi(imgUrl, fullText);
          
          sentProducts.add(selectedProduct.product_id);
          fs.writeFileSync(SENT_FILE, JSON.stringify([...sentProducts]));
          
          lastSentDealTime = new Date().toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" }); // עדכון שעון
          
          break; 

        } else {
          keywordPages[currentKeyword]++; 
          pagesSearched++;
        }

      } catch (err) {
        break; 
      }
    }

  } catch (error) {
    console.log("❌ שגיאה בלתי צפויה:", error.message);
  } finally {
    isFetching = false;
    botStatus = "🟢 יושב בשקט וממתין לטיימר הבא..."; // חוזר למנוחה
  }
}

const cronOptions = { timezone: "Asia/Jerusalem" };
cron.schedule("*/20 8-23 * * 0-4", fetchDeal, cronOptions);
cron.schedule("*/20 8-14 * * 5", fetchDeal, cronOptions);
cron.schedule("*/20 22-23 * * 6", fetchDeal, cronOptions);
cron.schedule("*/20 0-1 * * 0", fetchDeal, cronOptions);

// ==========================================
// ✨ שרת לוח הבקרה (Dashboard) ✨
// ==========================================
const port = process.env.PORT || 8000;
const server = http.createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    
    const html = `
    <!DOCTYPE html>
    <html dir="rtl" lang="he">
    <head>
        <title>פאנל ניהול - בוט הדילים</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f0f2f5; text-align: center; margin: 0; padding: 20px; color: #333; }
            .card { background: white; max-width: 500px; margin: 40px auto; padding: 30px; border-radius: 15px; box-shadow: 0 8px 16px rgba(0,0,0,0.1); }
            h1 { color: #1a73e8; margin-bottom: 5px; }
            .subtitle { color: #666; font-size: 14px; margin-bottom: 25px; }
            .status-box { background: #e6f4ea; border: 2px solid #34a853; padding: 15px; border-radius: 10px; font-size: 18px; font-weight: bold; color: #137333; margin-bottom: 25px; }
            .stats { text-align: right; background: #f8f9fa; padding: 15px; border-radius: 10px; }
            .stats p { margin: 10px 0; font-size: 16px; border-bottom: 1px solid #eee; padding-bottom: 10px; }
            .stats p:last-child { border-bottom: none; padding-bottom: 0; }
            .refresh-btn { margin-top: 20px; background: #1a73e8; color: white; border: none; padding: 10px 20px; border-radius: 5px; font-size: 16px; cursor: pointer; }
            .refresh-btn:hover { background: #1557b0; }
        </style>
    </head>
    <body>
        <div class="card">
            <h1>🤖 בוט הדילים שלך</h1>
            <div class="subtitle">מערכת חכמה מחוברת ל-Green API</div>
            
            <div class="status-box">
                ${botStatus}
            </div>
            
            <div class="stats">
                <p><strong>🛍️ מוצרים שנשלחו עד היום:</strong> ${sentProducts.size}</p>
                <p><strong>🕒 דיל אחרון נשלח ב:</strong> ${lastSentDealTime}</p>
                <p><strong>📱 מצב חיבור לוואטסאפ:</strong> פעיל (API)</p>
            </div>
            
            <button class="refresh-btn" onclick="location.reload()">🔄 רענן מצב</button>
        </div>
    </body>
    </html>
    `;
    res.end(html);
});

server.listen(port, () => {
    console.log(`🚀 השרת עלה! לוח הבקרה פועל וממתין לכניסות בפורט ${port}...`);
});

setInterval(() => {}, 1000);
