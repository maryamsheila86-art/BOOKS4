// --- [SETTING DOMAIN UTAMA] ---
// Sesuaikan dengan domain utama kamu untuk email catch-all.
const MAIN_DOMAIN = "domainutama.com"; 

const BLOG_TITLE = "PREMIUM AUDIOBOOK LIBRARY";
const BLOG_DESCRIPTION = "High Quality Audiobook & Ebook Collection - 2026 Edition";

// --- REUSE SPINTAX DARI RSS.XML.JS (DETERMINISTIK) ---
const SPINTAX_PREFIX = `{Download|Get|Free|Read|Review|Grab} {PDF|Epub|Audiobook|Book} {Online|Directly|Instant}`;
const SPINTAX_SUFFIX = `{Full Version|Unabridged|Complete Edition|2026 Updated}`;

/**
 * Utility untuk membersihkan karakter XML agar tidak error saat divalidasi.
 */
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

/**
 * Mengubah string menjadi hash angka untuk pemilihan spintax yang stabil.
 */
function stringToHash(string) {
  let hash = 0;
  if (string.length === 0) return hash;
  for (let i = 0; i < string.length; i++) {
    const char = string.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

/**
 * Memproses spintax berdasarkan seed (ID Buku) agar hasil judul selalu sama (stabil).
 */
function spinTextStable(text, seedStr) {
  return text.replace(/\{([^{}]+)\}/g, function (match, content) {
    const choices = content.split("|");
    const uniqueHash = stringToHash(seedStr + content);
    const index = uniqueHash % choices.length;
    return choices[index];
  });
}

/**
 * Main handler untuk Podcast RSS
 */
export async function onRequestGet(context) {
  const { env, request, params } = context;
  const db = env.DB;
  const url = new URL(request.url);
  const SITE_URL = url.origin; // Mengikuti subdomain saat ini

  // params.path berisi segment sebelum /podcast-rss.xml
  const path = params.path || [];

  // Proteksi minimal jika struktur path tidak lengkap
  if (path.length < 2) {
    return new Response("Invalid URL Structure. Expected: /[cat]/[user]/...", { status: 400 });
  }

  // 1. IDENTIFIKASI DATA DARI PATH
  const kategori = path[0]; // Misalnya: ebook1
  const username = path[1]; // Misalnya: miller
  
  // Cari index di mana domain podcast dimulai (mencari tanda titik '.')
  let podcastStartIndex = path.findIndex((seg, idx) => idx > 1 && seg.includes('.'));
  
  // Jika tidak ditemukan domain podcast, fallback ke sisa path
  if (podcastStartIndex === -1) podcastStartIndex = path.length;

  const pinterestPath = path.slice(2, podcastStartIndex).join('/');
  const podcastPath = path.slice(podcastStartIndex).join('/');

  // 2. LOGIKA EMAIL CATCH-ALL (Paksa ke domain utama)
  const contactEmail = `${username}@${MAIN_DOMAIN}`;

  try {
    // 3. QUERY DATABASE BERDASARKAN KATEGORI
    let query = "SELECT Judul, Deskripsi, Image, KodeUnik, tangal FROM Buku WHERE tangal IS NOT NULL AND tangal <= DATE('now')";
    const queryParams = [];
    if (kategori) {
      query += " AND UPPER(Kategori) = UPPER(?)";
      queryParams.push(kategori);
    }
    query += " ORDER BY tangal DESC LIMIT 30";
    
    const stmt = db.prepare(query).bind(...queryParams);
    const { results } = await stmt.all();

    // 4. LOGIKA GAMBAR UTAMA PODCAST (CHANNEL COVER)
    let channelCoverUrl = `${SITE_URL}/default-podcast-cover.jpg`; 
    if (results.length > 0 && results[0].Image) {
      // Gunakan gambar buku terbaru sebagai cover utama lewat proxy
      channelCoverUrl = `${SITE_URL}/image-proxy?url=${encodeURIComponent(results[0].Image)}`;
    }

    // 5. GENERATE XML RSS (ITUNES COMPLIANT)
    let xml = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>${escapeXML(BLOG_TITLE)} - ${escapeXML(kategori)}</title>
  <link>${SITE_URL}</link>
  <description>${escapeXML(BLOG_DESCRIPTION)}</description>
  <language>en-us</language>
  <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
  <atom:link href="${url.href}" rel="self" type="application/rss+xml" />
  <itunes:author>${escapeXML(username)}</itunes:author>
  <itunes:owner>
    <itunes:name>${escapeXML(username)}</itunes:name>
    <itunes:email>${escapeXML(contactEmail)}</itunes:email>
  </itunes:owner>
  <itunes:image href="${escapeXML(channelCoverUrl)}" />
  <itunes:category text="Education">
    <itunes:category text="Books" />
  </itunes:category>
  <itunes:explicit>no</itunes:explicit>
`;

    for (const post of results) {
      const seed = post.KodeUnik;
      const judulBaru = `${spinTextStable(SPINTAX_PREFIX, seed)} ${post.Judul} ${spinTextStable(SPINTAX_SUFFIX, seed)}`;
      const postUrl = `${SITE_URL}/post/${post.KodeUnik}`;
      
      // Gunakan Image Proxy untuk setiap episode
      let proxiedItemImage = "";
      if (post.Image) {
        proxiedItemImage = `${SITE_URL}/image-proxy?url=${encodeURIComponent(post.Image)}`;
      }

      // Konstruksi Backlink Full
      const pinteresFullUrl = `https://pinterest.com/${pinterestPath}`;
      const podcastFullUrl = `https://${podcastPath}`;

      xml += `
  <item>
    <title>${escapeXML(judulBaru)}</title>
    <itunes:title>${escapeXML(judulBaru)}</itunes:title>
    <description><![CDATA[
      ${post.Deskripsi || "Listen to this chapter."}<br/><br/>
      📌 <strong>Pinterest Board:</strong> <a href="${pinteresFullUrl}">${pinteresFullUrl}</a><br/>
      🎙️ <strong>Available On:</strong> <a href="${podcastFullUrl}">${podcastFullUrl}</a>
    ]]></description>
    <pubDate>${new Date(post.tangal).toUTCString()}</pubDate>
    <guid isPermaLink="false">${post.KodeUnik}</guid>
    <link>${postUrl}</link>
    <enclosure url="${SITE_URL}/functions/podcast-audio/${post.KodeUnik}.mp3" length="5000000" type="audio/mpeg" />
    ${proxiedItemImage ? `<itunes:image href="${escapeXML(proxiedItemImage)}" />` : ""}
    <itunes:duration>00:15:00</itunes:duration>
    <itunes:explicit>no</itunes:explicit>
  </item>`;
    }

    xml += `\n</channel>\n</rss>`;

    return new Response(xml, {
      headers: {
        "Content-Type": "application/rss+xml; charset=utf-8",
        "Cache-Control": "public, s-maxage=3600",
      },
    });
  } catch (e) {
    return new Response(`Error: ${e.message}`, { status: 500 });
  }
}
