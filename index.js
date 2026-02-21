const express = require("express");
const axios = require("axios");
const crypto = require("crypto");

const app = express();

const CHAT_ENDPOINT = "https://dilim.clickandgo.cfd/api/import/post";
const CHAT_TOKEN = "987654321";

const ALI_APP_KEY = process.env.ALI_APP_KEY;
const ALI_APP_SECRET = process.env.ALI_APP_SECRET;
const ALI_TRACKING_ID = process.env.ALI_TRACKING_ID;
console.log("APP KEY:", process.env.ALI_APP_KEY);
console.log("SECRET:", process.env.ALI_APP_SECRET);
console.log("TRACKING:", process.env.ALI_TRACKING_ID);
function getTimestamp() {
  const now = new Date();
  const pad = n => (n < 10 ? "0" + n : n);

  return (
    now.getFullYear() +
    "-" +
    pad(now.getMonth() + 1) +
    "-" +
    pad(now.getDate()) +
    " " +
    pad(now.getHours()) +
    ":" +
    pad(now.getMinutes()) +
    ":" +
    pad(now.getSeconds())
  );
}

function sign(params) {
  const sorted = Object.keys(params).sort();
  let base = ALI_APP_SECRET;

  sorted.forEach(k => {
    base += k + params[k];
  });

  base += ALI_APP_SECRET;

  return crypto.createHash("md5").update(base).digest("hex").toUpperCase();
}

async function sendDeal() {
  try {

    const params = {
      method: "aliexpress.affiliate.product.search",
      app_key: ALI_APP_KEY,
      timestamp: getTimestamp(),
      format: "json",
      v: "2.0",
      sign_method: "md5",
      keywords: "phone",
      tracking_id: ALI_TRACKING_ID,
      page_size: 5
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
      console.log("לא נמצאו מוצרים ❌");
      return;
    }

    const p = products[0];

    const text = `
🔥 ${p.product_title}

💰 מחיר: ${p.sale_price}$

🛒 קישור:
${p.product_detail_url}
`;

    await axios.post(
      CHAT_ENDPOINT,
      {
        text,
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

    console.log("נשלח בהצלחה ✅");

  } catch (err) {
    console.log("שגיאה:", err.response?.data || err.message);
  }
}

// שולח מיד כשהשרת עולה
sendDeal();

app.get("/", (req, res) => {
  res.send("בדיקת API פעילה");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running");
});
