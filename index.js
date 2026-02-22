const express = require("express");
const axios = require("axios");
const crypto = require("crypto");

const app = express();

const CHAT_ENDPOINT = "https://dilim.clickandgo.cfd/api/import/post";
const CHAT_TOKEN = "987654321";

// ===== משתני סביבה =====
const ALI_APP_KEY = process.env.ALI_APP_KEY;
const ALI_APP_SECRET = process.env.ALI_APP_SECRET;
const ALI_TRACKING_ID = process.env.ALI_TRACKING_ID;

console.log("APP_KEY:", ALI_APP_KEY ? "OK" : "MISSING");
console.log("APP_SECRET:", ALI_APP_SECRET ? "OK" : "MISSING");
console.log("TRACKING_ID:", ALI_TRACKING_ID ? "OK" : "MISSING");

// ===== פונקציית חתימה =====
function sign(params) {
  const sorted = Object.keys(params)
    .sort()
    .map(key => key + params[key])
    .join("");

  const signStr = ALI_APP_SECRET + sorted + ALI_APP_SECRET;

  return crypto
    .createHash("md5")
    .update(signStr)
    .digest("hex")
    .toUpperCase();
}

// ===== שליפת מוצרים =====
async function fetchAliProducts() {
  try {
    const timestamp = new Date().toISOString().replace(/[-:]/g, "").split(".")[0];

    const params = {
      app_key: ALI_APP_KEY,
      method: "aliexpress.affiliate.product.search",
      sign_method: "md5",
      timestamp: timestamp,
      format: "json",
      v: "2.0",
      keywords: "מצלמות אבטחה לבית מצלמות לרכב",
      page_size: 5,
      tracking_id: ALI_TRACKING_ID
    };

    params.sign = sign(params);

    const response = await axios.get(
      "https://api-sg.aliexpress.com/sync",
      { params }
    );

    console.log("API RESPONSE:", JSON.stringify(response.data));

    const products =
      response.data?.aliexpress_affiliate_product_search_response
        ?.resp_result?.result?.products;

    if (!products || products.length === 0) {
      console.log("❌ לא נמצאו מוצרים");
      return null;
    }

    // מסנן מוצרים לא רצויים
    const filtered = products.filter(p => {
      const title = (p.product_title || "").toLowerCase();
      return !title.includes("women") && !title.includes("girl");
    });

    if (filtered.length === 0) {
      console.log("❌ כל המוצרים סוננו");
      return null;
    }

    return filtered[0];

  } catch (err) {
    console.log("❌ שגיאת API:", err.response?.data || err.message);
    return null;
  }
}

// ===== שליחה לצ'אט =====
async function sendToChat(product) {
  if (!product) return;

  const message = `
🔥 דיל חדש!
📦 ${product.product_title}

💰 מחיר: $${product.target_sale_price}

🔗 קישור:
${product.promotion_link}
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

  console.log("✅ נשלח לצ'אט");
}

// ===== שליחה מיידית לבדיקה =====
app.get("/force", async (req, res) => {
  const product = await fetchAliProducts();
  await sendToChat(product);
  res.send("בוצעה בדיקה");
});

// ===== בדיקה שהשרת עובד =====
app.get("/", (req, res) => {
  res.send("🚀 HotDeals Bot פועל");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("שרת פועל על פורט " + PORT);
});
