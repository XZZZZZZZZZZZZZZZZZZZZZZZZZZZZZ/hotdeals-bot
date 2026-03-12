# שימוש בגרסה הרשמית של פאפטיר שכבר כוללת כרום
FROM ghcr.io/puppeteer/puppeteer:latest

# מעבר למשתמש שורש כדי למנוע בעיות הרשאות
USER root

WORKDIR /app

# התקנת הספריות של פרויקט הבוט שלך
COPY package*.json ./
RUN npm install

# העתקת שאר הקבצים
COPY . .

# הפעלת הפרויקט
CMD ["node", "index.js"]
