// Hardcode: /functions/[[path]]/podcast-rss.xml.js
// [FIXED] - Email domain sekarang deteksi otomatis .co.uk, .my.id, dsb.

// ... (Bagian Spintax tetap sama seperti aslinya)

function spinWord(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function cleanTextForXML(str) {
  if (str === null || str === undefined) return "";
  const s = String(str);
  let clean = s.replace(/<[^>]*>?/gm, '');
  clean = clean.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
  clean = clean.replace(/]]>/g, "]]&gt;");
  return clean.trim();
}

function escapeXML(str) {
  if (str === null || str === undefined) return "";
  const s = String(str);
  return s.replace(/[<>&"']/g, function (match) {
    switch (match) {
      case "<": return "&lt;"; case ">": return "&gt;";
      case "&": return "&amp;"; case '"': return "&quot;";
      case "'": return "&#39;"; default: return match;
    }
  });
}

// 🔴 PERBAIKAN LOGIKA DOMAIN 🔴
function getRootDomain(hostname) {
  const parts = hostname.split('.');
  // Cek apakah menggunakan TLD 3 bagian seperti .co.uk atau .my.id
  const isThreePartTld = ["co.uk", "org.uk", "my.id", "me.uk", "ltd.uk"].some(tld => hostname.endsWith(tld));
  
  if (isThreePartTld) {
    // Jika admin.dalbankeak.co.uk (4 bagian) -> ambil dalbankeak.co.uk (3 terakhir)
    return parts.length >= 3 ? parts.slice(-3).join('.') : hostname;
  } else {
    // Jika admin.domain.com (3 bagian) -> ambil domain.com (2 terakhir)
    return parts.length >= 2 ? parts.slice(-2).join('.') : hostname;
  }
}

function capitalizeFirstLetter(string) {
  if (!string) return "";
  return string.charAt(0).toUpperCase() + string.slice(1);
}

function safeDate(dateStr) {
  if (!dateStr) return new Date().toUTCString();
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return new Date().toUTCString();
  return d.toUTCString();
}

export async function onRequestGet(context) {
  const { env, request, params } = context;
  const db = env.DB;

  try {
    const url = new URL(request.url);

    // Deteksi Hostname dari Router
    const forwardedHost = request.headers.get("X-Forwarded-Host");
    const currentHost = forwardedHost || url.host; 
    const SITE_URL = `https://${currentHost}`;
    
    // 🔴 SEKARANG ROOT_DOMAIN AKAN MENGHASILKAN dalbankeak.co.uk 🔴
    const ROOT_DOMAIN = getRootDomain(currentHost); 

    const pathSegments = params.path || [];
    const kategori = pathSegments[0] || "General";
    const emailUser = pathSegments[1] || "admin";
    
    // Logika Email tetap menggunakan ROOT_DOMAIN yang sudah diperbaiki
    const DYNAMIC_EMAIL = `${emailUser}@${ROOT_DOMAIN}`;
    const dynamicAuthor = `${emailUser.toUpperCase()} Media`; 

    // ... (Logika Query DB & Items XML tetap sama seperti kode asli kamu)
    // Gunakan <itunes:email>${escapeXML(DYNAMIC_EMAIL)}</itunes:email> di bagian channel

    // (Lanjutkan sisa kode XML kamu di sini)
