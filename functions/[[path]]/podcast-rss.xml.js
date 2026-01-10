// Lokasi: /functions/[[path]]/podcast-rss.xml.js

// --- CONFIG: DOMAIN UTAMA ---
const MAIN_DOMAIN = "domainutama.com"; 

const BLOG_TITLE = "PREMIUM AUDIO LIBRARY";
const BLOG_DESCRIPTION = "High Quality Audiobook & Ebook Collection";

// --- REUSE SPINTAX DARI RSS.XML.JS ---
const SPINTAX_PREFIX = `{Download|Get|Free|Read|Review|Grab} {PDF|Epub|Audiobook|Book} {Online|Directly|Instant}`;
const SPINTAX_SUFFIX = `{Full Version|Unabridged|Complete Edition|2026 Updated}`;

function escapeXML(str) {
  if (!str) return "";
  return str.replace(/[<>&"']/g, (m) => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":"&#39;"}[m]));
}

function stringToHash(string) {
  let hash = 0;
  for (let i = 0; i < string.length; i++) {
    hash = ((hash << 5) - hash) + string.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash);
}

function spinTextStable(text, seedStr) {
  return text.replace(/\{([^{}]+)\}/g, function (match, content) {
    const choices = content.split("|");
    const uniqueHash = stringToHash(seedStr + content);
    return choices[uniqueHash % choices.length];
  });
}

export async function onRequestGet(context) {
  const { env, request, params } = context;
  const db = env.DB;
  const url = new URL(request.url);
  const SITE_URL = url.origin;

  /**
   * Karena file ini bernama podcast-rss.xml.js di dalam folder [[path]],
   * params.path HANYA berisi folder-folder SEBELUM nama file tersebut.
   * Contoh: /ebook1/miller/pinter/link/spotify.com/1/podcast-rss.xml
   * path = ["ebook1", "miller", "pinter", "link", "spotify.com", "1"]
   */
  const path = params.path || [];
  
  if (path.length < 2) {
    return new Response("Invalid Path Structure", { status: 400 });
  }

  // 1. PARSING PATH
  const kategori = path[0]; // "ebook1"
  const username = path[1]; // "miller"
  
  // Mencari domain platform podcast (segment yang mengandung titik '.')
  let podcastStartIndex = path.findIndex((seg, idx) => idx > 1 && seg.includes('.'));
  
  // Jika tidak ditemukan domain, anggap sisa path adalah podcast link
  if (podcastStartIndex === -1) podcastStartIndex = path.length;

  const pinterestPath = path.slice(2, podcastStartIndex).join('/');
  const podcastPath = path.slice(podcastStartIndex).join('/');

  // 2. LOGIKA EMAIL (Domain Utama sesuai Catch-All)
  const contactEmail = `${username}@${MAIN_DOMAIN}`;

  try {
    // 3. QUERY DATABASE
    let query = "SELECT Judul, Deskripsi, Image, KodeUnik, tangal FROM Buku WHERE tangal IS NOT NULL AND tangal <= DATE('now')";
    const queryParams = [];
    if (kategori) {
      query += " AND UPPER(Kategori) = UPPER(?)";
      queryParams.push(kategori);
    }
    query += " ORDER BY tangal DESC LIMIT 30";
    const { results } = await db.prepare(query).bind(...queryParams).all();

    // 4. GENERATE RSS
    let xml = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:content="http://purl.org/rss/1.0/modules/content/">
<channel>
  <title>${escapeXML(BLOG_TITLE)} - ${escapeXML(kategori)}</title>
  <link>${SITE_URL}</link>
  <description>${escapeXML(BLOG_DESCRIPTION)}</description>
  <language>en-us</language>
  <itunes:owner>
    <itunes:name>${escapeXML(username)}</itunes:name>
    <itunes:email>${escapeXML(contactEmail)}</itunes:email>
  </itunes:owner>
  <itunes:image href="${SITE_URL}/podcast-cover.jpg" />
  <itunes:category text="Education" />
`;

    for (const post of results) {
      const seed = post.KodeUnik;
      const judulBaru = `${spinTextStable(SPINTAX_PREFIX, seed)} ${post.Judul} ${spinTextStable(SPINTAX_SUFFIX, seed)}`;
      
      // IMAGE PROXY
      let proxiedImageUrl = "";
      if (post.Image) {
        const encodedImageUrl = encodeURIComponent(post.Image);
        proxiedImageUrl = `${SITE_URL}/image-proxy?url=${encodedImageUrl}`;
      }

      // BACKLINK
      const pinterestFullUrl = `https://pinterest.com/${pinterestPath}`;
      const podcastFullUrl = `https://${podcastPath}`;

      xml += `
  <item>
    <title>${escapeXML(judulBaru)}</title>
    <description><![CDATA[
      ${post.Deskripsi || "Listen to this audiobook."}<br/><br/>
      📌 <strong>Pinterest:</strong> <a href="${pinterestFullUrl}">${pinterestFullUrl}</a><br/>
      🎙️ <strong>Platform:</strong> <a href="${podcastFullUrl}">${podcastFullUrl}</a>
    ]]></description>
    <pubDate>${new Date(post.tangal).toUTCString()}</pubDate>
    <guid isPermaLink="false">${post.KodeUnik}</guid>
    <link>${SITE_URL}/post/${post.KodeUnik}</link>
    ${proxiedImageUrl ? `<itunes:image href="${escapeXML(proxiedImageUrl)}" />` : ""}
    <enclosure url="${SITE_URL}/functions/podcast-audio/${post.KodeUnik}.mp3" length="4500000" type="audio/mpeg" />
    <itunes:duration>00:15:00</itunes:duration>
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
