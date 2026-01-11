// Hardcode: /functions/[[path]]/podcast.xml.js

// --- 1. IDENTITAS PODCAST (Ganti URL Image & Email) ---
const CONFIG = {
  title: "Audiobook Collection",
  description: "Dengarkan ringkasan dan review buku best-seller dunia. Update setiap hari.",
  author: "Ebook Library",
  email: "admin@flowork.cloud", // Wajib ada untuk validasi
  language: "en-us",
  category: "Arts", 
  subCategory: "Books",
  // GANTI INI dengan URL gambar JPG/PNG (Min 1400x1400px) valid milikmu
  image: "https://placehold.co/1400x1400/jpg?text=Podcast+Cover",
  siteUrl: "" 
};

// --- 2. CONFIG SPINTAX ---
const SPINTAX_PREFIX = `{Audiobook:|Review:|Summary:|Podcast:|Listening Session:} \
{Full Version|Unabridged|Complete|Essential} \
{Guide|Book|Novel|Material}`;

const SPINTAX_SUFFIX = `{High Quality|HQ|Studio Edition|2026}`;

// --- HELPER FUNCTIONS ---
function escapeXML(str) {
  if (!str) return "";
  return str.replace(/[<>&"']/g, m => ({
    "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;"
  })[m]);
}

function stripHTML(str) {
  if (!str) return "";
  return str.replace(/<[^>]*>?/gm, "");
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

    // --- DETEKSI ROUTER ---
    const forwardedHost = request.headers.get("X-Forwarded-Host");
    const SITE_URL = forwardedHost ? `${url.protocol}//${forwardedHost}` : url.origin;
    CONFIG.siteUrl = SITE_URL;

    // --- QUERY DATABASE ---
    const pathSegments = params.path || [];
    // Ambil kategori dari path pertama (misal: domain.com/novel/podcast.xml -> novel)
    const filterKategori = pathSegments[0] || null;

    let query = "SELECT Judul, Deskripsi, Image, KodeUnik, tangal FROM Buku WHERE tangal <= DATE('now')";
    const queryParams = [];

    if (filterKategori) {
      query += " AND UPPER(Kategori) = UPPER(?)";
      queryParams.push(filterKategori);
    }
    
    query += " ORDER BY tangal DESC LIMIT 100"; 

    const stmt = db.prepare(query).bind(...queryParams);
    const { results } = await stmt.all();

    const feedTitle = filterKategori 
      ? `${CONFIG.title} - ${filterKategori}` 
      : CONFIG.title;
      
    // Link ke file ini sendiri
    const selfLink = `${SITE_URL}${url.pathname}`;

    // --- XML HEADER ---
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" 
  xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" 
  xmlns:content="http://purl.org/rss/1.0/modules/content/"
  xmlns:googleplay="http://www.google.com/schemas/play-podcasts/1.0"
  xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXML(feedTitle)}</title>
    <link>${SITE_URL}</link>
    <description>${escapeXML(CONFIG.description)}</description>
    <language>${CONFIG.language}</language>
    <copyright>Copyright ${new Date().getFullYear()} ${escapeXML(CONFIG.author)}</copyright>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${selfLink}" rel="self" type="application/rss+xml" />
    
    <itunes:subtitle>${escapeXML(CONFIG.description.substring(0, 200))}</itunes:subtitle>
    <itunes:author>${escapeXML(CONFIG.author)}</itunes:author>
    <itunes:summary>${escapeXML(CONFIG.description)}</itunes:summary>
    <itunes:owner>
      <itunes:name>${escapeXML(CONFIG.author)}</itunes:name>
      <itunes:email>${escapeXML(CONFIG.email)}</itunes:email>
    </itunes:owner>
    <itunes:image href="${CONFIG.image}"/>
    <itunes:category text="${escapeXML(CONFIG.category)}">
      <itunes:category text="${escapeXML(CONFIG.subCategory)}"/>
    </itunes:category>
    <itunes:explicit>false</itunes:explicit>
    <itunes:type>episodic</itunes:type>
`;

    for (const post of results) {
      // URL Audio mengarah ke file generator MP3
      const audioUrl = `${SITE_URL}/podcast-audio/${post.KodeUnik}.mp3`;
      const postUrl = `${SITE_URL}/post/${post.KodeUnik}`;

      // Spintax Judul
      const seed = post.KodeUnik || post.Judul;
      const t_prefix = spinTextStable(SPINTAX_PREFIX, seed + "ppref");
      const t_suffix = spinTextStable(SPINTAX_SUFFIX, seed + "psuff");
      const finalTitle = `${t_prefix} ${post.Judul} ${t_suffix}`;

      // Deskripsi
      const rawDesc = stripHTML(post.Deskripsi || "Listen to this audiobook.");
      const htmlDesc = `
        <p>${escapeXML(post.Deskripsi || "")}</p>
        <p>Title: <strong>${escapeXML(post.Judul)}</strong></p>
        <p>Visit: <a href="${postUrl}">${escapeXML(CONFIG.title)}</a></p>
      `;

      // Image Episode (Proxy)
      let episodeImage = CONFIG.image;
      if (post.Image) {
        episodeImage = `${SITE_URL}/image-proxy?url=${encodeURIComponent(post.Image)}`;
      }

      // Dummy Size (Consistent per book)
      const dummySize = 3000000 + (stringToHash(seed + "size") % 5000000);

      xml += `
    <item>
      <title>${escapeXML(finalTitle)}</title>
      <link>${postUrl}</link>
      <pubDate>${post.tangal ? new Date(post.tangal).toUTCString() : new Date().toUTCString()}</pubDate>
      <guid isPermaLink="false">${post.KodeUnik}</guid>
      <enclosure url="${audioUrl}" length="${dummySize}" type="audio/mpeg"/>
      <description>${escapeXML(rawDesc.substring(0, 400))}...</description>
      <content:encoded><![CDATA[${htmlDesc}]]></content:encoded>
      <itunes:duration>1200</itunes:duration>
      <itunes:explicit>false</itunes:explicit>
      <itunes:image href="${escapeXML(episodeImage)}"/>
    </item>
`;
    }

    xml += `
  </channel>
</rss>`;

    return new Response(xml, {
      headers: {
        "Content-Type": "application/rss+xml; charset=utf-8",
        "Cache-Control": "public, s-maxage=3600", 
      },
    });

  } catch (e) {
    return new Response(`XML Error: ${e.message}`, { status: 500 });
  }
}
