// Hardcode: /functions/podcast/[[path]].js
// [FINAL v7] SUPPORT .XML EXTENSION + Pinterest Backlink + CPA Spintax

const BLOG_TITLE_DEFAULT = "Podcast Series";
const DEFAULT_DESCRIPTION = "Exclusive audio content sharing insights, stories, and educational materials.";

// --- [BANK KATA SPINTAX] ---
const SPIN_PREFIXES = ["Download", "Get", "Grab", "Read", "Access", "Free", "Full", "Gratis", "Telecharger", "Descargar", "👉", "🔥"];
const SPIN_SUFFIXES = ["PDF", "Ebook", "Full Version", "Direct Link", "Now", "Free", "Kostenlos", "Gratuit", "(2025)", "✨", "⬇️"];
const SPIN_CPA_HEADERS = [
  "📥 Download Here:", "🚀 Fast Download Link:", "✅ Official Source:", "🔥 Get Full Book:", 
  "⚡ Instant Access:", "👉 Direct Link:", "⬇️ Link Alternatif:", "🔐 Secure File Access:"
];
const SPIN_SOCIAL_CTAS = [
  "Find us on Pinterest:", "Follow our Board:", "Visit our Profile:", "More inspiration here:", "Follow for updates:"
];

// --- HELPER FUNCTIONS ---
function truncateAndClean(str, length = 250) {
  if (!str) return "";
  const cleanStr = str.replace(/<[^>]*>?/gm, ''); 
  const truncated = cleanStr.substring(0, length);
  return cleanStr.length > length ? truncated + "..." : truncated;
}

function escapeXML(str) {
  if (!str) return "";
  return str.replace(/[<>&"']/g, match => {
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

function getHashFromTitle(str) {
  let hash = 0;
  if (!str) return 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

function getRandomWord(array) {
  return array[Math.floor(Math.random() * array.length)];
}

// --- MAIN HANDLER ---

export async function onRequestGet(context) {
  const { env, request, params } = context;
  const db = env.DB;
  const url = new URL(request.url);
  const SITE_URL = url.origin;

  // ==========================================
  // 1. TANGKAP DATA URL & BERSIHKAN .XML
  // ==========================================
  
  // Ambil array path
  let pathSegments = params.path || [];

  // [FITUR BARU] Cek apakah segmen terakhir adalah nama file .xml (misal: podcast-rss.xml)
  // Jika ya, kita BUANG agar tidak masuk ke judul.
  if (pathSegments.length > 0) {
    const lastSegment = pathSegments[pathSegments.length - 1].toLowerCase();
    if (lastSegment.includes(".xml") || lastSegment.includes(".rss")) {
        pathSegments.pop(); // Hapus elemen terakhir
    }
  }

  // Setelah .xml dibuang, sisanya adalah Kategori dan Judul
  const URL_CATEGORY = pathSegments[0] ? decodeURIComponent(pathSegments[0]) : "General";
  const URL_TITLE_START = pathSegments[1] ? decodeURIComponent(pathSegments[1]) : "";
  const URL_TITLE_END = pathSegments[2] ? decodeURIComponent(pathSegments[2]) : "";

  // Gabungkan jadi Judul Utama
  let FINAL_PODCAST_TITLE = BLOG_TITLE_DEFAULT;
  if (URL_TITLE_START || URL_TITLE_END) {
      FINAL_PODCAST_TITLE = `${URL_TITLE_START} ${URL_TITLE_END}`.trim();
  } else if (URL_CATEGORY !== "General") {
      FINAL_PODCAST_TITLE = `${URL_CATEGORY} Series`;
  }

  // ==========================================
  // 2. SETTING TEKNIS (QUERY PARAM)
  // ==========================================

  const PODCAST_OWNER_EMAIL = url.searchParams.get("email") || "admin@flowork.cloud";
  const PODCAST_AUTHOR = url.searchParams.get("author") || "Creator"; 
  const TARGET_LINK = url.searchParams.get("target") || SITE_URL; 
  const PROMO_LINK = url.searchParams.get("promo") || ""; 
  const PROMO_TEXT = url.searchParams.get("promoText") || "Download Full PDF Now";

  // Auto Image
  const imageSeed = getHashFromTitle(FINAL_PODCAST_TITLE);
  const AUTO_IMAGE = `https://picsum.photos/1400/1400?random=${imageSeed}`;
  const PODCAST_IMAGE = url.searchParams.get("image") || AUTO_IMAGE;

  try {
    const queryParams = [];
    let query = "SELECT ID, Judul, Deskripsi, Image, KodeUnik, tangal FROM Buku WHERE tangal IS NOT NULL AND tangal <= DATE('now')";

    if (URL_CATEGORY && URL_CATEGORY !== "General") {
      query += " AND UPPER(Kategori) = UPPER(?)";
      queryParams.push(URL_CATEGORY);
    }
    query += " ORDER BY tangal DESC LIMIT 50"; 

    const stmt = db.prepare(query).bind(...queryParams);
    const { results } = await stmt.all();

    const selfLink = url.href; 

    // XML Header
    let xml = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0"
  xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"
  xmlns:podcast="https://podcastindex.org/namespace/1.0"
  xmlns:content="http://purl.org/rss/1.0/modules/content/"
  xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>${escapeXML(FINAL_PODCAST_TITLE)}</title>
  <link>${escapeXML(TARGET_LINK)}</link>
  <description><![CDATA[${DEFAULT_DESCRIPTION} <br> Visit: <a href="${escapeXML(TARGET_LINK)}">${escapeXML(TARGET_LINK)}</a>]]></description>
  <language>en-us</language>
  <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
  <generator>Flowork XML Gen</generator>
  <copyright>© ${new Date().getFullYear()} ${escapeXML(PODCAST_AUTHOR)}</copyright>

  <atom:link href="${escapeXML(selfLink)}" rel="self" type="application/rss+xml" />

  <itunes:author>${escapeXML(PODCAST_AUTHOR)}</itunes:author>
  <itunes:type>episodic</itunes:type>
  <itunes:owner>
    <itunes:name>${escapeXML(PODCAST_AUTHOR)}</itunes:name>
    <itunes:email>${escapeXML(PODCAST_OWNER_EMAIL)}</itunes:email>
  </itunes:owner>

  <image>
     <url>${escapeXML(PODCAST_IMAGE)}</url>
     <title>${escapeXML(FINAL_PODCAST_TITLE)}</title>
     <link>${escapeXML(TARGET_LINK)}</link>
  </image>
  <itunes:category text="${escapeXML(URL_CATEGORY)}" />
`;

    // Looping Items
    const totalResults = results.length;
    results.forEach((post, i) => {
      const audioUrl = `${SITE_URL}/podcast-audio/${post.KodeUnik}.mp3`;
      
      // SPINTAX TITLE
      let prefix = URL_TITLE_START ? URL_TITLE_START : getRandomWord(SPIN_PREFIXES);
      let suffix = URL_TITLE_END ? URL_TITLE_END : getRandomWord(SPIN_SUFFIXES);
      let baseTitle = post.Judul;
      
      let judulEpisode = `${escapeXML(prefix)} ${escapeXML(baseTitle)} ${escapeXML(suffix)}`;

      // SPINTAX DESCRIPTION & BACKLINK
      let cpaHeader = getRandomWord(SPIN_CPA_HEADERS);
      let socialCta = getRandomWord(SPIN_SOCIAL_CTAS);
      let richDescription = post.Deskripsi || "";
      
      richDescription += `<br/><br/>-----------------<br/>`;

      // Backlink Pinterest (80% Chance)
      if (Math.random() > 0.2) {
         const anchorText = (Math.random() > 0.5) ? PODCAST_AUTHOR : "Visit Profile";
         richDescription += `<strong>${socialCta}</strong> <a href="${escapeXML(TARGET_LINK)}">${escapeXML(anchorText)}</a><br/>`;
      }

      // Link CPA
      if (PROMO_LINK) {
        richDescription += `<br/><strong>${cpaHeader}</strong> <br/>`;
        richDescription += `<a href="${escapeXML(PROMO_LINK)}">👉 ${escapeXML(PROMO_TEXT)}</a>`;
      }

      xml += `
  <item>
    <title>${judulEpisode}</title>
    <itunes:title>${judulEpisode}</itunes:title>
    <link>${escapeXML(TARGET_LINK)}</link>
    <guid isPermaLink="false">${escapeXML(post.KodeUnik)}</guid>
    <description><![CDATA[${truncateAndClean(post.Deskripsi)}]]></description>
    <content:encoded><![CDATA[${richDescription}]]></content:encoded>
    <enclosure url="${audioUrl}" type="audio/mpeg" length="1000000" />
    <itunes:duration>600</itunes:duration>
    <itunes:season>1</itunes:season>
    <itunes:episode>${totalResults - i}</itunes:episode>
    <itunes:image href="${escapeXML(PODCAST_IMAGE)}" />
  </item>
`;
    });

    xml += `
</channel>
</rss>`;

    return new Response(xml, {
      headers: {
        "Content-Type": "application/rss+xml; charset=utf-8",
        "Cache-Control": "s-maxage=600",
      },
    });
  } catch (e) {
    return new Response(`Error: ${e.message}`, { status: 500 });
  }
}
