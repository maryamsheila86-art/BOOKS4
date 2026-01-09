// Hardcode: /functions/[[path]]/podcast-rss.xml.js
// [FINAL REVISED VERSION] 
// Fix: Encoding Error (No Emojis), Domain Leak, and Email Logic

const SPINTAX_PREFIX = ["Download", "Get", "Read", "Free", "Grab", "Full", "Télécharger", "Lire", "Obtenir", "Gratuit", "Herunterladen", "Lesen", "Holen", "Gratis", "Descargar", "Leer", "Obtener", "Scarica", "Leggi", "Downloaden"];
const SPINTAX_SUFFIX = ["PDF", "ePub", "Ebook", "Audiobook", "Full Version", "PDF Complet", "Version Complète", "Vollversion", "Libro Electrónico", "Versión Kompleta", "Versione Kompleta", "PDF 2025"];
const SPINTAX_TITLE_ADJ = ["Exclusive", "Top", "Best", "Premium", "Official", "Viral", "Trending", "Hot", "New", "Daily", "Ultimate", "Complete", "Master", "Pro"];
const SPINTAX_TITLE_NOUN = ["Podcast", "Show", "Channel", "Station", "Audio", "Series", "Hub", "Spot", "Zone", "Network"];
const EXTERNAL_LINK_INTRO = ["Listen on partner:", "Also available on:", "Mirror link:", "Alternative Source:", "Check out:", "Stream here:"];
const PINTEREST_INTRO = ["Pin this:", "Saved on Pinterest:", "View our Board:", "Follow on Pinterest:", "See collection:"];

function spinWord(array) {
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * PEMBERSIHAN EKSTRIM:
 * Menghapus emoji (👉, 📌, 🔗) dan karakter non-ASCII lainnya 
 * yang sering menyebabkan 'Encoding Error' pada validator Podcast.
 */
function cleanTextForXML(str) {
  if (str === null || str === undefined) return "";
  const s = String(str);
  let clean = s.replace(/<[^>]*>?/gm, ''); // Hapus HTML
  // Hanya izinkan karakter ASCII standar (Keyboard), hapus emoji & simbol aneh
  clean = clean.replace(/[^\x20-\x7E]/g, ""); 
  clean = clean.replace(/]]>/g, "]]&gt;"); // Fix CDATA
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

/**
 * LOGIKA ROOT DOMAIN:
 * Memastikan dalbankeak.co.uk atau shopee-cod.my.id terdeteksi utuh untuk email.
 */
function getRootDomain(hostname) {
  const parts = hostname.split('.');
  const isThreePartTld = ["co.uk", "org.uk", "my.id", "me.uk", "ltd.uk"].some(tld => hostname.endsWith(tld));
  if (isThreePartTld) {
    // Ambil 3 bagian terakhir (contoh: dalbankeak.co.uk)
    return parts.length >= 3 ? parts.slice(-3).join('.') : hostname;
  } else {
    // Ambil 2 bagian terakhir (contoh: domain.com)
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
  return isNaN(d.getTime()) ? new Date().toUTCString() : d.toUTCString();
}

export async function onRequestGet(context) {
  const { env, request, params } = context;
  const db = env.DB; 

  try {
    const url = new URL(request.url);

    // 1. DETEKSI DOMAIN (ANTI-LEAK)
    const forwardedHost = request.headers.get("X-Forwarded-Host");
    const currentHost = forwardedHost || url.host; 
    const SITE_URL = `https://${currentHost}`;
    
    // Deteksi Root Domain untuk Email (dalbankeak.co.uk, dsb)
    const ROOT_DOMAIN = getRootDomain(currentHost); 

    // 2. PARSING URL PATH
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

    // Identitas Channel
    const DYNAMIC_EMAIL = `${emailUser}@${ROOT_DOMAIN}`;
    const dynamicAuthor = `${emailUser.toUpperCase()} Media`; 
    const feedTitle = `${capitalizeFirstLetter(emailUser)} ${spinWord(SPINTAX_TITLE_ADJ)} ${spinWord(SPINTAX_TITLE_NOUN)}`;
    const channelCoverUrl = "https://images.pexels.com/photos/415071/pexels-photo-415071.jpeg";

    // 3. QUERY DATABASE
    const queryParams = [];
    let query = "SELECT Judul, Deskripsi, Image, KodeUnik, tangal FROM Buku WHERE tangal IS NOT NULL AND tangal <= DATE('now')";
    if (kategori && kategori !== "General") {
      query += " AND UPPER(Kategori) = UPPER(?)";
      queryParams.push(kategori);
    }
    query += " ORDER BY tangal DESC LIMIT 50";

    const stmt = db.prepare(query).bind(...queryParams);
    const { results } = await stmt.all();

    // 4. GENERATE ITEMS XML
    let itemsXml = "";
    results.forEach((post, i) => {
      const episodeNumber = results.length - i; 
      const postUrl = `${SITE_URL}/post/${post.KodeUnik}`;
      const audioUrl = `${SITE_URL}/podcast-audio/${post.KodeUnik}.mp3`;

      const judulAsli = cleanTextForXML(post.Judul);
      const judulBaru = `${spinWord(SPINTAX_PREFIX)} ${judulAsli} ${spinWord(SPINTAX_SUFFIX)}`;
      
      // Backlinks Tanpa Emoji
      let combinedBacklinks = "";
      if (pinterestUserRaw && !["0", "skip"].includes(pinterestUserRaw)) {
         const pinUrl = `https://www.pinterest.com/${pinterestUserRaw.replace(/\./g, '/')}/`;
         combinedBacklinks += `<br/>Pinterest: <strong>${spinWord(PINTEREST_INTRO)}</strong> <a href="${escapeXML(pinUrl)}">${pinterestUserRaw}</a>`;
      }
      if (rawExternalLink) {
         combinedBacklinks += `<br/>Link: <strong>${spinWord(EXTERNAL_LINK_INTRO)}</strong> <a href="https://${rawExternalLink}">External Source</a>`;
      }

      // Deskripsi Tanpa Emoji 👉
      const safeDescription = `${cleanTextForXML(post.Deskripsi).substring(0, 400)}... <br/><br/>Download: <a href="${escapeXML(postUrl)}">${spinWord(SPINTAX_SUFFIX)}</a>${combinedBacklinks}`;

      itemsXml += `
    <item>
      <title>${escapeXML(judulBaru)}</title>
      <itunes:title>${escapeXML(judulBaru)}</itunes:title>
      <link>${escapeXML(postUrl)}</link>
      <guid isPermaLink="false">${escapeXML(post.KodeUnik)}</guid>
      <description><![CDATA[${safeDescription}]]></description>
      <pubDate>${safeDate(post.tangal)}</pubDate>
      <enclosure url="${escapeXML(audioUrl)}" type="audio/mpeg" length="1024000" />
      <itunes:author>${escapeXML(dynamicAuthor)}</itunes:author>
      <itunes:duration>600</itunes:duration>
      <itunes:episode>${episodeNumber}</itunes:episode>
      <itunes:episodeType>full</itunes:episodeType>
      ${post.Image ? `<itunes:image href="${SITE_URL}/image-proxy?url=${encodeURIComponent(post.Image)}" />` : ""}
    </item>`;
    }); 

    // 5. RAKIT XML FINAL (TANPA SPASI DI AWAL)
    const xmlBody = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>${escapeXML(feedTitle)}</title>
  <link>${escapeXML(SITE_URL)}</link>
  <description><![CDATA[Audio library for ${cleanTextForXML(kategori)}.]]></description>
  <language>en-us</language>
  <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
  <atom:link href="${escapeXML(SITE_URL + url.pathname)}" rel="self" type="application/rss+xml" />
  <itunes:author>${escapeXML(dynamicAuthor)}</itunes:author>
  <itunes:owner>
    <itunes:name>${escapeXML(dynamicAuthor)}</itunes:name>
    <itunes:email>${escapeXML(DYNAMIC_EMAIL)}</itunes:email> 
  </itunes:owner>
  <itunes:explicit>no</itunes:explicit>
  <itunes:category text="Education" />
  <itunes:image href="${channelCoverUrl}" />
  <image>
     <url>${channelCoverUrl}</url>
     <title>${escapeXML(feedTitle)}</title>
     <link>${escapeXML(SITE_URL)}</link>
  </image>
  ${itemsXml}
</channel>
</rss>`;

    return new Response(xmlBody.trim(), {
      headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
    });

  } catch (e) {
    const errorXml = `<?xml version="1.0" encoding="UTF-8"?><rss><channel><title>Error</title><description>${escapeXML(e.message)}</description></channel></rss>`;
    return new Response(errorXml, { 
        headers: { "Content-Type": "application/rss+xml" }
    });
  }
}
