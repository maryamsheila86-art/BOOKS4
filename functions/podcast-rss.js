// Hardcode: /functions/[[path]]/podcast-rss.xml.js
// [FINAL] SEO Farm: Auto Cover (Picsum) + Dual Backlink Strategy

const BLOG_TITLE_DEFAULT = "Podcast Series";
const DEFAULT_DESCRIPTION = "Exclusive audio content sharing insights, stories, and educational materials.";

// --- HELPER FUNCTIONS ---

// 1. Membersihkan teks untuk ringkasan
function truncateAndClean(str, length = 250) {
  if (!str) return "";
  const cleanStr = str.replace(/<[^>]*>?/gm, ''); // Hapus HTML tags
  const truncated = cleanStr.substring(0, length);
  return cleanStr.length > length ? truncated + "..." : truncated;
}

// 2. Escape karakter XML
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

// 3. Hash Function: Membuat angka unik dari judul
// Tujuannya agar gambar random-nya konsisten (tidak berubah tiap refresh)
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

// --- MAIN HANDLER ---

export async function onRequestGet(context) {
  const { env, request, params } = context;
  const db = env.DB;
  const url = new URL(request.url);
  const SITE_URL = url.origin;

  // ==========================================
  // KONFIGURASI LINK & IDENTITAS (VIA URL)
  // ==========================================

  // 1. Identitas Podcast
  const PODCAST_OWNER_EMAIL = url.searchParams.get("email") || "admin@flowork.cloud";
  const PODCAST_AUTHOR = url.searchParams.get("author") || "Creator";
  const PODCAST_TITLE = url.searchParams.get("title") || BLOG_TITLE_DEFAULT;
  const PODCAST_CATEGORY = url.searchParams.get("cat") || "Education";

  // 2. Logika Cover Art (Picsum - Opsi 2)
  // Membuat gambar unik 1400x1400 berdasarkan judul podcast
  const imageSeed = getHashFromTitle(PODCAST_TITLE);
  const AUTO_IMAGE = `https://picsum.photos/1400/1400?random=${imageSeed}`;
  const PODCAST_IMAGE = url.searchParams.get("image") || AUTO_IMAGE;

  // 3. STRATEGI BACKLINK (SEO)
  
  // A. Target Utama (Biasanya Akun Pinterest / Moneysite)
  // Parameter: ?target=...
  const TARGET_LINK = url.searchParams.get("target") || SITE_URL;
  
  // B. Cross-Link Podcast Lain (Link Wheel)
  // Parameter: ?promo=URL_PODCAST_TEMAN
  const PROMO_LINK = url.searchParams.get("promo") || "";
  
  // Parameter: ?promoText=Kata_Kunci_Link_Teman
  const PROMO_TEXT = url.searchParams.get("promoText") || "Listen to our partner podcast";

  // ==========================================

  try {
    // Logic Routing Path
    const pathSegments = params.path || [];
    const kategoriFilter = pathSegments[0] || ""; 
    const judulAwal = pathSegments[1] || ""; 
    const judulAkhir = pathSegments[2] || "";

    const queryParams = [];
    // Mengambil data buku yang sudah rilis
    let query = "SELECT ID, Judul, Deskripsi, Image, KodeUnik, tangal FROM Buku WHERE tangal IS NOT NULL AND tangal <= DATE('now')";

    if (kategoriFilter) {
      query += " AND UPPER(Kategori) = UPPER(?)";
      queryParams.push(kategoriFilter);
    }
    query += " ORDER BY tangal DESC LIMIT 50"; 

    const stmt = db.prepare(query).bind(...queryParams);
    const { results } = await stmt.all();

    // Variable XML
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
  <itunes:explicit>false</itunes:explicit>
  
  <itunes:owner>
    <itunes:name>${escapeXML(PODCAST_AUTHOR)}</itunes:name>
    <itunes:email>${escapeXML(PODCAST_OWNER_EMAIL)}</itunes:email>
  </itunes:owner>

  <image>
     <url>${escapeXML(PODCAST_IMAGE)}</url>
     <title>${finalFeedTitle}</title>
     <link>${escapeXML(TARGET_LINK)}</link>
  </image>
  <itunes:image href="${escapeXML(PODCAST_IMAGE)}" />
  <itunes:category text="${escapeXML(PODCAST_CATEGORY)}" />
`;

    // Looping Items
    const totalResults = results.length;
    results.forEach((post, i) => {
      const audioUrl = `${SITE_URL}/podcast-audio/${post.KodeUnik}.mp3`;
      
      let judulEpisode = escapeXML(post.Judul);
      if (judulAwal || judulAkhir) {
          judulEpisode = `${escapeXML(judulAwal)} ${judulEpisode} ${escapeXML(judulAkhir)}`;
      }

      // --- SUSUNAN DESKRIPSI (SEO CONTENT) ---
      let richDescription = post.Deskripsi || "";
      
      // 1. Backlink ke Pinterest (Target Utama)
      richDescription += `<br/><br/>-----------------<br/>`;
      richDescription += `<strong>Find us on Pinterest:</strong> <a href="${escapeXML(TARGET_LINK)}">${escapeXML(PODCAST_AUTHOR)}</a>`;

      // 2. Backlink ke Podcast Lain (Cross Link)
      // Jika parameter ?promo= diisi, link ini akan muncul
      if (PROMO_LINK) {
        richDescription += `<br/><br/><strong>Don't miss our partner show:</strong> <br/>`;
        // Anchor text dinamis sesuai parameter ?promoText=
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
    <itunes:episodeType>full</itunes:episodeType>
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
