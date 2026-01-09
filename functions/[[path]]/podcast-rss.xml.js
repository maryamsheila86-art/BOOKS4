// Hardcode: /functions/[[path]]/podcast-rss.xml.js

// 1. RESTORASI SELURUH SPINTAX ASLI
const SPINTAX_PREFIX = ["Download", "Get", "Read", "Free", "Grab", "Full", "Télécharger", "Lire", "Obtenir", "Gratuit", "Herunterladen", "Lesen", "Holen", "Gratis", "Descargar", "Leer", "Obtener", "Scarica", "Leggi", "Downloaden"];
const SPINTAX_SUFFIX = ["PDF", "ePub", "Ebook", "Audiobook", "Full Version", "PDF Complet", "Version Complète", "Vollversion", "Libro Electrónico", "Versión Kompleta", "Versione Kompleta", "PDF 2025"];
const SPINTAX_TITLE_ADJ = ["Exclusive", "Top", "Best", "Premium", "Official", "Viral", "Trending", "Hot", "New", "Daily", "Ultimate", "Complete", "Master", "Pro"];
const SPINTAX_TITLE_NOUN = ["Podcast", "Show", "Channel", "Station", "Audio", "Series", "Hub", "Spot", "Zone", "Network"];
const EXTERNAL_LINK_INTRO = ["Listen on partner:", "Also available on:", "Mirror link:", "Alternative Source:", "Check out:", "Stream here:"];
const PINTEREST_INTRO = ["Pin this:", "Saved on Pinterest:", "View our Board:", "Follow on Pinterest:", "See collection:"];

function spinWord(array) {
  return array[Math.floor(Math.random() * array.length)];
}

// 2. PEMBERSIHAN EKSTRIM (ZERO EMOJI & ASCII ONLY)
function cleanTextForXML(str) {
  if (!str) return "";
  let clean = String(str).replace(/<[^>]*>?/gm, ''); 
  // Membuang 👉, 📌, 🔗 dan karakter non-standard lainnya
  clean = clean.replace(/[^\x20-\x7E]/g, ""); 
  return clean.replace(/]]>/g, "]]&gt;").trim(); 
}

function escapeXML(str) {
  if (!str) return "";
  return String(str).replace(/[<>&"']/g, m => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;','\'':'&#39;'}[m]));
}

// 3. LOGIKA DOMAIN AKURAT (Support .co.uk, .my.id)
function getRootDomain(hostname) {
  const parts = hostname.split('.');
  const isThreePartTld = ["co.uk", "org.uk", "my.id", "me.uk", "ltd.uk"].some(tld => hostname.endsWith(tld));
  if (isThreePartTld && parts.length >= 3) {
    return parts.slice(-3).join('.');
  }
  return parts.length >= 2 ? parts.slice(-2).join('.') : hostname;
}

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
    const pinterestUserRaw = pathSegments[2] || ""; 
    
    let rawExternalLink = "";
    if (pathSegments.length > 3) {
        const segmentsToJoin = pathSegments.slice(3);
        if (segmentsToJoin[segmentsToJoin.length - 1] === 'podcast-rss.xml') segmentsToJoin.pop();
        if (segmentsToJoin.length > 0) rawExternalLink = segmentsToJoin.join("/");
    }

    const DYNAMIC_EMAIL = `${emailUser}@${ROOT_DOMAIN}`;
    const dynamicAuthor = `${emailUser.toUpperCase()} Media`; 
    const feedTitle = `${emailUser.toUpperCase()} ${spinWord(SPINTAX_TITLE_ADJ)} ${spinWord(SPINTAX_TITLE_NOUN)}`;
    const channelCoverUrl = "https://images.pexels.com/photos/415071/pexels-photo-415071.jpeg";

    // 4. QUERY DATABASE
    const queryParams = [];
    let query = "SELECT Judul, Deskripsi, KodeUnik, tangal FROM Buku WHERE tangal IS NOT NULL AND tangal <= DATE('now')";
    if (kategori && kategori !== "General") {
      query += " AND UPPER(Kategori) = UPPER(?)";
      queryParams.push(kategori);
    }
    query += " ORDER BY tangal DESC LIMIT 50";

    const stmt = db.prepare(query).bind(...queryParams);
    const { results } = await stmt.all();

    // 5. GENERATE ITEMS
    let itemsXml = "";
    results.forEach((post, i) => {
      const episodeNumber = results.length - i; 
      const postUrl = `${SITE_URL}/post/${post.KodeUnik}`;
      const audioUrl = `${SITE_URL}/podcast-audio/${post.KodeUnik}.mp3`;
      const judulBaru = `${spinWord(SPINTAX_PREFIX)} ${cleanTextForXML(post.Judul)} ${spinWord(SPINTAX_SUFFIX)}`;
      
      let extraInfo = "";
      if (pinterestUserRaw && !["0", "skip"].includes(pinterestUserRaw)) {
         extraInfo += ` | Pinterest: https://www.pinterest.com/${pinterestUserRaw.replace(/\./g, '/')}/`;
      }
      if (rawExternalLink) {
         extraInfo += ` | Source: https://${rawExternalLink}`;
      }

      itemsXml += `<item><title>${escapeXML(judulBaru)}</title><itunes:title>${escapeXML(judulBaru)}</itunes:title><link>${escapeXML(postUrl)}</link><guid isPermaLink="false">${escapeXML(post.KodeUnik)}</guid><description><![CDATA[${cleanTextForXML(post.Deskripsi).substring(0, 300)}... Download: ${postUrl}${extraInfo}]]></description><pubDate>${new Date(post.tangal).toUTCString()}</pubDate><enclosure url="${escapeXML(audioUrl)}" type="audio/mpeg" length="1024000"/><itunes:author>${escapeXML(dynamicAuthor)}</itunes:author><itunes:duration>600</itunes:duration><itunes:episode>${episodeNumber}</itunes:episode><itunes:episodeType>full</itunes:episodeType></item>`;
    }); 

    // 6. RAKIT FINAL XML (URUTAN TAG HARUS TEPAT)
    const xmlBody = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
<title>${escapeXML(feedTitle)}</title>
<link>${escapeXML(SITE_URL)}</link>
<description><![CDATA[Audio archive for ${cleanTextForXML(kategori)}.]]></description>
<language>en-us</language>
<lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
<atom:link href="${escapeXML(SITE_URL + url.pathname)}" rel="self" type="application/rss+xml" />
<itunes:author>${escapeXML(dynamicAuthor)}</itunes:author>
<itunes:owner><itunes:name>${escapeXML(dynamicAuthor)}</itunes:name><itunes:email>${escapeXML(DYNAMIC_EMAIL)}</itunes:email></itunes:owner>
<itunes:explicit>no</itunes:explicit>
<itunes:category text="Education" />
<itunes:image href="${channelCoverUrl}" />
<image><url>${channelCoverUrl}</url><title>${escapeXML(feedTitle)}</title><link>${escapeXML(SITE_URL)}</link></image>
${itemsXml}
</channel>
</rss>`.trim();

    const finalXml = xmlBody;
    const xmlBytes = new TextEncoder().encode(finalXml);
    const eTag = await generateETag(finalXml);

    return new Response(finalXml, {
      headers: { 
        "Content-Type": "application/rss+xml; charset=utf-8",
        "Content-Length": xmlBytes.length.toString(), // Wajib untuk CastFeedValidator
        "ETag": `"${eTag}"`, // Wajib untuk Firstory
        "Last-Modified": new Date().toUTCString(),
        "Access-Control-Allow-Origin": "*"
      },
    });

  } catch (e) {
    return new Response(`Error: ${e.message}`, { status: 500 });
  }
}
