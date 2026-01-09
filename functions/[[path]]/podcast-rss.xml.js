// Hardcode: /functions/[[path]]/podcast-rss.xml.js

// 1. DAFTAR SPINTAX ASLI
const SPINTAX_PREFIX = ["Download", "Get", "Read", "Free", "Grab", "Full", "Télécharger", "Lire", "Obtenir", "Gratuit", "Herunterladen", "Lesen", "Holen", "Gratis", "Descargar", "Leer", "Obtener", "Scarica", "Leggi", "Downloaden"];
const SPINTAX_SUFFIX = ["PDF", "ePub", "Ebook", "Audiobook", "Full Version", "PDF Complet", "Version Complète", "Vollversion", "Libro Electrónico", "Versión Kompleta", "Versione Kompleta", "PDF 2025"];
const SPINTAX_TITLE_ADJ = ["Exclusive", "Top", "Best", "Premium", "Official", "Viral", "Trending", "Hot", "New", "Daily", "Ultimate", "Complete", "Master", "Pro"];
const SPINTAX_TITLE_NOUN = ["Podcast", "Show", "Channel", "Station", "Audio", "Series", "Hub", "Spot", "Zone", "Network"];

function spinWord(array) {
  return array[Math.floor(Math.random() * array.length)];
}

// 2. PEMBERSIHAN EKSTRIM (ZERO EMOJI & ASCII ONLY)
function cleanTextForXML(str) {
  if (!str) return "";
  let clean = String(str).replace(/<[^>]*>?/gm, ''); 
  // Menghapus emoji (👉, 📌, 🔗) dan karakter non-ASCII untuk menghindari Encoding Error
  clean = clean.replace(/[^\x20-\x7E]/g, ""); 
  return clean.replace(/]]>/g, "]]&gt;").trim(); 
}

function escapeXML(str) {
  if (!str) return "";
  return String(str).replace(/[<>&"']/g, m => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;','\'':'&#39;'}[m]));
}

// 3. LOGIKA ROOT DOMAIN (Mendukung .co.uk, .my.id, dsb)
function getRootDomain(hostname) {
  const parts = hostname.split('.');
  const isThreePartTld = ["co.uk", "org.uk", "my.id", "me.uk", "ltd.uk"].some(tld => hostname.endsWith(tld));
  if (isThreePartTld && parts.length >= 3) {
    return parts.slice(-3).join('.');
  }
  return parts.length >= 2 ? parts.slice(-2).join('.') : hostname;
}

// 4. GENERATOR ETAG UNTUK VALIDATOR
async function generateETag(string) {
  const msgUint8 = new TextEncoder().encode(string);
  const hashBuffer = await crypto.subtle.digest('SHA-1', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function onRequestGet(context) {
  const { env, request, params } = context;
  const db = env.DB; 

  try {
    const url = new URL(request.url);
    const forwardedHost = request.headers.get("X-Forwarded-Host");
    const currentHost = forwardedHost || url.host; 
    const SITE_URL = `https://${currentHost}`;
    const ROOT_DOMAIN = getRootDomain(currentHost); 

    const pathSegments = params.path || [];
    const kategori = pathSegments[0] || "General";
    const emailUser = pathSegments[1] || "admin";
    
    const DYNAMIC_EMAIL = `${emailUser}@${ROOT_DOMAIN}`;
    const dynamicAuthor = `${emailUser.toUpperCase()} Media`; 
    const feedTitle = `${emailUser.toUpperCase()} ${spinWord(SPINTAX_TITLE_ADJ)} ${spinWord(SPINTAX_TITLE_NOUN)}`;
    const channelCoverUrl = "https://images.pexels.com/photos/415071/pexels-photo-415071.jpeg";

    // 5. QUERY DATABASE (Menggunakan nama kolom akurat: Judul, Deskripsi, KodeUnik, tangal)
    const query = "SELECT Judul, Deskripsi, KodeUnik, tangal, Image FROM Buku WHERE tangal IS NOT NULL AND tangal <= DATE('now') ORDER BY tangal DESC LIMIT 50";
    const { results } = await db.prepare(query).all();

    let itemsXml = "";
    results.forEach((post, i) => {
      const episodeNumber = results.length - i; 
      const postUrl = `${SITE_URL}/post/${post.KodeUnik}`;
      
      // SINKRONISASI: Audio URL harus mengarah ke lokasi [id].mp3.js.mp3.js]
      const audioUrl = `${SITE_URL}/podcast-audio/${post.KodeUnik}.mp3`;
      
      const judulBersih = cleanTextForXML(post.Judul);
      const judulBaru = `${spinWord(SPINTAX_PREFIX)} ${judulBersih} ${spinWord(SPINTAX_SUFFIX)}`;
      
      itemsXml += `<item>
<title>${escapeXML(judulBaru)}</title>
<itunes:title>${escapeXML(judulBaru)}</itunes:title>
<link>${escapeXML(postUrl)}</link>
<guid isPermaLink="false">${escapeXML(post.KodeUnik)}</guid>
<description><![CDATA[${cleanTextForXML(post.Deskripsi).substring(0, 300)}... Download: ${postUrl}]]></description>
<pubDate>${new Date(post.tangal).toUTCString()}</pubDate>
<enclosure url="${escapeXML(audioUrl)}" type="audio/mpeg" length="1024000"/>
<itunes:author>${escapeXML(dynamicAuthor)}</itunes:author>
<itunes:duration>600</itunes:duration>
<itunes:episode>${episodeNumber}</itunes:episode>
<itunes:episodeType>full</itunes:explicit>
<itunes:explicit>no</itunes:explicit>
${post.Image ? `<itunes:image href="${escapeXML(post.Image)}"/>` : ""}
</item>`;
    }); 

    // 6. RAKIT FINAL XML (Tanpa spasi awal untuk kestabilan parser)
    const xmlBody = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
<title>${escapeXML(feedTitle)}</title>
<link>${escapeXML(SITE_URL)}</link>
<description><![CDATA[Audio archive for ${cleanTextForXML(kategori)}.]]></description>
<language>en-us</language>
<lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
<atom:link href="${escapeXML(SITE_URL + url.pathname)}" rel="self" type="application/rss+xml"/>
<itunes:author>${escapeXML(dynamicAuthor)}</itunes:author>
<itunes:owner><itunes:name>${escapeXML(dynamicAuthor)}</itunes:name><itunes:email>${escapeXML(DYNAMIC_EMAIL)}</itunes:email></itunes:owner>
<itunes:explicit>no</itunes:explicit>
<itunes:category text="Education"/>
<itunes:image href="${channelCoverUrl}"/>
<image><url>${channelCoverUrl}</url><title>${escapeXML(feedTitle)}</title><link>${escapeXML(SITE_URL)}</link></image>
${itemsXml}
</channel>
</rss>`.trim();

    // 7. HEADER KRUSIAL UNTUK VALIDATOR & FIRSTORY
    const finalXml = xmlBody;
    const xmlBytes = new TextEncoder().encode(finalXml);
    const eTag = await generateETag(finalXml);

    return new Response(finalXml, {
      headers: { 
        "Content-Type": "application/rss+xml; charset=utf-8",
        "Content-Length": xmlBytes.length.toString(), // Mencegah Error 0023
        "ETag": `"${eTag}"`, // Membantu validator mendeteksi perubahan
        "Last-Modified": new Date().toUTCString(),
        "Access-Control-Allow-Origin": "*"
      },
    });

  } catch (e) {
    return new Response(`Error: ${e.message}`, { status: 500 });
  }
}
