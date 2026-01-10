// --- [CONFIG] ---
const MAIN_DOMAIN = "domainutama.com"; // Domain utama untuk catch-all email

const BLOG_TITLE = "PREMIUM AUDIO LIBRARY";
const BLOG_DESCRIPTION = "High Quality Audiobook & Ebook Collection - 2026 Edition";

/**
 * Fungsi Escape XML yang disempurnakan.
 * Mencegah error "Formatting Issue" atau "Broken Tags" di Castvalidator.
 */
function escapeXML(str) {
  if (!str) return "";
  return str.toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Hash deterministik untuk Spintax.
 */
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

  // Path parsing
  const path = params.path || [];
  if (path.length < 2) {
    return new Response("Invalid URL Structure", { status: 400 });
  }

  const kategori = path[0];
  const username = path[1];
  
  // Mencari domain platform podcast
  let podcastStartIndex = path.findIndex((seg, idx) => idx > 1 && seg.includes('.'));
  if (podcastStartIndex === -1) podcastStartIndex = path.length;

  const pinterestPath = path.slice(2, podcastStartIndex).join('/');
  const podcastPath = path.slice(podcastStartIndex).join('/');
  const contactEmail = `${username}@${MAIN_DOMAIN}`;

  try {
    const query = "SELECT Judul, Deskripsi, Image, KodeUnik, tangal FROM Buku WHERE tangal IS NOT NULL AND tangal <= DATE('now') ORDER BY tangal DESC LIMIT 30";
    const { results } = await db.prepare(query).all();

    // Gambar Utama (Channel Cover)
    let channelCoverUrl = `${SITE_URL}/default-cover.jpg`; 
    if (results.length > 0 && results[0].Image) {
      channelCoverUrl = `${SITE_URL}/image-proxy?url=${encodeURIComponent(results[0].Image)}`;
    }

    // --- GENERATE XML ---
    let xml = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>${escapeXML(BLOG_TITLE)} - ${escapeXML(kategori)}</title>
  <link>${escapeXML(SITE_URL)}</link>
  <description>${escapeXML(BLOG_DESCRIPTION)}</description>
  <language>en-us</language>
  <copyright>2026 ${escapeXML(MAIN_DOMAIN)}</copyright>
  <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
  <atom:link href="${escapeXML(url.href)}" rel="self" type="application/rss+xml" />
  <itunes:author>${escapeXML(username)}</itunes:author>
  <itunes:type>episodic</itunes:type>
  <itunes:owner>
    <itunes:name>${escapeXML(username)}</itunes:name>
    <itunes:email>${escapeXML(contactEmail)}</itunes:email>
  </itunes:owner>
  <itunes:image href="${escapeXML(channelCoverUrl)}" />
  <itunes:category text="Arts">
    <itunes:category text="Books" />
  </itunes:category>
  <itunes:explicit>false</itunes:explicit>
`;

    for (const post of results) {
      const seed = post.KodeUnik;
      const spinPre = `{Download|Get|Free|Read|Review}`;
      const spinSuf = `{Full Version|Unabridged|Complete}`;
      const judulBaru = `${spinTextStable(spinPre, seed)} ${post.Judul} ${spinTextStable(spinSuf, seed)}`;
      
      const itemImage = post.Image ? `${SITE_URL}/image-proxy?url=${encodeURIComponent(post.Image)}` : channelCoverUrl;
      const audioUrl = `${SITE_URL}/functions/podcast-audio/${post.KodeUnik}.mp3`;

      xml += `
  <item>
    <title>${escapeXML(judulBaru)}</title>
    <itunes:title>${escapeXML(judulBaru)}</itunes:title>
    <description><![CDATA[${post.Deskripsi || "Listen to this audiobook."}<br/><br/>📌 Pinterest: https://pinterest.com/${pinterestPath}<br/>🎙️ Platform: https://${podcastPath}]]></description>
    <pubDate>${new Date(post.tangal).toUTCString()}</pubDate>
    <guid isPermaLink="false">${escapeXML(post.KodeUnik)}</guid>
    <link>${SITE_URL}/post/${post.KodeUnik}</link>
    <enclosure url="${escapeXML(audioUrl)}" length="5000000" type="audio/mpeg" />
    <itunes:image href="${escapeXML(itemImage)}" />
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
