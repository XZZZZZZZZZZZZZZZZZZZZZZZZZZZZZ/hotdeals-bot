const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

const CHAT_ENDPOINT = "https://dilim.clickandgo.cfd/api/import/post";
const CHAT_TOKEN = "987654321";


// ==========================
// בדיקת שעות לפי שעון ישראל
// ==========================
function isAllowedTime() {
  const now = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Jerusalem" })
  );

  const hour = now.getHours();
  const day = now.getDay(); 
  // 0=ראשון ... 5=שישי, 6=שבת

  // שבת לפני 23:00 – אסור
  if (day === 6 && hour < 23) return false;

  // מוצ"ש 23:00–01:00
  if (day === 6 && hour >= 23) return true;

  // ראשון–חמישי 10:00–01:00
  if (day >= 0 && day <= 4) {
    if (hour >= 10 || hour < 1) return true;
    return false;
  }

  // שישי 10:00–13:00
  if (day === 5) {
    if (hour >= 10 && hour < 13) return true;
    return false;
  }

  return false;
}


// ==========================
// שליחת דיל אוטומטית
// ==========================
async function postDeal() {
  if (!isAllowedTime()) {
    console.log("⏳ מחוץ לשעות פרסום");
    return;
  }

  try {
    await axios.post(
      CHAT_ENDPOINT,
      {
        text: "🔥 דיל אוטומטי מהבוט",
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
    console.error("❌ שגיאה בשליחה:", err.message);
  }
}


// ==========================
// לולאה כל 20 דקות
// ==========================
postDeal();

setInterval(() => {
  postDeal();
}, 20 * 60 * 1000);


// שרת חי
app.get("/", (req, res) => {
  res.send("HotDeals Bot is running 🚀");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
