process.env.TZ = "Asia/Jerusalem";

const axios = require("axios");
const crypto = require("crypto");
const cron = require("node-cron");
const fs = require("fs");
const http = require("http");
const url = require("url");
const querystring = require("querystring");

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

const GREEN_API_URL = "https://7107.api.greenapi.com"; 
const GREEN_API_ID = "7107571319"; 
const GREEN_API_TOKEN = "7869922969b9444cba16f8edb61b6c7a1e63843e7c414b228c"; 

const KEYWORDS_FILE = "keywords.json";
const SENT_FILE = "./bot_data/sent_products.json";
const USERS_FILE = "./bot_data/users.json";

// 🛡️ רשימת מילים אסורות
const BLACKLIST_WORDS = ["צלב", "cross", "סקסי", "sexy", "jesus", "christ", "church", "תפילה", "עבודה זרה", "מיני", "mini", "short dress", "bikini", "ביקיני"];

// ==========================================
// ✨ משתני מערכת, סטטוס ומשתמשים ✨
// ==========================================
let isBotActive = true; 
let isFetching = false;
let botStatus = "🟢 המערכת פעילה וממתינה לדילים";
let lastSentDealTime = "טרם נשלח בסבב הזה";
let lastErrorTime = "אין שגיאות";
let lastErrorMessage = "המערכת תקינה";
let dealHistory = [];

if (!fs.existsSync("./bot_data")) fs.mkdirSync("./bot_data", { recursive: true });

let sentProducts = new Set();
if (fs.existsSync(SENT_FILE)) {
  try { sentProducts = new Set(JSON.parse(fs.readFileSync(SENT_FILE))); } catch(e) {}
}

// ניהול משתמשים - יצירת מנהל דיפולטיבי אם לא קיים
let users = [{ username: "M", password: "1", role: "admin" }];
if (fs.existsSync(USERS_FILE)) {
  try { users = JSON.parse(fs.readFileSync(USERS_FILE)); } catch(e) {}
} else {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users));
}

let sessions = {}; // שומר את מי שמחובר עכשיו

let lastKeyword = null;
let postCounter = 0;
let keywordPages = {};

// ==========================================
// ⚙️ פונקציות הבוט (מנוע הליבה) ⚙️
// ==========================================
function getNextKeyword() {
  try {
    if (!fs.existsSync(KEYWORDS_FILE)) return "gadgets";
    const data = JSON.parse(fs.readFileSync(KEYWORDS_FILE, "utf-8"));
    const keywords = data.keywords;
    if (!keywords || keywords.length === 0) return "gadgets";
    let selected;
    do { selected = keywords[Math.floor(Math.random() * keywords.length)]; } while (selected === lastKeyword && keywords.length > 1);
    lastKeyword = selected;
    return selected;
  } catch (err) { return "gadgets"; }
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
  price = price.toString().split("-")[0];
  return parseFloat(price);
}

async function generateAffiliateLink(originalUrl) {
  const params = {
    app_key: APP_KEY, method: "aliexpress.affiliate.link.generate", timestamp: Date.now(), format: "json", v: "2.0", sign_method: "md5",
    source_values: originalUrl, tracking_id: TRACKING_ID, promotion_link_type: 2
  };
  params.sign = generateSign(params);
  try {
    const response = await axios.get("https://api-sg.aliexpress.com/sync", { params });
    return response.data?.aliexpress_affiliate_link_generate_response?.resp_result?.result?.promotion_links?.promotion_link?.[0]?.promotion_link || null;
  } catch (err) { return null; }
}

async function generateMarketingText(title, price) {
  if (!openai) return `🔥 דיל חדש!\n\n${title}\n\n💥 מחיר: ${price}₪ בלבד! 💥`;
  try {
    const prompt = `
משימה: כתוב פוסט שיווקי קצר בעברית לדיל מעליאקספרס לקהל חרדי שומר תורה ומצוות.
חוקי סינון: 1. אם המוצר אינו צנוע או שהוא סמל דתי נוצרי (צלב), החזר אך ורק את המילה: REJECT.
2. אם המוצר תקין, כתוב פוסט ללא כותרות, 4 יתרונות בנקודות ✅. השתמש בשפה נקייה ומכובדת בלבד (ללא מילים כמו סקסי).
3. בסוף הפוסט הוסף: 💥 מחיר: ${price}₪ בלבד! 💥\nשם המוצר: ${title}`;
    
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini", messages: [{ role: "user", content: prompt }], temperature: 0.7
    });
    return completion.choices[0].message.content;
  } catch (err) { return `🔥 דיל חדש!\n\n${title}\n\n💥 מחיר: ${price}₪ בלבד! 💥`; }
}

async function sendToChannel(text) {
  try {
    await axios.post(CHANNEL_API_URL, { text: text, author: "Deals Bot", timestamp: new Date().toISOString() }, { headers: { "Content-Type": "application/json", "X-API-Key": API_KEY } });
  } catch (err) { console.log("❌ שגיאה בערוץ:", err.message); }
}

async function sendToGreenApi(imgUrl, text) {
    try {
        if (imgUrl) {
            const endpoint = `${GREEN_API_URL}/waInstance${GREEN_API_ID}/sendFileByUrl/${GREEN_API_TOKEN}`;
            await axios.post(endpoint, { chatId: WA_CHAT_ID, urlFile: imgUrl, fileName: "deal.jpg", caption: text });
        } else {
            const textEndpoint = `${GREEN_API_URL}/waInstance${GREEN_API_ID}/sendMessage/${GREEN_API_TOKEN}`;
            await axios.post(textEndpoint, { chatId: WA_CHAT_ID, message: text });
        }
    } catch (err) { console.log("❌ שגיאה בוואטסאפ:", err.message); }
}

async function fetchDeal() {
  if (!isBotActive || isFetching) return;
  isFetching = true; botStatus = "🔍 מתחיל סריקה עמוקה בעליאקספרס...";
  try {
    postCounter++; const currentKeyword = getNextKeyword();
    if (!keywordPages[currentKeyword]) keywordPages[currentKeyword] = 1;
    let foundDeal = false; let pagesSearched = 0;

    while (!foundDeal && pagesSearched < 50) {
      const params = {
        app_key: APP_KEY, method: "aliexpress.affiliate.product.query", timestamp: Date.now(), format: "json", v: "2.0", sign_method: "md5",
        keywords: currentKeyword, page_no: keywordPages[currentKeyword], tracking_id: TRACKING_ID, ship_to_country: "IL", target_currency: "ILS", target_language: "HE", sort: "SALE_PRICE_ASC"
      };
      params.sign = generateSign(params);
      const response = await axios.get("https://api-sg.aliexpress.com/sync", { params });
      const products = response.data?.aliexpress_affiliate_product_query_response?.resp_result?.result?.products?.product;

      if (!products?.length) { keywordPages[currentKeyword] = 1; break; }

      for (const product of products) {
        if (sentProducts.has(product.product_id)) continue;

        // סינון רשימה שחורה
        if (BLACKLIST_WORDS.some(word => product.product_title.toLowerCase().includes(word))) continue;

        const price = extractLowestPrice(product);
        if (price < 10 || price > 350 || product.sale_volume < 40) continue;

        const link = await generateAffiliateLink(product.product_detail_url);
        if (link) {
          const finalPrice = Math.floor(price * 100) / 100;
          const messageBodyText = await generateMarketingText(product.product_title, finalPrice);
          
          // סינון AI
          if (messageBodyText.includes("REJECT")) continue;

          foundDeal = true;
          const imgUrl = `https://images.weserv.nl/?w=400&url=${product.product_main_image_url.replace("https://", "")}`;
          const fullText = `${messageBodyText}\n\n🛒 לינק לרכישה:\n${link}`;
          
          await sendToChannel(`![](${imgUrl})\n\n${fullText}`);
          await sendToGreenApi(imgUrl, fullText);
          
          sentProducts.add(product.product_id);
          fs.writeFileSync(SENT_FILE, JSON.stringify([...sentProducts]));
          
          lastSentDealTime = new Date().toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" });
          dealHistory.unshift({ time: lastSentDealTime.split(',')[1], title: product.product_title });
          if (dealHistory.length > 5) dealHistory.pop();
          break;
        }
      }
      keywordPages[currentKeyword]++; pagesSearched++;
    }
  } catch (error) {
    lastErrorTime = new Date().toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" }); lastErrorMessage = error.message;
  } finally {
    isFetching = false; botStatus = isBotActive ? "🟢 יושב בשקט וממתין לטיימר" : "🔴 הבוט כבוי";
  }
}

const cronOptions = { timezone: "Asia/Jerusalem" };
cron.schedule("*/20 8-23 * * 0-4", fetchDeal, cronOptions);
cron.schedule("*/20 8-14 * * 5", fetchDeal, cronOptions);
cron.schedule("*/20 22-23 * * 6", fetchDeal, cronOptions);
cron.schedule("*/20 0-1 * * 0", fetchDeal, cronOptions);

// ==========================================
// 🌐 שרת ולוח בקרה (כולל אבטחה וניהול משתמשים) 🌐
// ==========================================
function parseCookies(request) {
    const list = {};
    const cookieHeader = request.headers?.cookie;
    if (!cookieHeader) return list;
    cookieHeader.split(`;`).forEach(function(cookie) {
        let [name, ...rest] = cookie.split(`=`);
        name = name?.trim();
        if (!name) return;
        list[name] = decodeURIComponent(rest.join(`=`).trim());
    });
    return list;
}

const port = process.env.PORT || 8000;
http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const cookies = parseCookies(req);
    const sessionToken = cookies['session_id'];
    const currentUsername = sessions[sessionToken];
    const currentUser = users.find(u => u.username === currentUsername);

    // ניתוק משתמש
    if (parsedUrl.pathname === '/logout') {
        delete sessions[sessionToken];
        res.writeHead(302, { 'Location': '/', 'Set-Cookie': 'session_id=; Expires=Thu, 01 Jan 1970 00:00:00 GMT' });
        res.end(); return;
    }

    // טיפול בבקשות POST (התחברות, כיבוי, הודעות, ניהול משתמשים)
    if (req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
            const formData = querystring.parse(body);

            // 1. התחברות
            if (parsedUrl.pathname === '/login') {
                const user = users.find(u => u.username === formData.username && u.password === formData.password);
                if (user) {
                    const token = crypto.randomBytes(16).toString('hex');
                    sessions[token] = user.username;
                    res.writeHead(302, { 'Location': '/', 'Set-Cookie': `session_id=${token}; HttpOnly` });
                } else {
                    res.writeHead(302, { 'Location': '/?error=1' });
                }
                res.end(); return;
            }

            // חסימת פעולות אם לא מחובר
            if (!currentUser) { res.writeHead(302, { 'Location': '/' }); res.end(); return; }
            const isAdmin = currentUser.role === 'admin';
            const isEditor = isAdmin || currentUser.role === 'editor';

            // 2. כיבוי והפעלה (עורך ומנהל)
            if (parsedUrl.pathname === '/toggle' && isEditor) {
                isBotActive = !isBotActive;
                botStatus = isBotActive ? "🟢 יושב בשקט וממתין לטיימר" : "🔴 הבוט כבוי על ידי מפעיל";
            }
            
            // 3. שליחת הודעה יזומה (עורך ומנהל)
            if (parsedUrl.pathname === '/broadcast' && isEditor && formData.custom_msg) {
                await sendToChannel(formData.custom_msg);
                await sendToGreenApi(null, formData.custom_msg);
                lastSentDealTime = new Date().toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" });
                dealHistory.unshift({ time: lastSentDealTime.split(',')[1], title: "📣 הודעה יזומה: " + formData.custom_msg.substring(0,20) });
            }

            // 4. ניהול משתמשים - הוספה (מנהל בלבד)
            if (parsedUrl.pathname === '/add_user' && isAdmin) {
                if (formData.new_username && formData.new_password && formData.new_role) {
                    if (!users.find(u => u.username === formData.new_username)) {
                        users.push({ username: formData.new_username, password: formData.new_password, role: formData.new_role });
                        fs.writeFileSync(USERS_FILE, JSON.stringify(users));
                    }
                }
            }

            // 5. ניהול משתמשים - מחיקה (מנהל בלבד, לא יכול למחוק את עצמו)
            if (parsedUrl.pathname === '/delete_user' && isAdmin) {
                if (formData.del_username && formData.del_username !== currentUser.username) {
                    users = users.filter(u => u.username !== formData.del_username);
                    fs.writeFileSync(USERS_FILE, JSON.stringify(users));
                    // נתק את המשתמש שנמחק
                    for (let t in sessions) { if (sessions[t] === formData.del_username) delete sessions[t]; }
                }
            }

            res.writeHead(302, { 'Location': '/' }); res.end();
        });
        return;
    }

    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });

    // מסך התחברות למי שלא מחובר
    if (!currentUser) {
        res.end(`
        <!DOCTYPE html><html dir="rtl" lang="he"><head><title>התחברות למערכת</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>body{font-family:sans-serif;background:#e9ecef;text-align:center;padding:50px 20px;} .box{background:white;padding:30px;border-radius:10px;max-width:300px;margin:auto;box-shadow:0 4px 10px rgba(0,0,0,0.1);} input,button{width:100%;padding:10px;margin:10px 0;box-sizing:border-box;border-radius:5px;} button{background:#007bff;color:white;border:none;cursor:pointer;} .err{color:red;font-size:14px;}</style></head>
        <body><div class="box"><h2>🔒 כניסה למערכת</h2>
        ${parsedUrl.query.error ? '<div class="err">שם משתמש או סיסמה שגויים</div>' : ''}
        <form action="/login" method="POST">
        <input type="text" name="username" placeholder="שם משתמש" required>
        <input type="password" name="password" placeholder="סיסמה" required>
        <button type="submit">התחבר</button></form></div></body></html>
        `);
        return;
    }

    // משתני הרשאות עבור ה-HTML
    const isAdmin = currentUser.role === 'admin';
    const isEditor = isAdmin || currentUser.role === 'editor';
    const roleHebrew = isAdmin ? "👑 מנהל" : (isEditor ? "✍️ עורך" : "👁️ צופה");

    // הדפסת לוח הבקרה למחוברים
    res.end(`
    <!DOCTYPE html><html dir="rtl" lang="he"><head><title>לוח בקרה מאובטח</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body{font-family:sans-serif;background:#f4f7f6;text-align:center;padding:20px;}
        .card{background:white;padding:25px;border-radius:12px;max-width:550px;margin:auto;box-shadow:0 5px 15px rgba(0,0,0,0.1);}
        .header{display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #eee;padding-bottom:10px;margin-bottom:20px;}
        .logout{color:red;text-decoration:none;font-size:14px;font-weight:bold;}
        .status{padding:15px;background:${isBotActive ? '#d4edda' : '#f8d7da'};color:${isBotActive ? '#155724' : '#721c24'};border-radius:8px;font-weight:bold;margin-bottom:20px;}
        .btn{padding:12px 20px;border:none;border-radius:6px;cursor:pointer;color:white;font-weight:bold;width:100%;margin-bottom:10px;}
        .btn-toggle{background:${isBotActive ? '#dc3545' : '#28a745'};}
        .btn-send{background:#007bff;}
        .box{background:#f8f9fa;padding:15px;border-radius:8px;margin-bottom:20px;text-align:right;border:1px solid #dee2e6;}
        textarea, select, input{width:100%;padding:10px;margin-top:5px;box-sizing:border-box;border:1px solid #ccc;border-radius:5px;}
        .history{font-size:13px;} .user-row{display:flex;justify-content:space-between;border-bottom:1px solid #eee;padding:5px 0;}
    </style></head>
    <body>
        <div class="card">
            <div class="header">
                <div>שלום, <strong>${currentUser.username}</strong> (${roleHebrew})</div>
                <a href="/logout" class="logout">🚪 התנתק</a>
            </div>
            
            <h2>🤖 בוט הדילים</h2>
            <div class="status">${botStatus}</div>

            ${isEditor ? `
            <form action="/toggle" method="POST">
                <button type="submit" class="btn btn-toggle">${isBotActive ? '⏸️ השהה את הבוט' : '▶️ הפעל את הבוט'}</button>
            </form>
            <div class="box">
                <form action="/broadcast" method="POST">
                    <strong>📣 שלח הודעה יזומה (ערוץ + וואטסאפ):</strong>
                    <textarea name="custom_msg" required></textarea>
                    <button type="submit" class="btn btn-send">שגר הודעה</button>
                </form>
            </div>
            ` : '<div class="box" style="text-align:center;">👁️ יש לך הרשאות צפייה בלבד.</div>'}

            <div class="box history">
                <strong>📜 פעולות אחרונות:</strong><br>
                ${dealHistory.length ? dealHistory.map(d => `<div>⏰${d.time} | ${d.title.substring(0,35)}...</div>`).join('') : 'אין נתונים'}
                <hr>
                🛍️ סה"כ דילים בכספת: <strong>${sentProducts.size}</strong><br>
                ⚠️ שגיאה אחרונה: ${lastErrorTime} (${lastErrorMessage})
            </div>

            ${isAdmin ? `
            <div class="box">
                <strong style="color:#d35400;">👑 ניהול משתמשים (מנהל בלבד)</strong>
                <hr>
                ${users.map(u => `
                    <div class="user-row">
                        <span>👤 ${u.username} (${u.role})</span>
                        ${u.username !== currentUser.username ? `<form action="/delete_user" method="POST" style="margin:0;"><input type="hidden" name="del_username" value="${u.username}"><button type="submit" style="background:red;color:white;border:none;border-radius:3px;cursor:pointer;">מחק</button></form>` : ''}
                    </div>
                `).join('')}
                <hr>
                <form action="/add_user" method="POST">
                    <input type="text" name="new_username" placeholder="שם משתמש חדש" required>
                    <input type="text" name="new_password" placeholder="סיסמה" required>
                    <select name="new_role">
                        <option value="viewer">צופה (Viewer)</option>
                        <option value="editor">עורך (Editor)</option>
                        <option value="admin">מנהל (Admin)</option>
                    </select>
                    <button type="submit" class="btn" style="background:#28a745; margin-top:10px;">➕ הוסף משתמש</button>
                </form>
            </div>
            ` : ''}

            <button onclick="location.reload()" style="padding:10px; border-radius:5px; cursor:pointer;">🔄 רענן עמוד</button>
        </div>
    </body></html>
    `);
}).listen(port);
