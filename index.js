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

// השרת שאליו נשלח המידע ראשון
const CHANNEL_API_URL = "https://dilim.clickandgo.cfd/api/import/post";
const API_KEY = "987654321";

// הגדרות וואטסאפ (ID הקבוצה שלך)
const WA_CHAT_ID = "120363407216029255@g.us"; 

// שם קובץ מילות המפתח
const KEYWORDS_FILE = "keywords.json";

// שמירת פנקס המוצרים בתוך הכונן המוגן (הכספת)
const SENT_FILE = "./.wwebjs_auth/sent_products.json";

// משתני הגנה ורמזורים
let isFetching = false;
let isWaReady = false; 

// אתחול לקוח הוואטסאפ - עם תוספת ה-Timeout הכפול
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
    isWaReady = true;
});

waClient.on("auth_failure", msg => {
    console.error("❌ שגיאה באימות הוואטסאפ:", msg);
});

waClient.initialize();

let sentProducts = new Set();

// מוודאים שתיקיית הכספת קיימת לפני שמנסים לקרוא ממנה
if (!fs.existsSync("./.wwebjs_auth")) {
    fs.mkdirSync("./.wwebjs_auth", { recursive: true });
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
  if (!price) {
    return 0;
  }
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
  } catch (err) {
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

  try {
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
      messages: [
        { role: "user", content: prompt }
      ],
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
  // בדיקת הרמזור: האם יש כבר חיפוש שרץ כרגע?
  if (isFetching) {
    console.log("⏳ חיפוש כבר פועל ברקע! עוצר את ההרצה הנוכחית כדי למנוע כפילויות.");
    return;
  }
  
  // חסימת ההרצה אם וואטסאפ עדיין לא מוכן לגמרי
  if (!isWaReady) {
    console.log("⏳ וואטסאפ עדיין בתהליכי התחברות. ממתין לסיבוב הבא בעוד 20 דקות...");
    return;
  }

  // מדליק את הרמזור - אני מתחיל לעבוד
  isFetching = true;

  try {
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
        if (postCounter % 5 === 0) {
          maxPrice = 300;
        }

        let selectedProduct = null;
        let affiliateLink = null;

        for (const product of products) {
          // בודק בפנקס אם כבר שלחנו את המוצר הזה
          if (sentProducts.has(product.product_id)) {
            continue;
          }

          const price = extractLowestPrice(product);
          if (!price || price < minPrice || price > maxPrice) {
            continue;
          }
          
          if (product.sale_volume < 50) {
            continue;
          }

          console.log(`✅ נמצא מוצר מתאים! מייצר לינק שותפים...`);
          const link = await generateAffiliateLink(product.product_detail_url);

          if (link) {
            selectedProduct = product;
            affiliateLink = link;
            break;
          }
        }

        if (selectedProduct && affiliateLink) {
          foundDeal = true;
          console.log("✅ נמצא מוצר זהב! מכין טקסט שיווקי משודרג...");
          const rawPrice = extractLowestPrice(selectedProduct);
          const finalPrice = Math.floor(rawPrice * 100) / 100;
          
          const messageBodyText = await generateMarketingText(selectedProduct.product_title, finalPrice);
          const imgUrl = `https://images.weserv.nl/?w=400&url=${selectedProduct.product_main_image_url.replace("https://", "")}`;

          const channelMessageText = `![](${imgUrl})\n\n${messageBodyText}\n\n🛒 לינק לרכישה:\n${affiliateLink}`;
          
          console.log("🚀 שולח ל-API של הערוץ...");
          await sendToChannel(channelMessageText);
          
          console.log("🚀 מוריד תמונה לוואטסאפ (עם סטופר של 15 שניות)...");
          try {
            // השרת מוריד את התמונה בעצמו. אם השירות האיטי נתקע, זה יחתוך אותו אחרי 15 שניות.
            const imageResponse = await axios.get(imgUrl, { 
                responseType: 'arraybuffer', 
                timeout: 15000 
            });
            
            const mimetype = imageResponse.headers['content-type'] || 'image/jpeg';
            const base64Data = Buffer.from(imageResponse.data, 'binary').toString('base64');
            const media = new MessageMedia(mimetype, base64Data, 'deal.jpg');
            
            await waClient.sendMessage(WA_CHAT_ID, media, { caption: `${messageBodyText}\n\n🛒 לינק לרכישה:\n${affiliateLink}` });
            console.log("✅ הדיל והתמונה המוקטנת נשלחו לוואטסאפ בהצלחה!");
            
          } catch (waErr) {
            console.log("⚠️ אתר הקטנת התמונות היה איטי מדי או קרס, שולח רק טקסט בינתיים. שגיאה:", waErr.message);
            await waClient.sendMessage(WA_CHAT_ID, `${messageBodyText}\n\n🛒 לינק לרכישה:\n${affiliateLink}`);
          }
          
          // רושם בפנקס ושומר בכספת!
          sentProducts.add(selectedProduct.product_id);
          fs.writeFileSync(SENT_FILE, JSON.stringify([...sentProducts]));
          
          break; 

        } else {
          console.log(`⚠️ כל המוצרים בעמוד ${currentPage} כבר נשלחו או לא מתאימים. עובר מיד לעמוד ${currentPage + 1}...`);
          keywordPages[currentKeyword]++; 
          pagesSearched++;
        }

      } catch (err) {
        console.log("❌ שגיאה כללית במהלך סריקת העמוד:", err.message);
        
        // פרוטוקול הזומבי - אם הדפדפן קפא, מכבים ומדליקים מיד!
        if (err.message.includes("timed out") || err.message.includes("Session closed")) {
            console.log("🚨 דפדפן הוואטסאפ קפא לגמרי מרוב עומס זיכרון! מבצע ריסטרט חירום כדי להתאושש...");
            process.exit(1); 
        }
        
        break; 
      }
    }

    if (!foundDeal && pagesSearched >= MAX_PAGES_TO_SEARCH) {
      console.log(`⏳ חיפשתי ב-${MAX_PAGES_TO_SEARCH} עמודים ברצף למילה "${currentKeyword}" ולא מצאתי כלום. אני אנוח ואנסה מילה אחרת בחיפוש הבא.`);
    }

  } catch (error) {
    console.log("❌ שגיאה בלתי צפויה:", error.message);
  } finally {
    // מכבה את הרמזור בסיום העבודה, לא משנה מה קרה
    isFetching = false;
  }
}

const cronOptions = { timezone: "Asia/Jerusalem" };
cron.schedule("*/20 8-23 * * 0-4", fetchDeal, cronOptions);
cron.schedule("*/20 8-14 * * 5", fetchDeal, cronOptions);
cron.schedule("*/20 22-23 * * 6", fetchDeal, cronOptions);
cron.schedule("*/20 0-1 * * 0", fetchDeal, cronOptions);

// הפתרון שלנו: רענון אוטומטי מלא לזיכרון של השרת 3 פעמים ביום!
cron.schedule("0 3,11,19 * * *", () => {
    console.log("🔄 מבצע רענון זיכרון יומי אוטומטי! מכבה את השרת כדי ש-Koyeb ידליק אותו נקי...");
    process.exit(1); 
}, cronOptions);

console.log("⏳ השרת עלה וממתין לחיבור הוואטסאפ (לא מחפש עד שמוכן)...");

setInterval(() => {}, 1000);

// --- סוף הקוד המלא, המקורי והמרווח ---
