process.env.TZ = "Asia/Jerusalem";

const axios = require("axios");
const crypto = require("crypto");
const cron = require("node-cron");
const fs = require("fs");
const http = require("http");
const url = require("url");
const querystring = require("querystring"); // נוסף כדי לפענח את הטקסט מהטופס

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
// ✨ הגדרות Green API ✨
// ==========================================
const GREEN_API_URL = "https://7107.api.greenapi.com"; 
const GREEN_API_ID = "7107571319"; 
const GREEN_API_TOKEN = "7869922969b9444cba16f8edb61b6c7a1e63843e7c414b228c"; 

// ==========================================
// ✨ משתני מערכת ולוח בקרה ✨
// ==========================================
let isBotActive = true; 
let isFetching = false;
let botStatus = "🟢 המערכת פעילה וממתינה לדילים";
let lastSentDealTime = "טרם נשלח בסבב הזה";
let lastErrorTime = "אין שגיאות מאז ההפעלה";
let lastErrorMessage = "המערכת יציבה לחלוטין";
let dealHistory = [];

let sentProducts = new Set();

if (!fs.existsSync("./bot_data")) {
    fs.mkdirSync("./bot_data", { recursive: true });
}

if (fs.existsSync(SENT_FILE)) {
  try {
    const data = JSON.parse(fs.readFileSync(SENT_FILE));
    sentProducts = new Set(data);
  } catch(e) {
    console.log("⚠️ שגיאה בקריאת קובץ המוצרים שנשלחו, מתחיל חדש.");
  }
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
    console.log("❌ שגיאה בשליחה לערוץ:", err.message);
  }
}

// מעודכן כדי לטפל גם בהודעות טקסט בלי תמונה (לשימוש ידני שלך)
async function sendToGreenApi(imgUrl, text) {
    try {
        if (imgUrl) {
            // אם יש תמונה (מוצר מעליאקספרס)
            const endpoint = `${GREEN_API_URL}/waInstance${GREEN_API_ID}/sendFileByUrl/${GREEN_API_TOKEN}`;
            const payload = { chatId: WA_CHAT_ID, urlFile: imgUrl, fileName: "deal.jpg", caption: text };
            await axios.post(endpoint, payload);
        } else {
            // אם אין תמונה (הודעה יזומה מהאתר)
            const textEndpoint = `${GREEN_API_URL}/waInstance${GREEN_API_ID}/sendMessage/${GREEN_API_TOKEN}`;
            await axios.post(textEndpoint, { chatId: WA_CHAT_ID, message: text });
        }
    } catch (err) {
        console.log("❌ שגיאה בוואטסאפ:", err.message);
    }
}

async function fetchDeal() {
  if (!isBotActive) {
    console.log("💤 הבוט כבוי כרגע מלוח הבקרה. מדלג על מחזור החיפוש.");
    return;
  }
  if (isFetching) return;
  
  isFetching = true;
  botStatus = "🔍 מתחיל סריקה עמוקה בעליאקספרס...";

  try {
    postCounter++;
    const currentKeyword = getNextKeyword();
    if (!keywordPages[currentKeyword]) keywordPages[currentKeyword] = 1;

    let foundDeal = false;
    let pagesSearched = 0;
    const MAX_PAGES_TO_SEARCH = 50; 

    while (!foundDeal && pagesSearched < MAX_PAGES_TO_SEARCH) {
      const currentPage = keywordPages[currentKeyword];
      botStatus = `🔍 מחפש דילים תחת המילה "${currentKeyword}" בעמוד ${currentPage}...`;

      const params = {
        app_key: APP_KEY, method: "aliexpress.affiliate.product.query",
        timestamp: Date.now(), format: "json", v: "2.0", sign_method: "md5",
        keywords: currentKeyword, page_no: currentPage, 
        tracking_id: TRACKING_ID, ship_to_country: "IL", target_currency: "ILS", target_language: "HE", sort: "SALE_PRICE_ASC"
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
          botStatus = "🚀 מכין פוסט שיווקי ומשגר את הדיל!";
          
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
          
          lastSentDealTime = new Date().toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" });
          dealHistory.unshift({ time: lastSentDealTime.split(',')[1], title: selectedProduct.product_title });
          if (dealHistory.length > 5) dealHistory.pop();
          
          break; 
        } else {
          keywordPages[currentKeyword]++; 
          pagesSearched++;
        }
      } catch (err) { break; }
    }
  } catch (error) {
    lastErrorTime = new Date().toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" });
    lastErrorMessage = error.message;
  } finally {
    isFetching = false;
    botStatus = isBotActive ? "🟢 יושב בשקט וממתין לטיימר" : "🔴 הבוט כבוי על ידך";
  }
}

// ==========================================
// ✨ כל הטיימירים המלאים! ✨
// ==========================================
const cronOptions = { timezone: "Asia/Jerusalem" };
cron.schedule("*/20 8-23 * * 0-4", fetchDeal, cronOptions);
cron.schedule("*/20 8-14 * * 5", fetchDeal, cronOptions);
cron.schedule("*/20 22-23 * * 6", fetchDeal, cronOptions);
cron.schedule("*/20 0-1 * * 0", fetchDeal, cronOptions);

// ==========================================
// ✨ שרת לוח בקרה עם כל הפיצ'רים ✨
// ==========================================
const port = process.env.PORT || 8000;
http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);

    // טיפול בכיבוי והדלקה
    if (parsedUrl.query.action === "toggle") {
        isBotActive = !isBotActive;
        botStatus = isBotActive ? "🟢 יושב בשקט וממתין לטיימר" : "🔴 הבוט כבוי על ידך";
        res.writeHead(302, { 'Location': '/' });
        res.end();
        return;
    }

    // טיפול בשליחת הודעה יזומה מהטופס החדש
    if (req.method === 'POST' && parsedUrl.pathname === '/broadcast') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', async () => {
            const formData = querystring.parse(body);
            const customMessage = formData.custom_msg;
            if (customMessage && customMessage.trim() !== '') {
                console.log("📣 משגר הודעה יזומה מהאתר...");
                
                // שלח לערוץ
                await sendToChannel(customMessage);
                // שלח לוואטסאפ (טקסט בלבד, ללא תמונה)
                await sendToGreenApi(null, customMessage);
                
                // עדכון ההיסטוריה
                lastSentDealTime = new Date().toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" });
                dealHistory.unshift({ time: lastSentDealTime.split(',')[1], title: "📣 הודעת מערכת יזומה: " + customMessage.substring(0,20) + "..." });
                if (dealHistory.length > 5) dealHistory.pop();
            }
            // חזרה לעמוד הראשי
            res.writeHead(302, { 'Location': '/' });
            res.end();
        });
        return;
    }

    // ציור העמוד הראשי
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(`
    <!DOCTYPE html>
    <html dir="rtl" lang="he">
    <head>
        <title>שליטה בבוט הדילים</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #e9ecef; padding: 20px; text-align: center; }
            .card { background: white; max-width: 500px; margin: auto; padding: 30px; border-radius: 15px; box-shadow: 0 10px 20px rgba(0,0,0,0.1); }
            h2 { color: #343a40; margin-bottom: 20px; }
            .status-banner { padding: 15px; border-radius: 10px; font-weight: bold; font-size: 16px; margin-bottom: 25px; transition: all 0.3s ease; background: ${isBotActive ? '#d4edda' : '#f8d7da'}; color: ${isBotActive ? '#155724' : '#721c24'}; border: 2px solid ${isBotActive ? '#c3e6cb' : '#f5c6cb'}; }
            .btn { display: inline-block; padding: 15px 30px; font-size: 18px; color: white; border: none; border-radius: 8px; cursor: pointer; text-decoration: none; font-weight: bold; width: 80%; transition: 0.2s; box-sizing: border-box; }
            .btn:hover { opacity: 0.9; transform: scale(0.98); }
            .btn-off { background: #dc3545; box-shadow: 0 4px 6px rgba(220, 53, 69, 0.3); }
            .btn-on { background: #28a745; box-shadow: 0 4px 6px rgba(40, 167, 69, 0.3); }
            
            /* עיצוב לאזור ההודעות היזומות */
            .broadcast-box { background: #f8f9fa; border: 2px solid #6c757d; border-radius: 10px; padding: 20px; margin-top: 30px; text-align: right; }
            .broadcast-box h3 { margin-top: 0; color: #495057; font-size: 16px; margin-bottom: 10px; }
            .broadcast-box textarea { width: 100%; height: 80px; padding: 10px; border-radius: 6px; border: 1px solid #ced4da; font-family: inherit; resize: none; box-sizing: border-box; font-size: 14px; }
            .btn-send { background: #007bff; color: white; border: none; padding: 10px; border-radius: 6px; width: 100%; font-weight: bold; font-size: 16px; margin-top: 10px; cursor: pointer; }
            .btn-send:hover { background: #0056b3; }

            .info-section { text-align: right; margin-top: 30px; font-size: 15px; color: #495057; }
            .info-section p { margin: 10px 0; padding-bottom: 10px; border-bottom: 1px solid #f1f3f5; }
            .history { text-align: right; margin-top: 20px; font-size: 14px; background: #f8f9fa; padding: 15px; border-radius: 10px; border: 1px solid #dee2e6; }
            .history-title { font-weight: bold; margin-bottom: 10px; color: #495057; }
            .history-item { padding: 5px 0; border-bottom: 1px dashed #ced4da; }
            .history-item:last-child { border-bottom: none; }
            .err { color: #dc3545; font-size: 13px; margin-top: 20px; background: #fff3f3; padding: 10px; border-radius: 8px; border-right: 4px solid #dc3545; text-align: right; }
            .refresh-btn { margin-top: 25px; background: #6c757d; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-size: 14px; }
        </style>
    </head>
    <body>
        <div class="card">
            <h2>🤖 לוח בקרה - בוט דילים</h2>
            <div class="status-banner" id="statusBox">${botStatus}</div>
            
            <a href="/?action=toggle" class="btn ${isBotActive ? 'btn-off' : 'btn-on'}">
                ${isBotActive ? '⏸️ כבה את הבוט (השהיה)' : '▶️ הפעל את הבוט מחדש'}
            </a>

            <div class="broadcast-box">
                <h3>📣 שלח הודעה ללקוחות עכשיו:</h3>
                <form action="/broadcast" method="POST">
                    <textarea name="custom_msg" placeholder="כתוב כאן הודעה, עדכון, או לינק מיוחד..." required></textarea>
                    <button type="submit" class="btn-send">🚀 שגר במקביל לערוץ ולוואטסאפ</button>
                </form>
            </div>

            <div class="info-section">
                <p>🛍️ סה"כ דילים שנשלחו אי פעם: <strong>${sentProducts.size}</strong></p>
                <p>🕒 שליחה אחרונה: <strong dir="ltr">${lastSentDealTime}</strong></p>
            </div>

            <div class="history">
                <div class="history-title">📜 5 הפעולות האחרונות:</div>
                ${dealHistory.length > 0 ? dealHistory.map(d => `<div class="history-item">⏰ ${d.time} | ${d.title.substring(0,40)}...</div>`).join('') : '<div class="history-item">עדיין לא נשלחו דילים מאז הריסטרט</div>'}
            </div>

            <div class="err">
                <strong>⚠️ יומן שגיאות מערכת:</strong><br>
                זמן: <span dir="ltr">${lastErrorTime}</span><br>
                פירוט: <em>${lastErrorMessage}</em>
            </div>
            
            <button class="refresh-btn" onclick="location.reload()">🔄 רענן נתונים בזמן אמת</button>
        </div>
    </body>
    </html>
    `);
}).listen(port);

console.log("🚀 המערכת עלתה! לוח הבקרה זמין בפורט " + port);
