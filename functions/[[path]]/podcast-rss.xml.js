// Hardcode: /functions/[[path]]/podcast-rss.xml.js
// [PODCAST HOSTING VERSION - NO CACHE]
// Fokus: Validitas standar Podcast (iTunes/Spotify) & Anti-Leak Domain.

const SPINTAX_PREFIX = ["Download", "Get", "Read", "Free", "Grab", "Full"];
const SPINTAX_SUFFIX = ["PDF", "ePub", "Ebook", "Audiobook", "Full Version"];

function spinWord(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function cleanTextForXML(str) {
  if (!str) return "";
  let clean = String(str).replace(/<[^>]*>?/gm, ''); // Hapus HTML
  clean = clean.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ""); // Hapus karakter ilegal
  return clean.replace(/]]>/g, "]]&gt;").trim(); // Fix CDATA
}

function escapeXML(str) {
  if (!str) return "";
  const s = String(str);
  return s.replace(/[<>&"']/g, m => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;','\'':'&#39;'}[m]));
}

export async function onRequestGet(context) {
  const { env, request, params } = context;
  const db = env.DB;

  try {
    const url = new URL(request.url);

    // 1. FIX DOMAIN (DETEKSI SUBDOMAIN DARI ROUTER)
    // Agar link enclosure dan episode tidak bocor ke .pages.dev
    const forwardedHost = request.headers.get("X-Forwarded-Host");
    const SITE_URL = forwardedHost ? `https://${forwardedHost}` : url.origin;

    const pathSegments = params.path || [];
    const kategori = pathSegments[0] || "General";
    const emailUser = pathSegments[1] || "admin";

    // 2. QUERY DATABASE (LIMIT 50)
    const queryParams = [];
    let query = "SELECT Judul, Deskripsi, Image, KodeUnik, tangal FROM Buku WHERE tangal IS NOT NULL";
    
    if (kategori && kategori !== "General") {
      query += " AND UPPER(Kategori) = UPPER(?)";
      queryParams.push(kategori);
    }
    query += " ORDER BY tangal DESC LIMIT 50";

    const stmt = db.prepare(query).bind(...queryParams);
    const { results } = await stmt.all();

    // 3. GENERATE ITEMS XML (STANDAR PODCAST)
    let itemsXml = "";
    if (results && results.length > 0) {
      results.forEach((post, i) => {
        // Mapping Kolom (Case Sensitive Protection)
        const judul = post.Judul || post.judul;
        const deskripsi = post.Deskripsi || post.deskripsi;
        const kode = post.KodeUnik || post.kodeunik;
        const gambar = post.Image || post.image;
        const tanggal = post.tangal || post.tanggal;

        const postUrl = `${SITE_URL}/post/${kode}`;
        const audioUrl = `${SITE_URL}/podcast-audio/${kode}.mp3`; // Link Enclosure
        const judulBaru = `${spinWord(SPINTAX_PREFIX)} ${cleanTextForXML(judul)} ${spinWord(SPINTAX_SUFFIX)}`;
        
        itemsXml += `
    <item>
      <title>${escapeXML(judulBaru)}</title>
      <itunes:title>${escapeXML(judulBaru)}</itunes:title>
      <link>${escapeXML(postUrl)}</link>
      <guid isPermaLink="false">${escapeXML(kode)}</guid>
      <description><![CDATA[${cleanTextForXML(deskripsi).substring(0, 500)}]]></description>
      <itunes:summary>${escapeXML(cleanTextForXML(deskripsi).substring(0, 255))}</itunes:summary>
      <pubDate>${new Date(tanggal).toUTCString()}</pubDate>
      <enclosure url="${escapeXML(audioUrl)}" type="audio/mpeg" length="1000000" />
      <itunes:duration>600</itunes:duration>
      <itunes:explicit>no</itunes:explicit>
      <itunes:episodeType>full</itunes:episodeType>
      ${gambar ? `<itunes:image href="${SITE_URL}/image-proxy?url=${encodeURIComponent(gambar)}" />` : ""}
    </item>`;
      });
    }

    // 4. RAKIT XML FINAL (DENGAN NAMESPACE LENGKAP)
    const dynamicAuthor = `${emailUser.toUpperCase()} Media`;
    const xmlBody = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>${escapeXML(dynamicAuthor)} - ${escapeXML(kategori)} Podcast</title>
  <link>${escapeXML(SITE_URL)}</link>
  <description>Best Audio Content for ${escapeXML(kategori)}</description>
  <language>en-us</language>
  <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
  <atom:link href="${escapeXML(url.href)}" rel="self" type="application/rss+xml" />
  <itunes:author>${escapeXML(dynamicAuthor)}</itunes:author>
  <itunes:summary>Explore our daily collection of ${escapeXML(kategori)} stories.</itunes:summary>
  <itunes:owner>
    <itunes:name>${escapeXML(dynamicAuthor)}</itunes:name>
    <itunes:email>${emailUser}@${url.hostname}</itunes:email>
  </itunes:owner>
  <itunes:explicit>no</itunes:explicit>
  <itunes:category text="Education" />
  <itunes:image href="https://images.pexels.com/photos/415071/pexels-photo-415071.jpeg" />
  ${itemsXml}
</channel>
</rss>`;

    return new Response(xmlBody.trim(), {
      headers: { 
        "Content-Type": "application/rss+xml; charset=utf-8",
        "X-Robots-Tag": "noindex" // Opsional: agar robot pencari tidak mengindeks XML mentah
      },
    });

  } catch (e) {
    return new Response(`<?xml version="1.0"?><rss><channel><title>Error</title><description>${escapeXML(e.message)}</description></channel></rss>`, { 
      status: 200, // Tetap 200 agar validator XML bisa membaca pesan error-nya
      headers: { "Content-Type": "application/rss+xml" } 
    });
  }
}
