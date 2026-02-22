const express = require("express");
const axios = require("axios");

const app = express();

app.get("/", (req, res) => {
  res.send("הבוט חי ועובד 🚀");
});

app.get("/test", async (req, res) => {
  res.send("ה-route עובד ✅");
});

const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log("שרת פועל על פורט " + PORT);
});
