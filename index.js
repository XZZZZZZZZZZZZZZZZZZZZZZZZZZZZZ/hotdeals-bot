const express = require("express");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 8080;

const CHAT_ENDPOINT = "https://dilim.clickandgo.cfd/api/import/post";
const CHAT_TOKEN = "987654321"; // אם יש לך טוקן אחר תשים אותו כאן

app.get("/", (req, res) => {
  res.send("הבוט עובד 🚀");
});

app.get("/force", async (req, res) => {
  try {
    await axios.post(
      CHAT_ENDPOINT,
      {
        text: "🚀 בדיקת שליחה – אם אתה רואה את זה הבוט מחובר!",
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

    console.log("✅ נשלחה הודעת בדיקה");
    res.send("נשלחה הודעת בדיקה");
  } catch (err) {
    console.log("❌ שגיאה בשליחה:", err.response?.data || err.message);
    res.send("שגיאה בשליחה");
  }
});

app.listen(PORT, () => {
  console.log("שרת פועל על פורט " + PORT);
});
