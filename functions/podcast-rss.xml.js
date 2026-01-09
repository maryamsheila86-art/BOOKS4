// Hardcode: /functions/[[path]]/podcast-rss.xml.js
// [FINAL STABLE VERSION] 
// 1. REMOVED manual Content-Length (Fixes GZIP conflict/FATAL error)
// 2. ADDED Date Validation (Prevents 'Invalid Date')
// 3. ADDED String Safety (Prevents crash on non-string DB data)
// 4. KEPT Static Unsplash Image & Nuclear Text Cleaning

const SPINTAX_PREFIX = [
  "Download", "Get", "Read", "Free", "Grab", "Full", 
  "Télécharger", "Lire", "Obtenir", "Gratuit", 
  "Herunterladen", "Lesen", "Holen", "Gratis", 
  "Descargar", "Leer", "Obtener", "Scarica", "Leggi", "Downloaden" 
];

const SPINTAX_SUFFIX = [
  "PDF", "ePub", "Ebook", "Audiobook", "Full Version", 
  "PDF Complet", "Version Complète", "Vollversion", 
  "Libro Electrónico", "Versión Completa", "Versione Completa", "PDF 2025"
];

const SPINTAX_TITLE_ADJ = [
  "Exclusive", "Top", "Best", "Premium", "Official", 
  "Viral", "Trending", "Hot", "New", "Daily", 
  "Ultimate", "Complete", "Master", "Pro"
];

const SPINTAX_TITLE_NOUN = [
  "Podcast", "Show", "Channel", "Station", "Audio", 
  "Series", "Hub", "Spot", "Zone", "Network"
];

const EXTERNAL_LINK_INTRO = [
  "Listen on partner:", "Also available on:", "Mirror link:", 
  "Alternative Source:", "Check out:", "Stream here:"
];

const PINTEREST_INTRO = [
  "Pin this:", "Saved on Pinterest:", "View our Board:", 
  "Follow on Pinterest:", "See collection:"
];

function spinWord(array) {
  return array[Math.floor(Math.random() * array.length)];
}

// [SAFETY] Konversi ke string dulu sebelum replace agar tidak error
function cleanTextForXML(str) {
  if (str === null || str === undefined) return "";
  const s = String(str);
  
  // 1. Hapus tag HTML
  let clean = s.replace(/<[^>]*>?/gm, '');
  // 2. Hapus karakter kontrol ilegal XML
  clean = clean.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
  // 3. Hapus ']]>' agar tidak merusak CDATA
  clean = clean.replace(/]]>/g, "]]&gt;");
  
  return clean.trim();
}

function escapeXML(str) {
  if (str === null || str === undefined) return "";
  const s = String(str);
  return s.replace(/[<>&"']/g, function (match) {
    switch (match) {
      case "<": return "&lt;";
      case ">": return "&gt;";
      case "&": return "&amp;";
      case '"': return "&quot;";
      case "'": return "&#39;";
      default: return match;
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

// [VALIDASI TANGGAL] Pastikan tanggal valid untuk RSS
function safeDate(dateStr) {
  if (!dateStr) return new Date().toUTCString();
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) {
    return new Date().toUTCString(); // Fallback ke tanggal sekarang jika error
  }
  return d.toUTCString();
}

export async function onRequestGet(context) {
  const { env, request, params } = context;
  const db = env.DB;

  const DEFAULT_DURATION_SECONDS = 600; 
  const DEFAULT_SEASON = 1;
  const PODCAST_LOCKED = "no"; 

  try {
    const url = new URL(request.url);
    const SITE_URL = url.origin;
    const ROOT_DOMAIN = getRootDomain(url.hostname); 

    // --- PARSING URL ---
    const pathSegments = params.path || [];
    const kategori = pathSegments[0] || "General";
    const emailUser = pathSegments[1] || "admin";
    const pinterestUserRaw = pathSegments[2] || ""; 
    
    let rawExternalLink = "";
    if (pathSegments.length > 3) {
        const segmentsToJoin = pathSegments.slice(3);
        if (segmentsToJoin[segmentsToJoin.length - 1] === 'podcast-rss.xml') {
            segmentsToJoin.pop();
        }
        if (segmentsToJoin.length > 0) {
            rawExternalLink = segmentsToJoin.join("/");
        }
    }

    const DYNAMIC_EMAIL = `${emailUser}@${ROOT_DOMAIN}`;
    const dynamicAuthor = `${emailUser} Media`; 
    
    const userCap = capitalizeFirstLetter(emailUser);
    const powerWord = spinWord(SPINTAX_TITLE_ADJ);
    const nounWord = spinWord(SPINTAX_TITLE_NOUN);
    const feedTitle = `${userCap} ${powerWord} ${nounWord}`;
    
    // [FIX] URL Gambar statis sudah aman (mengandung ampersand? kita escape nanti)
    const channelCoverUrl = "https://images.unsplash.com/photo-1478737270239-2f02b77ac6d5?ixlib=rb-4.0.3&auto=format&fit=crop&w=1400&h=1400&q=80";

    const queryParams = [];
    let query = "SELECT ID, Judul, Deskripsi, Image, KodeUnik, tangal FROM Buku WHERE tangal IS NOT NULL AND tangal <= DATE('now')";
    if (kategori && kategori !== "General") {
      query += " AND UPPER(Kategori) = UPPER(?)";
      queryParams.push(kategori);
    }
    
    // Limit kecil (50) untuk kestabilan
    query += " ORDER BY tangal DESC LIMIT 50";

    const stmt = db.prepare(query).bind(...queryParams);
    const { results } = await stmt.all();
    const selfLink = url.href;

    // --- XML GENERATION ---
    // [FIX] Pastikan string XML rapat di kiri atas tanpa spasi
    let xmlBody = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:podcast="https://podcastindex.org/namespace/1.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>${escapeXML(feedTitle)}</title>
  <link>${escapeXML(SITE_URL)}</link>
  <description><![CDATA[Best selection of audiobooks and stories for ${cleanTextForXML(kategori)}.]]></description>
  <language>en-us</language>
  <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
  <generator>Flowork</generator>
  <copyright>&#169; ${new Date().getFullYear()} ${escapeXML(dynamicAuthor)}</copyright>

  <atom:link href="${escapeXML(selfLink)}" rel="self" type="application/rss+xml" />
  <podcast:locked>${PODCAST_LOCKED}</podcast:locked>
  <podcast:guid>${crypto.randomUUID()}</podcast:guid>
  <itunes:author>${escapeXML(dynamicAuthor)}</itunes:author>
  <itunes:type>episodic</itunes:type>
  <itunes:owner>
    <itunes:name>${escapeXML(dynamicAuthor)}</itunes:name>
    <itunes:email>${DYNAMIC_EMAIL}</itunes:email> 
  </itunes:owner>
  <image>
     <url>${escapeXML(channelCoverUrl)}</url>
     <title>${escapeXML(feedTitle)}</title>
     <link>${escapeXML(SITE_URL)}</link>
  </image>
  <itunes:image href="${escapeXML(channelCoverUrl)}" />
  <itunes:category text="Education" />
`;

    const totalResults = results.length;
    results.forEach((post, i) => {
      const episodeNumber = totalResults - i; 
      const postUrl = `${SITE_URL}/post/${post.KodeUnik}`;
      const audioUrl = `${SITE_URL}/podcast-audio/${post.KodeUnik}.mp3`;

      const randomPrefix = spinWord(SPINTAX_PREFIX);
      const randomSuffix = spinWord(SPINTAX_SUFFIX);
      
      const judulAsli = cleanTextForXML(post.Judul);
      const judulBaru = `${randomPrefix} ${judulAsli} ${randomSuffix}`;
      const deskripsiBersih = cleanTextForXML(post.Deskripsi).substring(0, 400); 

      let combinedBacklinks = "";

      if (pinterestUserRaw && pinterestUserRaw !== "0" && pinterestUserRaw !== "skip") {
         const pinIntro = spinWord(PINTEREST_INTRO);
         const cleanPinPath = pinterestUserRaw.replace(/\./g, '/');
         const pinUrl = `https://www.pinterest.com/${cleanPinPath}/`;
         const displayText = pinterestUserRaw.replace(/\./g, ' / ');
         // [SAFETY] Escape XML pada URL link
         combinedBacklinks += `<br/>📌 <strong>${pinIntro}</strong> <a href="${escapeXML(pinUrl)}">${escapeXML(displayText)}</a>`;
      }

      if (rawExternalLink) {
         const extIntro = spinWord(EXTERNAL_LINK_INTRO);
         const extUrl = `https://${rawExternalLink}`;
         combinedBacklinks += `<br/>🔗 <strong>${extIntro}</strong> <a href="${escapeXML(extUrl)}">External Source</a>`;
      }

      // [FIX] Susun Deskripsi HTML dengan aman
      const safeDescription = `${deskripsiBersih}... <br/><br/>👉 <strong>${randomPrefix} Link:</strong> <a href="${escapeXML(postUrl)}">${randomSuffix}</a><br/>${combinedBacklinks}`;

      let proxiedImageUrl = "";
      if (post.Image) {
        const encodedImageUrl = encodeURIComponent(post.Image);
        proxiedImageUrl = `${SITE_URL}/image-proxy?url=${encodedImageUrl}`;
      }

      xmlBody += `
  <item>
    <title>${escapeXML(judulBaru)}</title>
    <itunes:title>${escapeXML(judulBaru)}</itunes:title>
    <link>${escapeXML(postUrl)}</link>
    <guid isPermaLink="false">${escapeXML(post.KodeUnik)}</guid>
    <description><![CDATA[${safeDescription}]]></description>
    <pubDate>${safeDate(post.tangal)}</pubDate>
    <enclosure url="${escapeXML(audioUrl)}" type="audio/mpeg" length="1000000" />
    <itunes:author>${escapeXML(dynamicAuthor)}</itunes:author>
    <itunes:duration>${DEFAULT_DURATION_SECONDS}</itunes:duration>
    <itunes:season>${DEFAULT_SEASON}</itunes:season>
    <itunes:episode>${episodeNumber}</itunes:episode>
    <itunes:episodeType>full</itunes:episodeType>
    ${proxiedImageUrl ? `<itunes:image href="${escapeXML(proxiedImageUrl)}" />` : ""}
  </item>`;
    }); 

    xmlBody += `
</channel>
</rss>`;

    // [FIX] Gunakan Response sederhana agar Cloudflare otomatis mengatur Content-Length & GZIP
    // Jangan set Content-Length manual!
    return new Response(xmlBody, {
      headers: { 
        "Content-Type": "application/rss+xml; charset=utf-8",
        "Cache-Control": "max-age=0, s-maxage=60" // Cache pendek saat debug
      },
    });

  } catch (e) {
    const errorXml = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Error</title><description>Gen Error: ${escapeXML(e.message)}</description></channel></rss>`;
    return new Response(errorXml, { 
        status: 500,
        headers: { "Content-Type": "application/rss+xml" }
    });
  }
}
