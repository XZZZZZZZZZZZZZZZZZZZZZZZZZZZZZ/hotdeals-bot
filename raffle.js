// 🎟️ הגרלה שבועית: הרשמה עם אימות טלפון בוואטסאפ, קישור אישי, וכרטיס לכל מבקר חדש שנכנס דרכו
const fs = require("fs");
const crypto = require("crypto");
const axios = require("axios");
const querystring = require("querystring");

const DATA_FILE = "./bot_data/raffle.json";
const MAX_TICKETS_PER_DAY = 20;          // תקרת כרטיסים ליום למשתתף (נגד רמאויות)
const CODE_TTL = 10 * 60 * 1000;         // קוד אימות תקף ל-10 דקות
const PRIZE = "20 ש\"ח";

let cfg = {};
let db = { salt: crypto.randomBytes(16).toString("hex"), participants: {}, round: { started: Date.now(), tickets: {}, seen: {}, daily: {} }, winners: [] };
if (fs.existsSync(DATA_FILE)) { try { db = Object.assign(db, JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"))); } catch (e) {} }
function save() { fs.writeFileSync(DATA_FILE, JSON.stringify(db)); }

const pending = {};                       // phone -> { code, expires, tries, name }
const hits = {};                          // rate-limit buckets

function init(c) { cfg = c; }

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[ch]));
}
function hash(s) { return crypto.createHash("sha256").update(db.salt + s).digest("hex").slice(0, 20); }
function clientIp(req) {
  return (String(req.headers["x-forwarded-for"] || "").split(",")[0].trim()) || req.socket.remoteAddress || "";
}
function normalizePhone(p) {                // ישראלי בלבד: 05X... או +9725X...
  let d = String(p || "").replace(/\D/g, "");
  if (d.startsWith("0")) d = "972" + d.slice(1);
  return /^9725\d{8}$/.test(d) ? d : null;
}
function maskPhone(d) { return "0" + d.slice(3, 5) + "-XXX-" + d.slice(-4); }
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
function findByPhone(phone) { return Object.keys(db.participants).find(id => db.participants[id].phone === phone); }
function baseUrl(req) {
  const proto = String(req.headers["x-forwarded-proto"] || "https").split(",")[0];
  return proto + "://" + req.headers.host;
}
function todayKey() { return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" }); }

async function sendWhatsApp(phone, text) {
  const endpoint = cfg.GREEN_API_URL + "/waInstance" + cfg.GREEN_API_ID + "/sendMessage/" + cfg.GREEN_API_TOKEN;
  await axios.post(endpoint, { chatId: phone + "@c.us", message: text }, { timeout: 15000 });
}

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
    "<body><h1>🎟️ הגרלה שבועית</h1><p>" + PRIZE + " בכל שבוע · דילים שפשוט חבל לפספס</p><div class=\"box\">" + body + "</div></body></html>";
}

function send(res, code, html, headers) {
  res.writeHead(code, Object.assign({ "Content-Type": "text/html; charset=utf-8" }, headers || {}));
  res.end(html);
}

function joinForm(err, name, phone) {
  return page("הרשמה להגרלה",
    "<h2>הרשמה להגרלה</h2><p>נרשמים, מקבלים קישור אישי, ומשתפים אותו.<br><b>כל אדם חדש שנכנס דרך הקישור שלכם = כרטיס נוסף להגרלה!</b></p>" +
    (err ? "<div class=\"err\">" + esc(err) + "</div>" : "") +
    "<form method=\"POST\" action=\"/join/send-code\">" +
    "<input name=\"name\" placeholder=\"שם מלא\" required maxlength=\"40\" value=\"" + esc(name) + "\">" +
    "<input name=\"phone\" placeholder=\"מספר טלפון (וואטסאפ)\" required inputmode=\"tel\" value=\"" + esc(phone) + "\">" +
    "<label><input type=\"checkbox\" name=\"consent\" value=\"1\" required> אני מאשר/ת שמספר הטלפון ישמש רק לאימות ולעדכון במקרה של זכייה, ומסכים/ה <a href=\"/raffle/rules\">לתקנון</a></label>" +
    "<button type=\"submit\">שלחו לי קוד בוואטסאפ</button></form>" +
    "<p class=\"small\">כבר רשומים? הכניסו את אותו המספר ותקבלו קוד כניסה.</p>");
}

function codeForm(err, name, phone) {
  return page("אימות",
    "<h2>שלחנו לכם קוד בוואטסאפ 📲</h2><p>למספר " + esc(maskPhone(phone)) + "</p>" +
    (err ? "<div class=\"err\">" + esc(err) + "</div>" : "") +
    "<form method=\"POST\" action=\"/join/verify\">" +
    "<input type=\"hidden\" name=\"phone\" value=\"" + esc(phone) + "\"><input type=\"hidden\" name=\"name\" value=\"" + esc(name) + "\">" +
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
    "<p>2. כל משתתף נרשם פעם אחת עם מספר טלפון ישראלי מאומת. חשבון אחד לכל מספר.</p>" +
    "<p>3. כל אדם חדש שנכנס דרך הקישור האישי של משתתף מזכה אותו בכרטיס אחד, עד " + MAX_TICKETS_PER_DAY + " כרטיסים ביום. כניסות חוזרות, כניסות של המשתתף עצמו ושימוש בכלים אוטומטיים לא נספרים, ומשתתף שינסה לרמות ייפסל.</p>" +
    "<p>4. אחת לשבוע תיערך הגרלה ממוחשבת בין כל הכרטיסים של אותו שבוע. כל כרטיס = סיכוי אחד. לאחר ההגרלה הכרטיסים מתאפסים.</p>" +
    "<p>5. הפרס: " + PRIZE + ". הזוכה יקבל הודעה בוואטסאפ למספר שנרשם.</p>" +
    "<p>6. מספר הטלפון ישמש רק לאימות ולעדכון על זכייה, ולא יועבר לאף גורם.</p>" +
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
    const phone = normalizePhone(f.phone);
    if (!name) return send(res, 200, joinForm("נא למלא שם", name, f.phone));
    if (!phone) return send(res, 200, joinForm("מספר טלפון לא תקין (צריך מספר נייד ישראלי)", name, f.phone));
    if (f.consent !== "1") return send(res, 200, joinForm("צריך לאשר את התנאים", name, f.phone));
    if (!rateOk("ip:" + ip, 10, 3600000)) return send(res, 200, joinForm("יותר מדי ניסיונות. נסו שוב בעוד שעה", name, f.phone));
    if (!rateOk("ph1:" + phone, 1, 60000)) return send(res, 200, codeForm("כבר שלחנו קוד לפני רגע. בדקו את הוואטסאפ", name, phone));
    if (!rateOk("ph:" + phone, 5, 86400000)) return send(res, 200, joinForm("יותר מדי קודים למספר הזה היום", name, f.phone));
    const code = String(crypto.randomInt(100000, 1000000));
    pending[phone] = { code, expires: Date.now() + CODE_TTL, tries: 0 };
    try {
      await sendWhatsApp(phone, "🎟️ הקוד שלך להגרלה של דילים שפשוט חבל לפספס: " + code + "\nהקוד בתוקף ל-10 דקות. אם לא ביקשת, אפשר להתעלם.");
    } catch (e) {
      console.log("❌ שליחת קוד נכשלה:", e.message);
      return send(res, 200, joinForm("לא הצלחנו לשלוח קוד לוואטסאפ. ודאו שהמספר נכון ונסו שוב", name, f.phone));
    }
    return send(res, 200, codeForm(null, name, phone));
  }

  if (path === "/join/verify" && req.method === "POST") {
    const f = await readBody(req);
    const phone = normalizePhone(f.phone);
    const name = String(f.name || "").trim().slice(0, 40);
    const pend = phone && pending[phone];
    if (!pend || Date.now() > pend.expires) return send(res, 200, joinForm("הקוד פג תוקף. בקשו קוד חדש", name, f.phone));
    pend.tries++;
    if (pend.tries > 5) { delete pending[phone]; return send(res, 200, joinForm("יותר מדי ניסיונות. בקשו קוד חדש", name, f.phone)); }
    if (String(f.code || "").trim() !== pend.code) return send(res, 200, codeForm("קוד שגוי, נסו שוב", name, phone));
    delete pending[phone];
    let id = findByPhone(phone);                      // מספר קיים = אותו חשבון (כניסה ממכשיר חדש)
    if (!id) {
      id = newId();
      db.participants[id] = { name: name || "משתתף", phone, created: Date.now(), ips: [hash(ip)] };
      save();
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
    "<div>🏆 " + esc(w.date) + ": " + esc(w.name) + " · 0" + esc(w.phone.slice(3)) + " (" + w.tickets + "/" + w.total + " כרטיסים)</div>").join("");
  return "<div class=\"box\"><strong style=\"color:#6441a5;\">🎟️ הגרלה שבועית</strong><hr>" +
    "נרשמים: <b>" + Object.keys(db.participants).length + "</b> · כרטיסים השבוע: <b>" + total + "</b><br>" +
    "דף הרשמה לשיתוף: <b>/join</b><hr>" + (rows || "אין עדיין כרטיסים השבוע") + "<hr>" +
    "<form action=\"/raffle/draw\" method=\"POST\" onsubmit=\"return confirm('להגריל זוכה ולאפס את הכרטיסים של השבוע?')\">" +
    "<label style=\"display:flex;gap:6px;justify-content:flex-start;\"><input type=\"checkbox\" name=\"notify\" value=\"1\" checked style=\"width:auto\"> לשלוח לזוכה הודעה בוואטסאפ</label>" +
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
  const win = { date: new Date().toLocaleDateString("he-IL", { timeZone: "Asia/Jerusalem" }), id: winnerId, name: p.name, phone: p.phone, tickets: db.round.tickets[winnerId], total };
  db.winners.push(win);
  db.round = { started: Date.now(), tickets: {}, seen: {}, daily: {} };
  save();
  if (notify) {
    try { await sendWhatsApp(p.phone, "🎉 מזל טוב " + p.name + "! זכית בהגרלה השבועית של דילים שפשוט חבל לפספס (" + PRIZE + "). ניצור איתך קשר להעברת הפרס."); }
    catch (e) { console.log("❌ הודעה לזוכה נכשלה:", e.message); }
  }
  return win;
}

module.exports = { init, isPublicRoute, handle, adminHtml, draw };
