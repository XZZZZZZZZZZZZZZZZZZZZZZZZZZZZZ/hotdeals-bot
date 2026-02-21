const express = require("express");
const axios = require("axios");
const crypto = require("crypto");

const app = express();
app.use(express.json());

/* =========================
   הגדרות צ'אט
========================= */
const CHAT_ENDPOINT = "https://dilim.clickandgo.cfd/api/import/post";
const CHAT_TOKEN = "987654321";

/* =========================
   משתני סביבה
========================= */
const ALI_APP_KEY = process.env.ALI_APP_KEY;
const ALI_APP_SECRET = process.env.ALI_APP_SECRET;
const ALI_TRACKING_ID = process.env.ALI_TRACKING_ID;

/* =========================
   מילות מפתח
========================= */
const KEYWORDS = [
  "security camera home",
  "CCTV camera",
  "car dash camera",
  "dash cam for car",
  "LED ceiling light",
  "Bluetooth speaker",
  "Smart watch",
  "Wireless headphones"
];

/* =========================
   מילים חסומות
========================= */
const BLOCKED_WORDS = [
  "women",
  "woman",
  "lady",
  "girl",
  "bikini",
  "lingerie",
  "dress",
  "fashion",
  "bra",
  "panties",
  "swimwear",
  "skirt",
  "sexy"
];

/* =========================
   בדיקת שעות פרסום
========================= */
function isAllowedTime() {
  const now = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Jerusalem" })
  );

  const hour = now.getHours();
  const day = now.getDay(); // 0=ראשון ... 6=שבת

  // שבת – מותר רק מ-23:00 (מוצ"ש)
  if (day === 6) {
    return hour >= 23;
  }

  // שישי – 10:00 עד 13:00
  if (day === 5) {
    return hour >= 10 && hour < 13;
  }

  // ראשון–חמישי
  if (day >= 0 && day <= 4) {
    if (hour >= 10) return true;   // 10:00–23:59
    if (hour < 1) return true;     // 00:00–00:59
    return false;
  }

  return false;
}

/* =========================
   יצירת חתימה ל-Ali
========================= */
function generateSign(params) {
  const sortedKeys = Object.keys(params).sort();
  let baseString = ALI_APP_SECRET;

  sortedKeys.forEach((key) => {
    baseString += key + params[key];
  });

  baseString += ALI_APP_SECRET;

  return crypto.createHash("md5").update(baseString).digest("hex").toUpperCase();
}

/* =========================
   סינון מוצר
========================= */
function isProductAllowed(product) {
  const title = product.product_title?.toLowerCase() || "";
  return !BLOCKED_WORDS.some(word => title.includes(word));
}

/* =========================
   משיכת מוצר
========================= */
async function fetchAliProduct() {
  const keyword = KEYWORDS[Math.floor(Math.random() * KEYWORDS.length)];
  console.log("🔎 מחפש לפי:", keyword);

  const params = {
    method: "aliexpress.affiliate.product.query",
    app_key: ALI_APP_KEY,
    timestamp: new Date().toISOString(),
    format: "json",
    v: "2.0",
    sign_method: "md5",
    keywords: keyword,
    tracking_id: ALI_TRACKING_ID,
    page_size: 20,
    fields:
      "product_title,product_detail_url,sale_price,product_main_image_url,evaluate_rate"
  };

  params.sign = generateSign(params);

  const response = await axios.get("https://api-sg.aliexpress.com/sync", {
    params,
  });

  const products =
    response.data?.aliexpress_affiliate_product_query_response?.resp_result?.result?.products;

  if (!products || products.length === 0) {
    console.log("❌ לא נמצאו מוצרים");
    return null;
  }

  const filtered = products.filter(isProductAllowed);

  if (filtered.length === 0) {
    console.log("❌ כל המוצרים נפסלו בסינון");
    return null;
  }

  return filtered[Math.floor(Math.random() * filtered.length)];
}

/* =========================
   שליחת דיל
========================= */
async function postDeal(ignoreTime = false) {

  if (!ignoreTime && !isAllowedTime()) {
    console.log("⏳ מחוץ לשעות פרסום");
    return;
  }

  try {
    const product = await fetchAliProduct();
    if (!product) return;

    const message = `
✨ ${product.product_title} ✨

💡 דיל חם במיוחד!

⭐ דירוג: ${product.evaluate_rate}
💰 מחיר: ${product.sale_price}$

📦 משלוח ישיר עד הבית
🔥 מלאי מוגבל – כדאי למהר!

🛒 להזמנה:
${product.product_detail_url}
`;

    await axios.post(
      CHAT_ENDPOINT,
      {
        text: message,
        author: "HotDeals Bot",
        timestamp: new Date().toISOString(),
      },
      {
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": CHAT_TOKEN,
        },
      }
    );

    console.log("✅ דיל נשלח בהצלחה");
  } catch (err) {
    console.error("❌ שגיאה:", err.response?.data || err.message);
  }
}

/* =========================
   שליחה כל 20 דקות
========================= */
postDeal();
setInterval(postDeal, 20 * 60 * 1000);

/* =========================
   שליחה ידנית (עוקף שעות)
========================= */
app.get("/force", async (req, res) => {
  console.log("🚀 הפעלת שליחה ידנית");
  await postDeal(true);
  res.send("ניסיון שליחה הופעל");
});

/* =========================
   שרת
========================= */
app.get("/", (req, res) => {
  res.send("🚀 בוט HotDeals פועל");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
