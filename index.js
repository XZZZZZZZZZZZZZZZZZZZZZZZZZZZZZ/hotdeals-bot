const express = require('express');

const app = express();
const PORT = process.env.PORT || 8080;

app.get('/', (req, res) => {
  res.send('הבוט מחובר ועובד');
});

app.get('/send', (req, res) => {
  res.send('route send עובד');
});

app.listen(PORT, () => {
  console.log(שרת פעיל על פורט ${PORT});
});
