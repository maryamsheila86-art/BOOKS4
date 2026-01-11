// Hardcode: /functions/[[path]]/podcast.xml.js

const CONFIG = {
  title: "Audiobook Collection",
  description: "Listen to the best audiobooks and reviews.", 
  author: "Ebook Library",
  email: "admin@flowork.cloud", 
  language: "en-us",
  category: "Arts", 
  subCategory: "Books",
  // Image wajib valid (JPG/PNG, min 1400x1400)
  image: "https://placehold.co/1400x1400/jpg?text=Podcast+Cover",
};

// --- SPINTAX ---
const SPINTAX_PREFIX = `{Audiobook:|Review:|Summary:|Podcast:|Listening Session:} \
{Full Version|Unabridged|Complete|Essential} \
{Guide|Book|Novel|Material}`;
const SPINTAX_SUFFIX = `{High Quality|HQ|Studio Edition|2026}`;

// --- HELPER: CLEANER & ENCODER ---
function cdata(str) {
  if (!str) return "";
  // Hapus karakter kontrol ASCII yang merusak XML (Vertical tab, null, dll)
  let clean = str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
  // Escape CDATA closing tags
  clean = clean.replace(/]]>/g, "]]]]><![CDATA[>");
  return `<![CDATA[${clean}]]>`;
}

function stripTags(str) {
  if (!str) return "";
  let text = str.replace(/<[^>]*>?/gm, " "); 
  text = text.replace(/\s+/g, " ").trim();
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
    const forwardedHost = request.headers.get("X-Forwarded-Host");
    const SITE_URL = forwardedHost ? `${url.protocol}//${forwardedHost}` : url.origin;
    const selfLink = `${SITE_URL}${url.pathname}`;

    // Query DB
    const pathSegments = params.path || [];
    const filterKategori = pathSegments[0] || null;
    const queryParams = [];
    
    let query = "SELECT Judul, Deskripsi, Image, KodeUnik, tangal FROM Buku WHERE tangal <= DATE('now')";
    if (filterKategori) {
      query += " AND UPPER(Kategori) = UPPER(?)";
      queryParams.push(filterKategori);
    }
    query += " ORDER BY tangal DESC LIMIT 50"; 
    
    const stmt = db.prepare(query).bind(...queryParams);
    const { results } = await stmt.all();

    const feedTitle = filterKategori ? `${CONFIG.title} - ${filterKategori}` : CONFIG.title;
    const lastBuildDate = new Date().toUTCString();

    // --- XML CONSTRUCTION ---
    // Kita bangun string XML-nya dulu
    let xmlBody = `<?xml version="1.0" encoding="UTF-8"?>
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
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <generator>Firstory</generator>
    <atom:link href="${selfLink}" rel="self" type="application/rss+xml" />
    <itunes:summary>${cdata(CONFIG.description)}</itunes:summary>
    <itunes:author>${cdata(CONFIG.author)}</itunes:author>
    <itunes:type>episodic</itunes:type>
    <itunes:explicit>no</itunes:explicit>
    <itunes:owner>
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
      
      const seed = post.KodeUnik || post.Judul;
      const t_prefix = spinTextStable(SPINTAX_PREFIX, seed + "ppref");
      const t_suffix = spinTextStable(SPINTAX_SUFFIX, seed + "psuff");
      const finalTitle = `${t_prefix} ${post.Judul} ${t_suffix}`;

      const rawDesc = stripTags(post.Deskripsi || "Listen to this audiobook.");
      
      const htmlContent = `
        <p>${post.Deskripsi || ""}</p>
        <hr/>
        <p><strong>Title:</strong> ${post.Judul}</p>
        <p><strong>Listen here:</strong> <a href="${postUrl}">${postUrl}</a></p>
      `;

      let episodeImage = CONFIG.image;
      if (post.Image) {
        episodeImage = `${SITE_URL}/image-proxy?url=${encodeURIComponent(post.Image)}`;
      }

      const dummySize = 3000000 + (stringToHash(seed + "size") % 5000000);
      const dummyDuration = 600 + (stringToHash(seed + "dur") % 1200);

      xmlBody += `
    <item>
      <title>${cdata(finalTitle)}</title>
      <link>${postUrl}</link>
      <guid isPermaLink="false">${post.KodeUnik}</guid>
      <pubDate>${post.tangal ? new Date(post.tangal).toUTCString() : lastBuildDate}</pubDate>
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

    xmlBody += `
  </channel>
</rss>`;

    // --- CRITICAL FIX: ENCODING & CONTENT-LENGTH ---
    // 1. Bersihkan spasi kosong di awal/akhir
    const finalXmlString = xmlBody.trim();
    
    // 2. Ubah String ke Uint8Array (Byte) untuk hitung ukuran pasti
    const encoder = new TextEncoder();
    const data = encoder.encode(finalXmlString);
    
    // 3. Return Response dengan Content-Length Eksplisit
    return new Response(data, {
      status: 200,
      headers: {
        "Content-Type": "application/rss+xml; charset=utf-8",
        // Memberitahu validator ukuran file sebenarnya (mengatasi error 'Cant read contents')
        "Content-Length": data.byteLength.toString(),
        // Header tambahan agar validator senang
        "Last-Modified": lastBuildDate,
        "ETag": `"${stringToHash(finalXmlString)}"` // Simple ETag
      },
    });

  } catch (e) {
    return new Response(`Error: ${e.message}`, { status: 500 });
  }
}
