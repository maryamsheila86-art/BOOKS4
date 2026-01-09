// Hardcode: /functions/[[path]]/podcast-rss.xml.js
// [REQUIRED UPGRADES ONLY]
// 1. FIX SITE_URL: Menggunakan X-Forwarded-Host agar link di dalam XML menggunakan subdomain kamu.
// 2. INDUSTRY STANDARDS: Menambahkan itunes:explicit (wajib untuk hosting).
// 3. NO LOGIC CHANGES: Spintax dan DYNAMIC_EMAIL tetap sesuai kode asli kamu.

const SPINTAX_PREFIX = ["Download", "Get", "Read", "Free", "Grab", "Full", "Télécharger", "Lire", "Obtenir", "Gratuit", "Herunterladen", "Lesen", "Holen", "Gratis", "Descargar", "Leer", "Obtener", "Scarica", "Leggi", "Downloaden"];
const SPINTAX_SUFFIX = ["PDF", "ePub", "Ebook", "Audiobook", "Full Version", "PDF Complet", "Version Complète", "Vollversion", "Libro Electrónico", "Versión Kompleta", "Versione Kompleta", "PDF 2025"];
const SPINTAX_TITLE_ADJ = ["Exclusive", "Top", "Best", "Premium", "Official", "Viral", "Trending", "Hot", "New", "Daily", "Ultimate", "Complete", "Master", "Pro"];
const SPINTAX_TITLE_NOUN = ["Podcast", "Show", "Channel", "Station", "Audio", "Series", "Hub", "Spot", "Zone", "Network"];
const EXTERNAL_LINK_INTRO = ["Listen on partner:", "Also available on:", "Mirror link:", "Alternative Source:", "Check out:", "Stream here:"];
const PINTEREST_INTRO = ["Pin this:", "Saved on Pinterest:", "View our Board:", "Follow on Pinterest:", "See collection:"];

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

function getRootDomain(hostname) {
  const parts = hostname.split('.');
  if (parts.length <= 2) return hostname;
  return parts.slice(-2).join('.');
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

    // ============================================================
    // 🔴 UPGRADE 1: DETEKSI SUBDOMAIN (PENTING UNTUK VALIDATOR)
    // ============================================================
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

    // LOGIKA EMAIL TETAP SAMA SEPERTI KODE ASLI KAMU
    const DYNAMIC_EMAIL = `${emailUser}@${ROOT_DOMAIN}`;
    const dynamicAuthor = `${emailUser} Media`; 
    
    const feedTitle = `${capitalizeFirstLetter(emailUser)} ${spinWord(SPINTAX_TITLE_ADJ)} ${spinWord(SPINTAX_TITLE_NOUN)}`;
    const channelCoverUrl = "https://images.pexels.com/photos/415071/pexels-photo-415071.jpeg";

    const queryParams = [];
    let query = "SELECT Judul, Deskripsi, Image, KodeUnik, tangal FROM Buku WHERE tangal IS NOT NULL AND tangal <= DATE('now')";
    if (kategori && kategori !== "General") {
      query += " AND UPPER(Kategori) = UPPER(?)";
      queryParams.push(kategori);
    }
    query += " ORDER BY tangal DESC LIMIT 50";

    const stmt = db.prepare(query).bind(...queryParams);
    const { results } = await stmt.all();

    let itemsXml = "";
    results.forEach((post, i) => {
      const episodeNumber = results.length - i; 
      const postUrl = `${SITE_URL}/post/${post.KodeUnik}`;
      const audioUrl = `${SITE_URL}/podcast-audio/${post.KodeUnik}.mp3`;

      const judulAsli = cleanTextForXML(post.Judul);
      const judulBaru = `${spinWord(SPINTAX_PREFIX)} ${judulAsli} ${spinWord(SPINTAX_SUFFIX)}`;
      
      let combinedBacklinks = "";
      if (pinterestUserRaw && !["0", "skip"].includes(pinterestUserRaw)) {
         const pinUrl = `https://www.pinterest.com/${pinterestUserRaw.replace(/\./g, '/')}/`;
         combinedBacklinks += `<br/>📌 <strong>${spinWord(PINTEREST_INTRO)}</strong> <a href="${escapeXML(pinUrl)}">${pinterestUserRaw}</a>`;
      }
      if (rawExternalLink) {
         combinedBacklinks += `<br/>🔗 <strong>${spinWord(EXTERNAL_LINK_INTRO)}</strong> <a href="https://${rawExternalLink}">External Source</a>`;
      }

      const safeDescription = `${cleanTextForXML(post.Deskripsi).substring(0, 400)}... <br/><br/>👉 <strong>Link:</strong> <a href="${escapeXML(postUrl)}">${spinWord(SPINTAX_SUFFIX)}</a><br/>${combinedBacklinks}`;

      itemsXml += `
  <item>
    <title>${escapeXML(judulBaru)}</title>
    <itunes:title>${escapeXML(judulBaru)}</itunes:title>
    <link>${escapeXML(postUrl)}</link>
    <guid isPermaLink="false">${escapeXML(post.KodeUnik)}</guid>
    <description><![CDATA[${safeDescription}]]></description>
    <pubDate>${safeDate(post.tangal)}</pubDate>
    <enclosure url="${escapeXML(audioUrl)}" type="audio/mpeg" length="1000000" />
    <itunes:author>${escapeXML(dynamicAuthor)}</itunes:author>
    <itunes:duration>600</itunes:duration>
    <itunes:episode>${episodeNumber}</itunes:episode>
    <itunes:episodeType>full</itunes:episodeType>
    ${post.Image ? `<itunes:image href="${SITE_URL}/image-proxy?url=${encodeURIComponent(post.Image)}" />` : ""}
  </item>`;
    }); 

    const xmlBody = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>${escapeXML(feedTitle)}</title>
  <link>${escapeXML(SITE_URL)}</link>
  <description><![CDATA[Audiobooks and stories for ${cleanTextForXML(kategori)}.]]></description>
  <language>en-us</language>
  <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
  <atom:link href="${escapeXML(url.href)}" rel="self" type="application/rss+xml" />
  <itunes:author>${escapeXML(dynamicAuthor)}</itunes:author>
  <itunes:owner>
    <itunes:name>${escapeXML(dynamicAuthor)}</itunes:name>
    <itunes:email>${escapeXML(DYNAMIC_EMAIL)}</itunes:email> 
  </itunes:owner>
  
  <itunes:explicit>no</itunes:explicit>
  
  <itunes:image href="${channelCoverUrl}" />
  <itunes:category text="Education" />
  ${itemsXml}
</channel>
</rss>`;

    return new Response(xmlBody.trim(), {
      headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
    });

  } catch (e) {
    return new Response(`Error: ${e.message}`, { status: 500 });
  }
}
