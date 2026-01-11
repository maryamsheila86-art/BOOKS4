// Hardcode: /functions/[[path]]/podcast.xml.js

// --- CONFIG ---
const CONFIG = {
  title: "Audiobook Collection",
  // Deskripsi default jika db kosong
  description: "Listen to the best audiobooks and reviews.", 
  author: "Ebook Library",
  email: "admin@flowork.cloud", 
  language: "en-us", // Firstory pakai 'en', tapi 'en-us' juga ok
  category: "Arts", 
  subCategory: "Books",
  // GANTI INI dengan URL gambar 1400x1400 valid
  image: "https://placehold.co/1400x1400/jpg?text=Podcast+Cover",
  siteUrl: "" 
};

// --- SPINTAX ---
const SPINTAX_PREFIX = `{Audiobook:|Review:|Summary:|Podcast:|Listening Session:} \
{Full Version|Unabridged|Complete|Essential} \
{Guide|Book|Novel|Material}`;
const SPINTAX_SUFFIX = `{High Quality|HQ|Studio Edition|2026}`;

// --- HELPER: CLEANER & CDATA WRAPPER ---
// Ini kunci agar tidak error FATAL
function cdata(str) {
  if (!str) return "";
  // 1. Hapus Control Characters (ASCII 0-31) yang bikin XML rusak
  // Kecuali Tab(\x09), LF(\x0A), CR(\x0D)
  let clean = str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
  
  // 2. Bungkus dengan CDATA agar karakter aneh (&, <, >) dianggap teks aman
  // Ganti penutup CDATA jika ada di dalam teks
  clean = clean.replace(/]]>/g, "]]]]><![CDATA[>");
  return `<![CDATA[${clean}]]>`;
}

// Fungsi khusus untuk description (harus plain text, no HTML)
function stripTags(str) {
  if (!str) return "";
  let text = str.replace(/<[^>]*>?/gm, " "); // Hapus tag HTML
  text = text.replace(/\s+/g, " ").trim(); // Rapikan spasi
  return text;
}

function stringToHash(string) {
  let hash = 0;
  if (string.length === 0) return hash;
  for (let i = 0; i < string.length; i++) {
    hash = ((hash << 5) - hash) + string.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash);
}

function spinTextStable(text, seedStr) {
  return text.replace(/\{([^{}]+)\}/g, (match, content) => {
    const choices = content.split("|");
    const uniqueHash = stringToHash(seedStr + content);
    return choices[uniqueHash % choices.length];
  });
}

export async function onRequestGet(context) {
  const { env, request, params } = context;
  const db = env.DB;

  try {
    const url = new URL(request.url);

    // Deteksi Host (Router Support)
    const forwardedHost = request.headers.get("X-Forwarded-Host");
    const SITE_URL = forwardedHost ? `${url.protocol}//${forwardedHost}` : url.origin;
    
    // Setup Self Link
    const selfLink = `${SITE_URL}${url.pathname}`;

    // Filter Kategori
    const pathSegments = params.path || [];
    const filterKategori = pathSegments[0] || null;

    let query = "SELECT Judul, Deskripsi, Image, KodeUnik, tangal FROM Buku WHERE tangal <= DATE('now')";
    const queryParams = [];

    if (filterKategori) {
      query += " AND UPPER(Kategori) = UPPER(?)";
      queryParams.push(filterKategori);
    }
    
    query += " ORDER BY tangal DESC LIMIT 50"; 
    const stmt = db.prepare(query).bind(...queryParams);
    const { results } = await stmt.all();

    const feedTitle = filterKategori 
      ? `${CONFIG.title} - ${filterKategori}` 
      : CONFIG.title;

    // --- XML HEADER (COPY PASTE DARI FIRSTORY) ---
    // Perhatikan namespace 'spotify' dan 'podcast' yang ditambahkan
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" 
  xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" 
  xmlns:content="http://purl.org/rss/1.0/modules/content/"
  xmlns:podcast="https://podcastindex.org/namespace/1.0"
  xmlns:atom="http://www.w3.org/2005/Atom"
  xmlns:spotify="https://www.spotify.com/ns/rss">
  <channel>
    <title>${cdata(feedTitle)}</title>
    <link>${SITE_URL}</link>
    <description>${cdata(CONFIG.description)}</description>
    <language>${CONFIG.language}</language>
    <copyright>${cdata(CONFIG.author)}</copyright>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <generator>Firstory</generator> <atom:link href="${selfLink}" rel="self" type="application/rss+xml" />
    
    <itunes:summary>${cdata(CONFIG.description)}</itunes:summary>
    <itunes:author>${cdata(CONFIG.author)}</itunes:author>
    <itunes:type>episodic</itunes:type>
    <itunes:explicit>no</itunes:explicit> <itunes:owner>
      <itunes:name>${cdata(CONFIG.author)}</itunes:name>
      <itunes:email>${CONFIG.email}</itunes:email>
    </itunes:owner>
    <itunes:image href="${CONFIG.image}"/>
    <itunes:category text="${CONFIG.category}">
      <itunes:category text="${CONFIG.subCategory}"/>
    </itunes:category>
`;

    for (const post of results) {
      const audioUrl = `${SITE_URL}/podcast-audio/${post.KodeUnik}.mp3`;
      const postUrl = `${SITE_URL}/post/${post.KodeUnik}`;

      // Spintax
      const seed = post.KodeUnik || post.Judul;
      const t_prefix = spinTextStable(SPINTAX_PREFIX, seed + "ppref");
      const t_suffix = spinTextStable(SPINTAX_SUFFIX, seed + "psuff");
      const finalTitle = `${t_prefix} ${post.Judul} ${t_suffix}`;

      // Deskripsi: Firstory memisahkan Plain Text vs HTML
      const rawDesc = stripTags(post.Deskripsi || "Listen to this audiobook.");
      
      // HTML Content (Show Notes)
      // Kita bungkus HTML postingan agar tampil rapi di Spotify
      const htmlContent = `
        <p>${post.Deskripsi || ""}</p>
        <hr/>
        <p><strong>Title:</strong> ${post.Judul}</p>
        <p><strong>Listen here:</strong> <a href="${postUrl}">${postUrl}</a></p>
      `;

      // Image Episode
      let episodeImage = CONFIG.image;
      if (post.Image) {
        episodeImage = `${SITE_URL}/image-proxy?url=${encodeURIComponent(post.Image)}`;
      }

      // Size & Duration Dummy
      const dummySize = 3000000 + (stringToHash(seed + "size") % 5000000); // Bytes
      const dummyDuration = 600 + (stringToHash(seed + "dur") % 1200); // Seconds

      xml += `
    <item>
      <title>${cdata(finalTitle)}</title>
      <link>${postUrl}</link>
      <guid isPermaLink="false">${post.KodeUnik}</guid>
      <pubDate>${post.tangal ? new Date(post.tangal).toUTCString() : new Date().toUTCString()}</pubDate>
      
      <enclosure url="${audioUrl}" type="audio/mpeg" length="${dummySize}"/>
      
      <description>${cdata(rawDesc.substring(0, 300) + "...")}</description>
      
      <content:encoded>${cdata(htmlContent)}</content:encoded>
      
      <itunes:duration>${dummyDuration}</itunes:duration>
      <itunes:explicit>no</itunes:explicit>
      <itunes:image href="${episodeImage}"/>
      <itunes:episodeType>full</itunes:episodeType>
    </item>
`;
    }

    xml += `
  </channel>
</rss>`;

    // .trim() di akhir sangat PENTING untuk hapus spasi kosong penyebab error
    return new Response(xml.trim(), {
      headers: {
        "Content-Type": "application/rss+xml; charset=utf-8",
        "Cache-Control": "public, s-maxage=3600", 
      },
    });

  } catch (e) {
    return new Response(`XML Gen Error: ${e.message}`, { status: 500 });
  }
}
