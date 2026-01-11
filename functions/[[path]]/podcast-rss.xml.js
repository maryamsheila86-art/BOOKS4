// Hardcode: /functions/[[path]]/podcast-rss.xml.js
// [PARTNER CODING FIXED VERSION]
// Updated to match Firstory/Professional Standards

const BLOG_TITLE = "PODCAST NAME";
const BLOG_DESCRIPTION = "THE BEST PODCAST DESCRIPTION";
const PODCAST_AUTHOR = "Author Name";
const PODCAST_EMAIL = "email@domain.com"; // [WAJIB DIISI UNTUK APPLE/SPOTIFY]
const PODCAST_CATEGORY = "Technology"; // Kategori Utama
const SITE_URL = "https://domain-kamu.com"; // Ganti dengan domain aslimu

// Helper function to clean text
function truncateAndClean(str, length = 250) {
  if (!str) return "";
  const cleanStr = str.replace(/<[^>]*>?/gm, '');
  const truncated = cleanStr.substring(0, length);
  return cleanStr.length > length ? truncated + "..." : truncated;
}

function escapeXML(str) {
  if (!str) return "";
  return str.replace(/[<>&"']/g, function (match) {
    const map = {
      "<": "&lt;",
      ">": "&gt;",
      "&": "&amp;",
      '"': "&quot;",
      "'": "&#39;"
    };
    return map[match];
  });
}

export async function onRequestGet(context) {
  const { env, request } = context;
  const db = env.DB;

  // Ambil URL saat ini untuk atom:link (Self Reference)
  const currentUrl = request.url;

  try {
    // 1. Ambil data dari D1 Database
    const { results } = await db.prepare("SELECT * FROM posts ORDER BY tangal DESC").all();

    // 2. Siapkan Header XML dengan Namespace Lengkap (Standar Firstory)
    const xmlHead = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" 
  xmlns:dc="http://purl.org/dc/elements/1.1/" 
  xmlns:content="http://purl.org/rss/1.0/modules/content/" 
  xmlns:atom="http://www.w3.org/2005/Atom" 
  xmlns:googleplay="http://www.google.com/schemas/play-podcasts/1.0" 
  xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
<channel>
    <title><![CDATA[${BLOG_TITLE}]]></title>
    <description><![CDATA[${BLOG_DESCRIPTION}]]></description>
    <link>${SITE_URL}</link>
    <atom:link href="${currentUrl}" rel="self" type="application/rss+xml"/>
    <language>id</language>
    <copyright><![CDATA[${PODCAST_AUTHOR}]]></copyright>
    <itunes:author>${PODCAST_AUTHOR}</itunes:author>
    <itunes:type>episodic</itunes:type>
    <itunes:owner>
        <itunes:name><![CDATA[${PODCAST_AUTHOR}]]></itunes:name>
        <itunes:email>${PODCAST_EMAIL}</itunes:email>
    </itunes:owner>
    <itunes:category text="${PODCAST_CATEGORY}"></itunes:category>
    <itunes:explicit>no</itunes:explicit>
    <image>
        <url>https://flowork.cloud/logo-podcast.jpg</url> 
        <title>${BLOG_TITLE}</title>
        <link>${SITE_URL}</link>
    </image>
    <itunes:image href="https://flowork.cloud/logo-podcast.jpg"/>
`;

    // 3. Loop Item (Episode)
    let items = "";
    
    results.forEach((post) => {
      // Setup variabel (Fallback ke default jika data DB kosong)
      // [TODO]: Sebaiknya tambahkan kolom 'duration' dan 'file_size' di DB kamu di masa depan
      const audioUrl = post.audioUrl || ""; 
      const fileSize = post.file_size || "1000000"; // Bytes (Default dummy jika tidak ada di DB)
      const duration = post.duration || "300"; // Seconds (Default dummy)
      const pubDate = post.tangal ? new Date(post.tangal).toUTCString() : new Date().toUTCString();
      const proxiedImageUrl = post.image || ""; 
      
      // GUID adalah kunci agar tidak duplicate download! Gunakan ID post.
      const guid = post.id || post.slug || audioUrl; 

      items += `
    <item>
      <title><![CDATA[${post.Judul}]]></title>
      <description><![CDATA[${truncateAndClean(post.Deskripsi)}]]></description>
      <content:encoded><![CDATA[
        ${post.Deskripsi || "No description."}
        <br/><br/>
        Artikel ini ditulis oleh <a href="https://flowork.cloud">Flowork</a>
      ]]></content:encoded>
      <link>${SITE_URL}/episode/${post.slug}</link>
      <guid isPermaLink="false">${guid}</guid>
      <pubDate>${pubDate}</pubDate>
      <dc:creator><![CDATA[${PODCAST_AUTHOR}]]></dc:creator>
      
      <enclosure url="${audioUrl}" length="${fileSize}" type="audio/mpeg" />
      
      <itunes:summary>${truncateAndClean(post.Deskripsi)}</itunes:summary>
      <itunes:duration>${duration}</itunes:duration>
      <itunes:episodeType>full</itunes:episodeType>
      <itunes:explicit>false</itunes:explicit>
      ${proxiedImageUrl ? `<itunes:image href="${escapeXML(proxiedImageUrl)}" />` : ""}
    </item>
`;
    });

    // 4. Tutup Tag
    const xmlTail = `
</channel>
</rss>`;

    const xml = xmlHead + items + xmlTail;

    // 5. Return Response dengan Content-Type yang benar
    return new Response(xml, {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "max-age=60" // Cache sebentar biar tidak berat di DB
      },
    });

  } catch (err) {
    return new Response(`Error generating RSS: ${err.message}`, { status: 500 });
  }
}
