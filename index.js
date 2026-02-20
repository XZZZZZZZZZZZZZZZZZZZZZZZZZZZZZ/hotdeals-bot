const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

const CHAT_ENDPOINT = "https://dilim.clickandgo.cfd/api/import/post";
const CHAT_TOKEN = "987654321";

app.get("/", (req, res) => {
  res.send("HotDeals Bot is running 🚀");
});

app.get("/test", async (req, res) => {
  try {
    await axios.post(
      CHAT_ENDPOINT,
      {
        text: "🔥 דיל בדיקה אוטומטי",
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

    res.send("Message sent successfully ✅");
  } catch (err) {
    res.status(500).send("שגיאה: " + err.message);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
