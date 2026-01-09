// Hardcode: /functions/podcast-rss.js
// [FINAL v2] SEO Farm: Auto Cover + Dual Backlink + TITLE SPINTAX (Anti-Monoton)

const BLOG_TITLE_DEFAULT = "Podcast Series";
const DEFAULT_DESCRIPTION = "Exclusive audio content sharing insights, stories, and educational materials.";

// --- [BANK KATA SPINTAX] ---
// Kata-kata ini akan dipilih secara ACAK untuk setiap episode
// agar feed terlihat natural dan tidak robotik.

const SPIN_PREFIXES = [
  // English
  "Download", "Get", "Grab", "Read", "Access", "Free", "Full",
  // German
  "Gratis", "Lies", "Holen",
  // French
  "Telecharger", "Lire", "Obtenir",
  // Spanish/Portuguese
  "Descargar", "Leer", "Baixar", "Obtener",
  // Simbol penarik perhatian
  "👉", "🔥", "✅", "⚡", "[PDF]", "(Ebook)"
];

const SPIN_SUFFIXES = [
  // English
  "PDF", "Ebook", "Full Version", "Direct Link", "Now", "Free", "Online",
  // German
  "Kostenlos", "Herunterladen", "Buch",
  // French
  "Gratuit", "Complet",
  // Spanish/Portuguese
  "Gratis", "Completo", "Digital", "Ahora",
  // Simbol/Tahun
  "(2024)", "[Update]", "2025", "✨", "⬇️"
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

// Fungsi Helper Baru: Mengambil elemen acak dari Array
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

  // Backlink Logic
  const TARGET_LINK = url.searchParams.get("target") || SITE_URL;
  const PROMO_LINK = url.searchParams.get("promo") || "";
  const PROMO_TEXT = url.searchParams.get("promoText") || "Listen to our partner podcast";

  try {
    // Routing Logic
    // [PENTING] Kita tetap ambil params path, TAPI...
    // Jika path kosong, kita akan pakai SPINTAX otomatis nanti di bawah.
    const pathSegments = params.path || [];
    const kategoriFilter = pathSegments[0] || ""; 
    
    // Kita simpan manual input (jika ada)
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
  <generator>Flowork SEO Gen</generator>
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
      
      // --- LOGIKA SPINTAX TITLE (AUTO RANDOM) ---
      // 1. Ambil Judul Asli Buku
      let baseTitle = post.Judul;

      // 2. Tentukan Prefix (Awalan)
      // Jika user mengisi manual di URL, pakai manual. Jika kosong, PILIH ACAK.
      let prefix = manualJudulAwal ? manualJudulAwal : getRandomWord(SPIN_PREFIXES);
      
      // 3. Tentukan Suffix (Akhiran)
      // Sama, jika manual kosong, PILIH ACAK.
      let suffix = manualJudulAkhir ? manualJudulAkhir : getRandomWord(SPIN_SUFFIXES);

      // 4. Gabungkan
      // Format: "Download [Judul Buku] PDF" atau "Gratis [Judul Buku] Now"
      let judulEpisode = `${escapeXML(prefix)} ${escapeXML(baseTitle)} ${escapeXML(suffix)}`;
      // ------------------------------------------

      let richDescription = post.Deskripsi || "";
      richDescription += `<br/><br/>-----------------<br/>`;
      richDescription += `<strong>Find us on Pinterest:</strong> <a href="${escapeXML(TARGET_LINK)}">${escapeXML(PODCAST_AUTHOR)}</a>`;

      if (PROMO_LINK) {
        richDescription += `<br/><br/><strong>Don't miss our partner show:</strong> <br/>`;
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
        "Cache-Control": "no-cache", // Jangan cache biar spin-nya selalu fresh kalau direfresh
      },
    });
  } catch (e) {
    return new Response(`Error: ${e.message}`, { status: 500 });
  }
}
