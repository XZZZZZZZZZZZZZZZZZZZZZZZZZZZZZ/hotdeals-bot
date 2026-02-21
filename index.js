const express = require("express");
const axios = require("axios");
const crypto = require("crypto");

const app = express();
app.use(express.json());

const CHAT_ENDPOINT = "https://dilim.clickandgo.cfd/api/import/post";
const CHAT_TOKEN = "987654321";

const ALI_APP_KEY = process.env.ALI_APP_KEY;
const ALI_APP_SECRET = process.env.ALI_APP_SECRET;
const ALI_TRACKING_ID = process.env.ALI_TRACKING_ID;

// ===== מילות מפתח =====
const KEYWORDS = [
  "LED ceiling light",
  "Bluetooth speaker",
  "Smart watch",
  "Wireless headphones",
  "Home decor lamp",
  "security camera home",
  "car dash camera",
  "CCTV camera",
  "dash cam for car"
];

// ===== מילים חסומות =====
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
  "skirt"
];

// ===== בדיקת שעות =====
function isAllowedTime() {
  const now = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Jerusalem" })
  );

  const hour = now.getHours();
  const day = now.getDay();

  if (day === 6 && hour < 23) return false;
  if (day === 6 && hour >= 23) return true;

  if (day >= 0 && day <= 4) {
    if (hour >= 10 || hour < 1) return true;
    return false;
  }

  if (day === 5) {
    if (hour >= 10 && hour < 13) return true;
    return false;
  }

  return false;
}

// ===== חתימה לעלי =====
function generateSign(params) {
  const sortedKeys = Object.keys(params).sort();
  let baseString = ALI_APP_SECRET;

  sortedKeys.forEach((key) => {
    baseString += key + params[key];
  });

  baseString += ALI_APP_SECRET;

  return crypto.createHash("md5").update(baseString).digest("hex").toUpperCase();
}

// ===== בדיקת מוצר אם מותר =====
function isProductAllowed(product) {
  const title = product.product_title.toLowerCase();

  return !BLOCKED_WORDS.some(word => title.includes(word));
}

// ===== משיכת מוצר =====
async function fetchAliProduct() {
  const keyword = KEYWORDS[Math.floor(Math.random() * KEYWORDS.length)];

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

  if (!products || products.length === 0) return null;

  const filtered = products.filter(isProductAllowed);

  if (filtered.length === 0) return null;

  return filtered[Math.floor(Math.random() * filtered.length)];
}

// ===== שליחת דיל =====
async function postDeal() {
  if (!isAllowedTime()) {
    console.log("מחוץ לשעות פרסום");
    return;
  }

  try {
    const product = await fetchAliProduct();
    if (!product) {
      console.log("לא נמצאו מוצרים מתאימים");
      return;
    }

    const styledMessage = `
✨ ${product.product_title} ✨

💡 דיל חם במיוחד!

⭐ דירוג: ${product.evaluate_rate}
💰 מחיר מיוחד: ${product.sale_price}$

📦 משלוח ישיר עד הבית
🔥 כדאי למהר לפני שייגמר!

🛒 להזמנה:
${product.product_detail_url}
`;

    await axios.post(
      CHAT_ENDPOINT,
      {
        text: styledMessage,
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

    console.log("דיל נשלח בהצלחה");
  } catch (err) {
    console.error("שגיאה:", err.response?.data || err.message);
  }
}

// ===== שליחה כל 20 דקות =====
postDeal();
setInterval(postDeal, 20 * 60 * 1000);

// ===== שרת =====
app.get("/", (req, res) => {
  res.send("HotDeals Bot is running 🚀");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
