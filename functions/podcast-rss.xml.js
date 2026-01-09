// Hardcode: /functions/[[path]]/podcast-rss.xml.js
// [FINAL VERSION] Support Pinterest Board (Use dot '.' as separator)

const SPINTAX_PREFIX = [
  "Download", "Get", "Read", "Free", "Grab", "Full", 
  "Télécharger", "Lire", "Obtenir", "Gratuit", 
  "Herunterladen", "Lesen", "Holen", "Gratis", 
  "Descargar", "Leer", "Obtener", 
  "Scarica", "Leggi", 
  "Downloaden" 
];

const SPINTAX_SUFFIX = [
  "PDF", "ePub", "Ebook", "Audiobook", "Full Version", 
  "PDF Complet", "Livre Numérique", "Version Complète", 
  "Vollversion", "E-Book Deutsch", 
  "Libro Electrónico", "Versión Completa", 
  "Versione Completa", 
  "PDF 2025", "High Quality"
];

const EXTERNAL_LINK_INTRO = [
  "Listen on partner:", "Also available on:", "Mirror link:", 
  "Alternative Source:", "Check out:", "Stream here:"
];

const PINTEREST_INTRO = [
  "Pin this:", "Saved on Pinterest:", "View our Board:", 
  "Follow on Pinterest:", "See collection:", "Visual guide:"
];

function spinWord(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function truncateAndClean(str, length = 250) {
  if (!str) return "";
  const cleanStr = str.replace(/<[^>]*>?/gm, '');
  const truncated = cleanStr.substring(0, length);
  return cleanStr.length > length ? truncated + "..." : truncated;
}

function escapeXML(str) {
  if (!str) return "";
  return str.replace(/[<>&"']/g, function (match) {
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
    
    // Segmen 3: Pinterest (Username ATAU Username.Board)
    const pinterestUserRaw = pathSegments[2] || ""; 
    
    // Segmen 4 dst: External Link
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
    const feedTitle = `${escapeXML(kategori)} Audio Collection`;
    const channelCoverUrl = `https://picsum.photos/1400/1400?random=${encodeURIComponent(kategori)}`;

    // Query DB
    const queryParams = [];
    let query = "SELECT ID, Judul, Deskripsi, Image, KodeUnik, tangal FROM Buku WHERE tangal IS NOT NULL AND tangal <= DATE('now')";
    if (kategori && kategori !== "General") {
      query += " AND UPPER(Kategori) = UPPER(?)";
      queryParams.push(kategori);
    }
    query += " ORDER BY tangal DESC LIMIT 500";

    const stmt = db.prepare(query).bind(...queryParams);
    const { results } = await stmt.all();
    const selfLink = url.href;

    // --- XML GENERATION ---
    let xml = `<?xml version="1.0" encoding="UTF-8" ?>
<?xml-stylesheet href="https://flowork.cloud/podcast-style.xsl" type="text/xsl"?>
<rss version="2.0"
  xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"
  xmlns:podcast="https://podcastindex.org/namespace/1.0"
  xmlns:content="http://purl.org/rss/1.0/modules/content/"
  xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>${feedTitle}</title>
  <link>${SITE_URL}</link>
  <description><![CDATA[Best selection of ${escapeXML(kategori)} books and audiobooks.]]></description>
  <language>en-us</language>
  <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
  <generator>Flowork</generator>
  <copyright>© ${new Date().getFullYear()} ${dynamicAuthor}</copyright>

  <atom:link href="${selfLink}" rel="self" type="application/rss+xml" />
  <podcast:locked>${PODCAST_LOCKED}</podcast:locked>
  <podcast:guid>${crypto.randomUUID()}</podcast:guid>
  <itunes:author>${dynamicAuthor}</itunes:author>
  <itunes:type>episodic</itunes:type>
  <itunes:owner>
    <itunes:name>${dynamicAuthor}</itunes:name>
    <itunes:email>${DYNAMIC_EMAIL}</itunes:email> 
  </itunes:owner>
  <image>
     <url>${channelCoverUrl}</url>
     <title>${feedTitle}</title>
     <link>${SITE_URL}</link>
  </image>
  <itunes:category text="Education" />
`;

    const totalResults = results.length;
    results.forEach((post, i) => {
      const episodeNumber = totalResults - i; 
      const postUrl = `${SITE_URL}/post/${post.KodeUnik}`;
      const audioUrl = `${SITE_URL}/podcast-audio/${post.KodeUnik}.mp3`;

      const randomPrefix = spinWord(SPINTAX_PREFIX);
      const randomSuffix = spinWord(SPINTAX_SUFFIX);
      const judulAsli = escapeXML(post.Judul);
      const judulBaru = `${randomPrefix} ${judulAsli} ${randomSuffix}`;

      let combinedBacklinks = "";

      // [MODIFIED] Pinterest Logic (Dot '.' replaced with Slash '/')
      if (pinterestUserRaw && pinterestUserRaw !== "0" && pinterestUserRaw !== "skip") {
         const pinIntro = spinWord(PINTEREST_INTRO);
         
         // Ganti titik (.) jadi slash (/) agar support board
         const cleanPinPath = pinterestUserRaw.replace(/\./g, '/');
         const pinUrl = `https://www.pinterest.com/${cleanPinPath}/`;
         
         // Tampilan teks link tetap rapi (titik diganti spasi atau biarkan)
         const displayText = pinterestUserRaw.replace(/\./g, ' / ');

         combinedBacklinks += `<br/>📌 <strong>${pinIntro}</strong> <a href="${pinUrl}">${displayText}</a>`;
      }

      if (rawExternalLink) {
         const extIntro = spinWord(EXTERNAL_LINK_INTRO);
         const extUrl = `https://${rawExternalLink}`;
         combinedBacklinks += `<br/>🔗 <strong>${extIntro}</strong> <a href="${extUrl}">External Source</a>`;
      }

      let proxiedImageUrl = "";
      if (post.Image) {
        const encodedImageUrl = encodeURIComponent(post.Image);
        proxiedImageUrl = `${SITE_URL}/image-proxy?url=${encodedImageUrl}`;
      }

      xml += `
  <item>
    <title>${judulBaru}</title>
    <itunes:title>${judulBaru}</itunes:title>
    <link>${postUrl}</link>
    <guid isPermaLink="false">${escapeXML(post.KodeUnik)}</guid>
    
    <description><![CDATA[
      ${truncateAndClean(post.Deskripsi)}... 
      <br/><br/>
      👉 <strong>${randomPrefix} Link:</strong> <a href="${postUrl}">${randomSuffix}</a>
      <br/>
      ${combinedBacklinks}
    ]]></description>
    
    ${post.tangal ? `<pubDate>${new Date(post.tangal).toUTCString()}</pubDate>` : ""}
    <enclosure url="${audioUrl}" type="audio/mpeg" length="1000000" />
    <itunes:author>${dynamicAuthor}</itunes:author>
    <itunes:duration>${DEFAULT_DURATION_SECONDS}</itunes:duration>
    <itunes:season>${DEFAULT_SEASON}</itunes:season>
    <itunes:episode>${episodeNumber}</itunes:episode>
    <itunes:episodeType>full</itunes:episodeType>
    ${proxiedImageUrl ? `<itunes:image href="${escapeXML(proxiedImageUrl)}" />` : ""}
  </item>
`;
    }); 

    xml += `
</channel>
</rss>`;

    return new Response(xml, {
      headers: { "Content-Type": "application/rss+xml; charset=utf-8", "Cache-Control": "s-maxage=3600" }
    });
  } catch (e) {
    return new Response(`Server error: ${e.message}`, { status: 500 });
  }
}
