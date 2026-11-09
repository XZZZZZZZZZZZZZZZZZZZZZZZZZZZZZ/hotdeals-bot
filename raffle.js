// 🎟️ הגרלה שבועית: הרשמה עם אימות במייל, קישור אישי, וכרטיס לכל מבקר חדש שנכנס דרכו
// שליחת מיילים - אחת משתי אפשרויות (משתני סביבה):
//   1. "שלח מסר": SENDMSG_SITE_ID, SENDMSG_PASSWORD (סיסמת API מהתמיכה שלהם), SENDMSG_SENDER_EMAIL, SENDMSG_SENDER_NAME
//   2. SMTP: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM
const fs = require("fs");
const crypto = require("crypto");
const querystring = require("querystring");
const axios = require("axios");

const DATA_FILE = "./bot_data/raffle.json";
const MAX_TICKETS_PER_DAY = 20;          // תקרת כרטיסים ליום למשתתף (נגד רמאויות)
const CODE_TTL = 10 * 60 * 1000;         // קוד אימות תקף ל-10 דקות
const PRIZE = "20 ש\"ח";
const SITE_NAME = "דילים שפשוט חבל לפספס";
// מיילים זמניים - חסומים כדי שלא יפתחו חשבונות בלי סוף
const DISPOSABLE = ["mailinator.com", "yopmail.com", "guerrillamail.com", "10minutemail.com", "tempmail.com", "temp-mail.org", "trashmail.com", "sharklasers.com", "getnada.com", "dispostable.com", "maildrop.cc", "mohmal.com", "emailondeck.com", "fakeinbox.com"];

let cfg = {};
let transport = null;
let db = { salt: crypto.randomBytes(16).toString("hex"), participants: {}, round: { started: Date.now(), tickets: {}, seen: {}, daily: {} }, winners: [] };
if (fs.existsSync(DATA_FILE)) { try { db = Object.assign(db, JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"))); } catch (e) {} }
function save() { fs.writeFileSync(DATA_FILE, JSON.stringify(db)); }

const pending = {};                       // email -> { code, expires, tries }
const hits = {};                          // rate-limit buckets

function init(c) { cfg = c || {}; if (cfg.transport) transport = cfg.transport; }

function mailer() {
  if (transport) return transport;
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) return null;
  const nodemailer = require("nodemailer");
  transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 465), secure: Number(process.env.SMTP_PORT || 465) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });
  return transport;
}
// ---- שליחה דרך "שלח מסר" (SendMsg API 4.0) ----
const SENDMSG_API = process.env.SENDMSG_API_URL || "https://gconvertrest.sendmsg.co.il/api/Sendmsg/";
let smToken = null, smTokenAt = 0;
function sendmsgConfigured() { return !!(process.env.SENDMSG_SITE_ID && process.env.SENDMSG_PASSWORD); }
async function sendmsgToken(force) {
  if (!force && smToken && Date.now() - smTokenAt < 11 * 3600 * 1000) return smToken;   // הטוקן תקף 12 שעות
  const r = await axios.post(SENDMSG_API + "token", { siteID: Number(process.env.SENDMSG_SITE_ID), password: process.env.SENDMSG_PASSWORD }, { timeout: 15000 });
  const tok = r.data && (r.data.Token || r.data.token);
  if (!tok) throw new Error("SendMsg: לא התקבל טוקן (" + JSON.stringify(r.data).slice(0, 200) + ")");
  smToken = tok; smTokenAt = Date.now(); return tok;
}
async function sendViaSendmsg(to, subject, text, info) {
  const html = "<div dir=\"rtl\" style=\"font-family:Arial,sans-serif;font-size:16px;line-height:1.6\">" + esc(text).replace(/\n/g, "<br>") + "</div>";
  const body = {
    users: [{ EmailAddress: to, Cellphone: info && info.phone ? "0" + info.phone.slice(3) : "", FirstName: (info && info.name) || "" }],
    Message: { MessageContent: html, MessageSubject: subject, SenderEmailAddress: process.env.SENDMSG_SENDER_EMAIL || undefined,
      SenderName: process.env.SENDMSG_SENDER_NAME || SITE_NAME, MessageDirection: 1, MessageInnerName: "הגרלה - " + subject.slice(0, 40),
      AddFacebook: false, AddForward: false, AddShowMessage: false }
  };
  const post = async token => axios.post(SENDMSG_API + "AddUsersAndSend?included_self_removed=true", body,
    { headers: { Authorization: token, "Content-Type": "application/json; charset=utf-8" }, timeout: 20000, validateStatus: () => true });
  let r = await post(await sendmsgToken());
  if (r.status === 401) r = await post(await sendmsgToken(true));      // טוקן פג - מחדשים פעם אחת
  const d = r.data || {};
  const code = Number(d.result && d.result.ResultID);
  if (r.status >= 300 || d.success === false || (code && code !== 200 && code !== 10000 && (code < 200 || code >= 300))) {
    throw new Error("SendMsg: " + r.status + " " + JSON.stringify(d.result || d).slice(0, 200));
  }
}

function emailConfigured() { return sendmsgConfigured() || !!mailer(); }
async function sendMail(to, subject, text, info) {
  if (sendmsgConfigured()) return sendViaSendmsg(to, subject, text, info);
  const m = mailer();
  if (!m) throw new Error("שליחת מיילים לא מוגדרת (חסרים פרטי SendMsg או SMTP)");
  await m.sendMail({ from: process.env.MAIL_FROM || process.env.SMTP_USER || "raffle@example.com", to, subject, text });
}

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[ch]));
}
function hash(s) { return crypto.createHash("sha256").update(db.salt + s).digest("hex").slice(0, 20); }
function clientIp(req) {
  return (String(req.headers["x-forwarded-for"] || "").split(",")[0].trim()) || req.socket.remoteAddress || "";
}
// כתובת מייל "קנונית": ג'ימייל מתעלם מנקודות ומ-+תוספות, אז a.b+1@gmail.com = ab@gmail.com = חשבון אחד
function normalizeEmail(e) {
  const s = String(e || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/.test(s) || s.length > 100) return null;
  let [user, domain] = s.split("@");
  if (DISPOSABLE.includes(domain)) return null;
  if (domain === "googlemail.com") domain = "gmail.com";
  if (domain === "gmail.com") user = user.replace(/\./g, "");
  user = user.split("+")[0];
  return user ? user + "@" + domain : null;
}
function maskEmail(e) { const [u, d] = e.split("@"); return u.slice(0, 2) + "***@" + d; }
function normalizePhone(p) {                // נייד ישראלי: 05X... או +9725X...
  let d = String(p || "").replace(/\D/g, "");
  if (d.startsWith("0")) d = "972" + d.slice(1);
  return /^9725\d{8}$/.test(d) ? d : null;
}
function prettyPhone(d) { return "0" + d.slice(3, 5) + "-" + d.slice(5); }
function maskPhone(d) { return "0" + d.slice(3, 5) + "-XXX-" + d.slice(-4); }
function findByPhone(phone) { return Object.keys(db.participants).find(id => db.participants[id].phone === phone); }
function rateOk(key, limit, windowMs) {
  const now = Date.now();
  hits[key] = (hits[key] || []).filter(x => now - x < windowMs);
  if (hits[key].length >= limit) return false;
  hits[key].push(now); return true;
}
function newId() {
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let id;
  do { id = ""; for (let i = 0; i < 6; i++) id += abc[crypto.randomInt(abc.length)]; } while (db.participants[id]);
  return id;
}
function findByEmail(email) { return Object.keys(db.participants).find(id => db.participants[id].email === email); }
function baseUrl(req) {
  const proto = String(req.headers["x-forwarded-proto"] || "https").split(",")[0];
  return proto + "://" + req.headers.host;
}
function todayKey() { return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" }); }

function page(title, body) {
  return "<!DOCTYPE html><html dir=\"rtl\" lang=\"he\"><head><meta charset=\"utf-8\"><title>" + esc(title) + "</title>" +
    "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">" +
    "<style>body{font-family:Arial,sans-serif;background:linear-gradient(160deg,#2a0845,#6441a5);color:#fff;margin:0;padding:24px 16px;text-align:center;min-height:100vh;box-sizing:border-box}" +
    ".box{background:#fff;color:#222;border-radius:18px;max-width:420px;margin:0 auto;padding:24px;box-shadow:0 10px 30px rgba(0,0,0,.3)}" +
    "h1{font-size:26px;margin:0 0 6px}h2{font-size:20px;margin:0 0 12px}p{line-height:1.5}" +
    "input,button{width:100%;padding:13px;margin:7px 0;box-sizing:border-box;border-radius:10px;font-size:17px;border:1px solid #ccc}" +
    "button,.btn{background:#25d366;color:#fff;border:none;font-weight:bold;cursor:pointer;display:block;text-decoration:none;padding:14px;border-radius:10px;margin:8px 0}" +
    ".btn2{background:#6441a5}.err{background:#ffe1e1;color:#b00;padding:10px;border-radius:8px;margin:8px 0}.big{font-size:44px;font-weight:bold;color:#6441a5}" +
    ".link{direction:ltr;background:#f2f2f7;padding:10px;border-radius:8px;word-break:break-all;font-size:15px}.small{font-size:13px;color:#666}" +
    "label{display:flex;gap:8px;align-items:flex-start;text-align:right;font-size:14px}label input{width:auto;margin-top:3px}a{color:#6441a5}</style></head>" +
    "<body><h1>🎟️ הגרלה שבועית</h1><p>" + PRIZE + " בכל שבוע · " + SITE_NAME + "</p><div class=\"box\">" + body + "</div></body></html>";
}

function send(res, code, html, headers) {
  res.writeHead(code, Object.assign({ "Content-Type": "text/html; charset=utf-8" }, headers || {}));
  res.end(html);
}

function joinForm(err, name, email, phone) {
  return page("הרשמה להגרלה",
    "<h2>הרשמה להגרלה</h2><p>נרשמים, מקבלים קישור אישי, ומשתפים אותו.<br><b>כל אדם חדש שנכנס דרך הקישור שלכם = כרטיס נוסף להגרלה!</b></p>" +
    (err ? "<div class=\"err\">" + esc(err) + "</div>" : "") +
    "<form method=\"POST\" action=\"/join/send-code\">" +
    "<input name=\"name\" placeholder=\"שם מלא\" required maxlength=\"40\" value=\"" + esc(name) + "\">" +
    "<input name=\"phone\" type=\"tel\" placeholder=\"מספר טלפון נייד\" required inputmode=\"tel\" dir=\"ltr\" value=\"" + esc(phone) + "\">" +
    "<input name=\"email\" type=\"email\" placeholder=\"כתובת מייל\" required dir=\"ltr\" value=\"" + esc(email) + "\">" +
    "<label><input type=\"checkbox\" name=\"consent\" value=\"1\" required> אני מאשר/ת שהטלפון והמייל ישמשו רק לאימות ולעדכון במקרה של זכייה, ומסכים/ה <a href=\"/raffle/rules\">לתקנון</a></label>" +
    "<button type=\"submit\">שלחו לי קוד למייל</button></form>" +
    "<p class=\"small\">כבר רשומים? הכניסו את אותו המייל ותקבלו קוד כניסה.</p>");
}

function codeForm(err, name, email, phone) {
  return page("אימות",
    "<h2>שלחנו לכם קוד למייל 📧</h2><p dir=\"ltr\">" + esc(maskEmail(email)) + "</p><p class=\"small\">לא רואים? בדקו גם בתיקיית הספאם / קידומי מכירות.</p>" +
    (err ? "<div class=\"err\">" + esc(err) + "</div>" : "") +
    "<form method=\"POST\" action=\"/join/verify\">" +
    "<input type=\"hidden\" name=\"email\" value=\"" + esc(email) + "\"><input type=\"hidden\" name=\"name\" value=\"" + esc(name) + "\"><input type=\"hidden\" name=\"phone\" value=\"" + esc(phone) + "\">" +
    "<input name=\"code\" placeholder=\"קוד בן 6 ספרות\" required inputmode=\"numeric\" maxlength=\"6\" autocomplete=\"one-time-code\">" +
    "<button type=\"submit\">אישור</button></form><p class=\"small\"><a href=\"/join\">לא קיבלתם? חזרה</a></p>");
}

function mePage(req, id) {
  const p = db.participants[id];
  const link = baseUrl(req) + "/r/" + id;
  const tickets = db.round.tickets[id] || 0;
  const shareText = "דילים מטורפים מעלי אקספרס, כל יום! 🔥 תיכנסו: " + link;
  return page("הכרטיסים שלי",
    "<h2>שלום " + esc(p.name) + " 👋</h2><p>הכרטיסים שלכם בהגרלה של השבוע:</p><div class=\"big\">" + tickets + "</div>" +
    "<p>הקישור האישי שלכם:</p><div class=\"link\" id=\"lnk\">" + esc(link) + "</div>" +
    "<a class=\"btn\" href=\"https://wa.me/?text=" + encodeURIComponent(shareText) + "\">📤 שיתוף בוואטסאפ</a>" +
    "<button class=\"btn btn2\" onclick=\"navigator.clipboard.writeText(document.getElementById('lnk').innerText);this.innerText='הועתק ✓'\">📋 העתקת הקישור</button>" +
    "<p class=\"small\">כל אדם חדש שנכנס דרך הקישור = כרטיס אחד (עד " + MAX_TICKETS_PER_DAY + " ביום). כניסות חוזרות של אותו אדם, או שלכם, לא נספרות.<br>ההגרלה מתקיימת פעם בשבוע ואז הכרטיסים מתאפסים.</p>" +
    "<p class=\"small\"><a href=\"/raffle/rules\">תקנון</a> · <a href=\"/me/logout\">יציאה</a></p>");
}

function rulesPage() {
  return page("תקנון",
    "<h2>תקנון ההגרלה</h2><div style=\"text-align:right\" class=\"small\">" +
    "<p>1. ההשתתפות חינם ואינה מותנית ברכישה.</p>" +
    "<p>2. כל משתתף נרשם פעם אחת עם שם, מספר טלפון וכתובת מייל מאומתת. חשבון אחד לכל אדם, לכל מספר טלפון ולכל מייל; פתיחת כמה חשבונות תגרום לפסילה.</p>" +
    "<p>3. כל אדם חדש שנכנס דרך הקישור האישי של משתתף מזכה אותו בכרטיס אחד, עד " + MAX_TICKETS_PER_DAY + " כרטיסים ביום. כניסות חוזרות, כניסות של המשתתף עצמו ושימוש בכלים אוטומטיים לא נספרים, ומשתתף שינסה לרמות ייפסל.</p>" +
    "<p>4. אחת לשבוע תיערך הגרלה ממוחשבת בין כל הכרטיסים של אותו שבוע. כל כרטיס = סיכוי אחד. לאחר ההגרלה הכרטיסים מתאפסים.</p>" +
    "<p>5. הפרס: " + PRIZE + ". הזוכה יקבל הודעה למייל שנרשם, וייתכן שניצור איתו קשר גם בטלפון.</p>" +
    "<p>6. הטלפון והמייל ישמשו רק לאימות ולעדכון על זכייה, ולא יועברו לאף גורם.</p>" +
    "<p>7. המארגנים רשאים לשנות או להפסיק את ההגרלה בכל עת.</p></div>" +
    "<a class=\"btn btn2\" href=\"/join\">להרשמה</a>");
}

function readBody(req) {
  return new Promise(resolve => {
    let body = "";
    req.on("data", ch => { body += ch.toString(); if (body.length > 10000) req.destroy(); });
    req.on("end", () => resolve(querystring.parse(body)));
  });
}

function isPublicRoute(path) {
  return path === "/join" || path === "/join/send-code" || path === "/join/verify" || path === "/me" || path === "/me/logout" || path === "/raffle/rules" || path.startsWith("/r/");
}

async function handle(req, res, parsedUrl, cookies) {
  const path = parsedUrl.pathname;
  const ip = clientIp(req);
  const meId = cookies.raffle_id && db.participants[cookies.raffle_id] ? cookies.raffle_id : null;

  // כניסה דרך קישור אישי: סופרים כרטיס פעם אחת לכל מבקר, ומעבירים לאתר
  if (path.startsWith("/r/")) {
    const id = path.slice(3).toUpperCase().replace(/[^A-Z0-9]/g, "");
    let visitor = cookies.v;
    const headers = { "Location": cfg.siteUrl };
    if (!visitor || !/^[a-f0-9]{24}$/.test(visitor)) {
      visitor = crypto.randomBytes(12).toString("hex");
      headers["Set-Cookie"] = "v=" + visitor + "; Max-Age=31536000; Path=/; HttpOnly; SameSite=Lax";
    }
    const owner = db.participants[id];
    if (owner && meId !== id) {
      const ipKey = "i:" + hash(ip), vKey = "v:" + hash(visitor);
      const seen = db.round.seen[id] = db.round.seen[id] || [];
      const ownIp = (owner.ips || []).includes(hash(ip));
      const dayKey = id + "|" + todayKey();
      const today = db.round.daily[dayKey] || 0;
      if (!ownIp && !seen.includes(ipKey) && !seen.includes(vKey) && today < MAX_TICKETS_PER_DAY) {
        seen.push(ipKey, vKey);
        db.round.tickets[id] = (db.round.tickets[id] || 0) + 1;
        db.round.daily[dayKey] = today + 1;
        save();
      }
    }
    res.writeHead(302, headers); res.end(); return;
  }

  if (path === "/raffle/rules") return send(res, 200, rulesPage());

  if (path === "/me/logout") {
    res.writeHead(302, { "Location": "/join", "Set-Cookie": "raffle_id=; Max-Age=0; Path=/" }); res.end(); return;
  }

  if (path === "/me") {
    if (!meId) { res.writeHead(302, { "Location": "/join" }); res.end(); return; }
    const p = db.participants[meId];
    p.ips = p.ips || [];
    if (!p.ips.includes(hash(ip))) { p.ips.push(hash(ip)); p.ips = p.ips.slice(-10); save(); }
    return send(res, 200, mePage(req, meId));
  }

  if (path === "/join" && req.method !== "POST") {
    if (meId) { res.writeHead(302, { "Location": "/me" }); res.end(); return; }
    return send(res, 200, joinForm());
  }

  if (path === "/join/send-code" && req.method === "POST") {
    const f = await readBody(req);
    const name = String(f.name || "").trim().slice(0, 40);
    const email = normalizeEmail(f.email);
    const phone = normalizePhone(f.phone);
    const back = err => send(res, 200, joinForm(err, name, f.email, f.phone));
    if (!name) return back("נא למלא שם");
    if (!phone) return back("מספר טלפון לא תקין (צריך מספר נייד ישראלי)");
    if (!email) return back("כתובת מייל לא תקינה (מיילים זמניים לא מתקבלים)");
    if (f.consent !== "1") return back("צריך לאשר את התנאים");
    const phoneOwner = findByPhone(phone);          // טלפון שכבר שייך לחשבון של מייל אחר = חשבון כפול
    if (phoneOwner && db.participants[phoneOwner].email !== email) return back("מספר הטלפון הזה כבר רשום בחשבון אחר");
    if (!rateOk("ip:" + ip, 10, 3600000)) return back("יותר מדי ניסיונות. נסו שוב בעוד שעה");
    if (!rateOk("em1:" + email, 1, 60000)) return send(res, 200, codeForm("כבר שלחנו קוד לפני רגע. בדקו את המייל", name, email, phone));
    if (!rateOk("em:" + email, 5, 86400000)) return back("יותר מדי קודים למייל הזה היום");
    const code = String(crypto.randomInt(100000, 1000000));
    pending[email] = { code, expires: Date.now() + CODE_TTL, tries: 0 };
    try {
      await sendMail(String(f.email).trim(), "הקוד שלך להגרלה: " + code,
        "שלום " + name + ",\n\nהקוד שלך להרשמה להגרלה השבועית של " + SITE_NAME + " הוא: " + code + "\n\nהקוד בתוקף ל-10 דקות. אם לא ביקשת, אפשר להתעלם מהמייל.", { name, phone });
    } catch (e) {
      console.log("❌ שליחת קוד במייל נכשלה:", e.message);
      return back("לא הצלחנו לשלוח מייל כרגע. נסו שוב מאוחר יותר");
    }
    return send(res, 200, codeForm(null, name, email, phone));
  }

  if (path === "/join/verify" && req.method === "POST") {
    const f = await readBody(req);
    const email = normalizeEmail(f.email);
    const phone = normalizePhone(f.phone);
    const name = String(f.name || "").trim().slice(0, 40);
    const pend = email && pending[email];
    if (!pend || Date.now() > pend.expires || !phone) return send(res, 200, joinForm("הקוד פג תוקף. בקשו קוד חדש", name, f.email, f.phone));
    pend.tries++;
    if (pend.tries > 5) { delete pending[email]; return send(res, 200, joinForm("יותר מדי ניסיונות. בקשו קוד חדש", name, f.email, f.phone)); }
    if (String(f.code || "").trim() !== pend.code) return send(res, 200, codeForm("קוד שגוי, נסו שוב", name, email, phone));
    const phoneOwner = findByPhone(phone);
    if (phoneOwner && db.participants[phoneOwner].email !== email) return send(res, 200, joinForm("מספר הטלפון הזה כבר רשום בחשבון אחר", name, f.email, f.phone));
    delete pending[email];
    let id = findByEmail(email);                      // מייל קיים = אותו חשבון (כניסה ממכשיר חדש)
    if (!id) {
      id = newId();
      db.participants[id] = { name: name || "משתתף", email, phone, contact: String(f.email || "").trim().slice(0, 100), created: Date.now(), ips: [hash(ip)] };
      save();
    } else if (db.participants[id].phone !== phone) {
      db.participants[id].phone = phone; save();       // עדכון טלפון לחשבון קיים (רק אם הוא לא של מישהו אחר - נבדק למעלה)
    }
    res.writeHead(302, { "Location": "/me", "Set-Cookie": "raffle_id=" + id + "; Max-Age=31536000; Path=/; HttpOnly; SameSite=Lax" });
    res.end(); return;
  }

  res.writeHead(302, { "Location": "/join" }); res.end();
}

// ---------- לוח בקרה (מנהל) ----------
function adminHtml() {
  const ids = Object.keys(db.round.tickets).sort((a, b) => db.round.tickets[b] - db.round.tickets[a]);
  const total = ids.reduce((s, id) => s + db.round.tickets[id], 0);
  const rows = ids.slice(0, 15).map(id => {
    const p = db.participants[id] || {};
    return "<div class=\"user-row\"><span>🎟️ " + esc(p.name) + " (" + esc(p.phone ? maskPhone(p.phone) : "") + ")</span><b>" + db.round.tickets[id] + "</b></div>";
  }).join("");
  const last = db.winners.slice(-3).reverse().map(w =>
    "<div>🏆 " + esc(w.date) + ": " + esc(w.name) + " · " + esc(w.phone ? prettyPhone(w.phone) : "") + " · " + esc(w.email || "") + " (" + w.tickets + "/" + w.total + " כרטיסים)</div>").join("");
  return "<div class=\"box\"><strong style=\"color:#6441a5;\">🎟️ הגרלה שבועית</strong><hr>" +
    "נרשמים: <b>" + Object.keys(db.participants).length + "</b> · כרטיסים השבוע: <b>" + total + "</b><br>" +
    "דף הרשמה לשיתוף: <b>/join</b>" + (emailConfigured() ? "" : "<br><span style=\"color:#b00\">⚠️ שליחת מיילים לא מוגדרת (שלח מסר / SMTP) - אי אפשר להירשם</span>") + "<hr>" +
    (rows || "אין עדיין כרטיסים השבוע") + "<hr>" +
    "<form action=\"/raffle/draw\" method=\"POST\" onsubmit=\"return confirm('להגריל זוכה ולאפס את הכרטיסים של השבוע?')\">" +
    "<label style=\"display:flex;gap:6px;justify-content:flex-start;\"><input type=\"checkbox\" name=\"notify\" value=\"1\" checked style=\"width:auto\"> לשלוח לזוכה מייל</label>" +
    "<button type=\"submit\" class=\"btn\" style=\"background:#6441a5;\" " + (total ? "" : "disabled") + ">🎲 הגרל זוכה</button></form>" +
    (last ? "<hr><strong>זוכים אחרונים:</strong>" + last : "") + "</div>";
}

async function draw(notify) {
  const ids = Object.keys(db.round.tickets).filter(id => db.participants[id] && db.round.tickets[id] > 0);
  const total = ids.reduce((s, id) => s + db.round.tickets[id], 0);
  if (!total) return null;
  let pick = crypto.randomInt(total), winnerId = ids[0];
  for (const id of ids) { pick -= db.round.tickets[id]; if (pick < 0) { winnerId = id; break; } }
  const p = db.participants[winnerId];
  const win = { date: new Date().toLocaleDateString("he-IL", { timeZone: "Asia/Jerusalem" }), id: winnerId, name: p.name, phone: p.phone || "", email: p.contact || p.email, tickets: db.round.tickets[winnerId], total };
  db.winners.push(win);
  db.round = { started: Date.now(), tickets: {}, seen: {}, daily: {} };
  save();
  if (notify) {
    try { await sendMail(p.contact || p.email, "🎉 זכית בהגרלה השבועית!", "מזל טוב " + p.name + "!\n\nזכית בהגרלה השבועית של " + SITE_NAME + " (" + PRIZE + ").\nנחזור אליך במייל הזה כדי להעביר את הפרס.", { name: p.name, phone: p.phone }); }
    catch (e) { console.log("❌ מייל לזוכה נכשל:", e.message); }
  }
  return win;
}

module.exports = { init, isPublicRoute, handle, adminHtml, draw };
