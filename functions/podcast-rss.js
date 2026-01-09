// Hardcode: /functions/podcast-rss.js
// [FINAL v4] SEO Farm: Title Spintax + CPA Header Spintax + NATURAL BACKLINKING (Anti-Footprint)

const BLOG_TITLE_DEFAULT = "Podcast Series";
const DEFAULT_DESCRIPTION = "Exclusive audio content sharing insights, stories, and educational materials.";

// --- [BANK KATA 1: JUDUL EPISODE] ---
const SPIN_PREFIXES = [
  "Download", "Get", "Grab", "Read", "Access", "Free", "Full", 
  "Gratis", "Lies", "Holen", // German
  "Telecharger", "Lire", "Obtenir", // French
  "Descargar", "Leer", "Baixar", "Obtener", // Spanish/Port
  "👉", "🔥", "✅", "⚡", "[PDF]", "(Ebook)"
];

const SPIN_SUFFIXES = [
  "PDF", "Ebook", "Full Version", "Direct Link", "Now", "Free", "Online",
  "Kostenlos", "Herunterladen", "Buch",
  "Gratuit", "Complet",
  "Gratis", "Completo", "Digital", "Ahora",
  "(2024)", "[Update]", "2025", "✨", "⬇️"
];

// --- [BANK KATA 2: CPA HEADER (LINK DOWNLOAD)] ---
const SPIN_CPA_HEADERS = [
  "📥 Download Here:",
  "🚀 Fast Download Link:",
  "✅ Official Source:",
  "🔥 Get Full Book:",
  "⚡ Instant Access:",
  "🌐 Mirror Link (Secure):",
  "📚 Read Online / Download:",
  "👉 Direct Link:",
  "⬇️ Link Alternatif:",
  "📥 Telecharger Ici:",
  "🚀 Descargar Aquí:",
  "✅ Download Starten:",
  "🔐 Secure File Access:"
];

// --- [BANK KATA 3: SOCIAL/PINTEREST CTA (BARU)] ---
// Variasi kata ajakan untuk link Pinterest agar tidak monoton
const SPIN_SOCIAL_CTAS = [
  "Find us on Pinterest:",
  "Follow our Board:",
  "See more ideas on Pinterest:",
  "Visit our Profile:",
  "More inspiration here:",
  "Follow for updates:",
  "Lihat koleksi di Pinterest:",
  "Follow kami di Pinterest:"
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
  if (str.length === 0) return hash;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

// Fungsi Helper: Mengambil elemen acak dari Array
function getRandomWord(array) {
  return array[Math.floor(Math.random() * array.length)];
}

// --- MAIN HANDLER ---

export async function onRequestGet(context) {
  const { env, request, params } = context;
  const db = env.DB;
  const url = new URL(request.url);
  const SITE_URL = url.origin;

  // KONFIGURASI URL
  const PODCAST_OWNER_EMAIL = url.searchParams.get("email") || "admin@flowork.cloud";
  const PODCAST_AUTHOR = url.searchParams.get("author") || "Creator";
  const PODCAST_TITLE = url.searchParams.get("title") || BLOG_TITLE_DEFAULT;
  const PODCAST_CATEGORY = url.searchParams.get("cat") || "Education";

  // Cover Art Logic
  const imageSeed = getHashFromTitle(PODCAST_TITLE);
  const AUTO_IMAGE = `https://picsum.photos/1400/1400?random=${imageSeed}`;
  const PODCAST_IMAGE = url.searchParams.get("image") || AUTO_IMAGE;

  // Backlink & CPA Logic
  const TARGET_LINK = url.searchParams.get("target") || SITE_URL; // Pinterest
  const PROMO_LINK = url.searchParams.get("promo") || ""; // CPA/Affiliate
  const PROMO_TEXT = url.searchParams.get("promoText") || "Download Full PDF Now";

  try {
    // Routing Logic
    const pathSegments = params.path || [];
    const kategoriFilter = pathSegments[0] || ""; 
    const manualJudulAwal = pathSegments[1] || ""; 
    const manualJudulAkhir = pathSegments[2] || "";

    const queryParams = [];
    let query = "SELECT ID, Judul, Deskripsi, Image, KodeUnik, tangal FROM Buku WHERE tangal IS NOT NULL AND tangal <= DATE('now')";

    if (kategoriFilter) {
      query += " AND UPPER(Kategori) = UPPER(?)";
      queryParams.push(kategoriFilter);
    }
    query += " ORDER BY tangal DESC LIMIT 50"; 

    const stmt = db.prepare(query).bind(...queryParams);
    const { results } = await stmt.all();

    const finalFeedTitle = escapeXML(PODCAST_TITLE);
    const selfLink = url.href; 

    // Header XML
    let xml = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0"
  xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"
  xmlns:podcast="https://podcastindex.org/namespace/1.0"
  xmlns:content="http://purl.org/rss/1.0/modules/content/"
  xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>${finalFeedTitle}</title>
  <link>${escapeXML(TARGET_LINK)}</link>
  <description><![CDATA[${DEFAULT_DESCRIPTION} <br> Visit: <a href="${escapeXML(TARGET_LINK)}">${escapeXML(TARGET_LINK)}</a>]]></description>
  <language>en-us</language>
  <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
  <generator>Flowork CPA Gen</generator>
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
     <title>${finalFeedTitle}</title>
     <link>${escapeXML(TARGET_LINK)}</link>
  </image>
  <itunes:category text="${escapeXML(PODCAST_CATEGORY)}" />
`;

    // Looping Items
    const totalResults = results.length;
    results.forEach((post, i) => {
      const audioUrl = `${SITE_URL}/podcast-audio/${post.KodeUnik}.mp3`;
      
      // 1. SPINTAX TITLE
      let baseTitle = post.Judul;
      let prefix = manualJudulAwal ? manualJudulAwal : getRandomWord(SPIN_PREFIXES);
      let suffix = manualJudulAkhir ? manualJudulAkhir : getRandomWord(SPIN_SUFFIXES);
      let judulEpisode = `${escapeXML(prefix)} ${escapeXML(baseTitle)} ${escapeXML(suffix)}`;

      // 2. SPINTAX HEADERS
      let cpaHeader = getRandomWord(SPIN_CPA_HEADERS);
      let socialCta = getRandomWord(SPIN_SOCIAL_CTAS);

      // --- LOGIKA NATURAL BACKLINK (PENTING) ---
      let richDescription = post.Deskripsi || "";
      richDescription += `<br/><br/>-----------------<br/>`;

      // LOGIKA 1: Link Pinterest (TARGET_LINK)
      // Hanya muncul di 80% episode (Math.random > 0.2). 
      // Sisa 20% episode tidak ada link Pinterest (agar terlihat natural).
      if (Math.random() > 0.2) {
         // Variasi Anchor Text: Kadang nama Author, kadang "Visit Profile"
         const anchorText = (Math.random() > 0.5) ? PODCAST_AUTHOR : "Visit Profile";
         
         richDescription += `<strong>${socialCta}</strong> <a href="${escapeXML(TARGET_LINK)}">${escapeXML(anchorText)}</a><br/>`;
      }

      // LOGIKA 2: Link CPA / Affiliate (PROMO_LINK)
      // Selalu muncul (karena ini duitnya), tapi headernya ganti-ganti
      if (PROMO_LINK) {
        richDescription += `<br/><strong>${cpaHeader}</strong> <br/>`;
        richDescription += `<a href="${escapeXML(PROMO_LINK)}">👉 ${escapeXML(PROMO_TEXT)}</a>`;
      }
      // ---------------------------------------

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
        "Cache-Control": "no-cache", 
      },
    });
  } catch (e) {
    return new Response(`Error: ${e.message}`, { status: 500 });
  }
}
