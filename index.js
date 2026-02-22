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

function sign(params) {
  const sorted = Object.keys(params).sort();
  let base = ALI_APP_SECRET;

  sorted.forEach(key => {
    base += key + params[key];
  });

  base += ALI_APP_SECRET;

  return crypto.createHash("sha256").update(base).digest("hex").toUpperCase();
}

async function searchAndSend() {
  try {

    const params = {
      method: "aliexpress.affiliate.product.search",
      app_key: ALI_APP_KEY,
      timestamp: new Date().toISOString(),
      format: "json",
      v: "2.0",
      sign_method: "sha256",
      keywords: "home security camera",
      tracking_id: ALI_TRACKING_ID,
      fields: "product_title,product_main_image_url,sale_price,product_detail_url"
    };

    params.sign = sign(params);

    const response = await axios.get(
      "https://api-sg.aliexpress.com/sync",
      { params }
    );

    const products =
      response.data?.aliexpress_affiliate_product_search_response
        ?.resp_result?.result?.products;

    if (!products || products.length === 0) {
      console.log("❌ לא נמצאו מוצרים");
      return;
    }

    const product = products[0];

    const title = product.product_title;

    // סינון בסיסי של מילים לא רצויות
    const bannedWords = ["woman", "women", "girl", "bikini", "dress"];
    const lower = title.toLowerCase();

    if (bannedWords.some(w => lower.includes(w))) {
      console.log("⛔ מוצר נפסל בגלל סינון");
      return;
    }

    const message = `
✨ דיל חם במיוחד!

📦 ${product.product_title}

💰 מחיר: ${product.sale_price} $

🔗 קישור:
${product.product_detail_url}?aff_fcid=${ALI_TRACKING_ID}
`;

    await axios.post(
      CHAT_ENDPOINT,
      {
        text: message,
        author: "HotDeals Bot",
        timestamp: new Date().toISOString()
      },
      {
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": CHAT_TOKEN
        }
      }
    );

    console.log("✅ נשלח בהצלחה");

  } catch (err) {
    console.log("❌ שגיאה:", err.response?.data || err.message);
  }
}

app.get("/", (req, res) => {
  res.send("Bot Running");
});

// שליחה ידנית לבדיקה
app.get("/force", async (req, res) => {
  await searchAndSend();
  res.send("ניסיון שליחה הופעל");
});

// שליחה אוטומטית כל 20 דקות
setInterval(searchAndSend, 20 * 60 * 1000);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("שרת פועל על פורט " + PORT);
});
