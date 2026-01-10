// --- [SETTING DOMAIN UTAMA] ---
const MAIN_DOMAIN = "domainutama.com"; 

const BLOG_TITLE = "PREMIUM AUDIO LIBRARY";
const BLOG_DESCRIPTION = "High Quality Audiobook & Ebook Collection - 2026 Edition";

// --- REUSE SPINTAX DARI RSS.XML.JS ---
const SPINTAX_PREFIX = `{Download|Get|Free|Read|Review|Grab} {PDF|Epub|Audiobook|Book} {Online|Directly|Instant}`;
const SPINTAX_SUFFIX = `{Full Version|Unabridged|Complete Edition|2026 Updated}`;

/**
 * Fungsi Escape XML yang diperbaiki (Penting agar tidak FATAL error)
 */
function escapeXML(str) {
  if (!str) return "";
  return str.toString().replace(/[<>&"']/g, function (match) {
    switch (match) {
      case "<": return "&lt;";
      case ">": return "&gt;";
      case "&": return "&amp;";
      case '"': return "&quot;";
      case "'": return "&apos;";
      default: return match;
    }
  });
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

  const path = params.path || [];

  if (path.length < 2) {
    return new Response("Invalid URL Structure", { status: 400 });
  }

  const kategori = path[0];
  const username = path[1];
  
  let podcastStartIndex = path.findIndex((seg, idx) => idx > 1 && seg.includes('.'));
  if (podcastStartIndex === -1) podcastStartIndex = path.length;

  const pinterestPath = path.slice(2, podcastStartIndex).join('/');
  const podcastPath = path.slice(podcastStartIndex).join('/');
  const contactEmail = `${username}@${MAIN_DOMAIN}`;

  try {
    let query = "SELECT Judul, Deskripsi, Image, KodeUnik, tangal FROM Buku WHERE tangal IS NOT NULL AND tangal <= DATE('now')";
    const queryParams = [];
    if (kategori) {
      query += " AND UPPER(Kategori) = UPPER(?)";
      queryParams.push(kategori);
    }
    query += " ORDER BY tangal DESC LIMIT 30";
    
    const { results } = await db.prepare(query).bind(...queryParams).all();

    // Gambar Utama Podcast
    let channelCoverUrl = `${SITE_URL}/default-cover.jpg`; 
    if (results.length > 0 && results[0].Image) {
      channelCoverUrl = `${SITE_URL}/image-proxy?url=${encodeURIComponent(results[0].Image)}`;
    }

    // GENERATE XML
    let xml = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>${escapeXML(BLOG_TITLE)} - ${escapeXML(kategori)}</title>
  <link>${SITE_URL}</link>
  <description>${escapeXML(BLOG_DESCRIPTION)}</description>
  <language>en-us</language>
  <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
  <atom:link href="${escapeXML(url.href)}" rel="self" type="application/rss+xml" />
  <itunes:author>${escapeXML(username)}</itunes:author>
  <itunes:owner>
    <itunes:name>${escapeXML(username)}</itunes:name>
    <itunes:email>${escapeXML(contactEmail)}</itunes:email>
  </itunes:owner>
  <itunes:image href="${escapeXML(channelCoverUrl)}" />
  <itunes:category text="Education">
    <itunes:category text="Books" />
  </itunes:category>
  <itunes:explicit>false</itunes:explicit>
`;

    for (const post of results) {
      const seed = post.KodeUnik;
      const judulBaru = `${spinTextStable(SPINTAX_PREFIX, seed)} ${post.Judul} ${spinTextStable(SPINTAX_SUFFIX, seed)}`;
      const postUrl = `${SITE_URL}/post/${post.KodeUnik}`;
      
      let proxiedItemImage = "";
      if (post.Image) {
        proxiedItemImage = `${SITE_URL}/image-proxy?url=${encodeURIComponent(post.Image)}`;
      }

      const pinteresFullUrl = `https://pinterest.com/${pinterestPath}`;
      const podcastFullUrl = `https://${podcastPath}`;

      xml += `
  <item>
    <title>${escapeXML(judulBaru)}</title>
    <itunes:title>${escapeXML(judulBaru)}</itunes:title>
    <description><![CDATA[${post.Deskripsi || "No description."}<br/><br/>📌 Pinterest: ${pinteresFullUrl}<br/>🎙️ Platform: ${podcastFullUrl}]]></description>
    <pubDate>${new Date(post.tangal).toUTCString()}</pubDate>
    <guid isPermaLink="false">${escapeXML(post.KodeUnik)}</guid>
    <link>${postUrl}</link>
    <enclosure url="${SITE_URL}/functions/podcast-audio/${post.KodeUnik}.mp3" length="5000000" type="audio/mpeg" />
    ${proxiedItemImage ? `<itunes:image href="${escapeXML(proxiedItemImage)}" />` : ""}
    <itunes:duration>00:15:00</itunes:duration>
    <itunes:explicit>false</itunes:explicit>
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
