// Hardcode: /functions/[[path]]/podcast.xml.js

const DEFAULT_CONFIG = {
  language: "en-us",
  category: "Arts", 
  subCategory: "Books",
};

// --- SPINTAX CONFIG ---
const FEED_TITLE_SPIN = `{Audiobook Collection|Best Audio Library|Daily Listen|Podcast Books|Story Time|Audio Archive|The Reader's Hub|Digital Book Shelf}`;
const FEED_DESC_SPIN = `{Listen to the best audiobooks and reviews.|Your daily dose of stories and audio reviews.|Complete collection of audiobooks for free.|Unabridged audiobooks and summaries.|Top rated stories and educational materials.|Archive of classic and modern literature.}`;
const FEED_AUTHOR_SPIN = `{Ebook Library|Audio Team|Story Teller|Book Lover|Digital Archive|Net Reader|The Librarian|Audio Admin}`;

const SPINTAX_PREFIX = `{Download|Get|Free|Read|Review|Grab} {PDF|Epub|Mobi|Audiobook|Kindle|Book} {Online|Directly|Instant|Fast}`;
const SPINTAX_SUFFIX = `{Full Version|Unabridged|Complete Edition|2026 Updated} {No Sign Up|Direct Link|High Speed|Free Account} {Best Seller|Trending|Viral|Must Read}`;
const MULTI_LANG_PREFIX = `{Download|Herunterladen (DE)|Télécharger (FR)|Descargar (ES)|Scarica (IT)} {Free|Kostenlos|Gratuit|Gratis} {PDF|Ebook|Livre|Libro}`;

const PINTEREST_INTRO = `{For more visual guides|To see the book cover and details|For related images and pinboards|Check out our visual collection|Discover more about this title} {visit our Pinterest|check this Board|on our Pinterest Board|view the gallery|see the pin}`;
const PINTEREST_ANCHOR = `{View Board|Visit Pinterest|See Collection|Visual Guide|Pin It}`;
const TIER2_INTRO = `{Also available on|Listen on our partner platform|Supported by|Alternative streaming link|Mirror link for this episode} {via|at|on|checking|visiting}`;
const TIER2_ANCHOR = `{Official Stream|Partner Site|High Speed Server|External Player|Mirror Source}`;
// ---------------------

function cdata(str) {
  if (!str) return "";
  let clean = str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
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

function getRootDomain(hostname) {
  const parts = hostname.split('.');
  if (parts.length > 2) {
    return parts.slice(1).join('.');
  }
  return hostname;
}

export async function onRequest(context) {
  const { env, request, params } = context;
  const db = env.DB;

  if (request.method === "OPTIONS") {
    return new Response(null, { headers: { "Access-Control-Allow-Origin": "*" } });
  }

  try {
    const url = new URL(request.url);
    const forwardedHost = request.headers.get("X-Forwarded-Host");
    const CURRENT_HOST = forwardedHost || url.host;
    const SITE_URL = `${url.protocol}//${CURRENT_HOST}`;
    const selfLink = `${SITE_URL}${url.pathname}`;

    const pathSegments = params.path || [];
    const categoryParam = pathSegments[0]; 
    const usernameParam = pathSegments[1]; 
    const pintUserParam = pathSegments[2]; 
    const pintBoardParam = pathSegments[3]; 
    const extraBacklinkSegments = pathSegments.slice(4); 

    const emailUser = usernameParam || "contact";
    const emailDomain = getRootDomain(CURRENT_HOST);
    const DYNAMIC_EMAIL = `${emailUser}@${emailDomain}`;
    const identitySeed = (categoryParam || "") + (usernameParam || "");
    
    const dynamicFeedTitle = spinTextStable(FEED_TITLE_SPIN, identitySeed + "title");
    const dynamicFeedDesc = spinTextStable(FEED_DESC_SPIN, identitySeed + "desc");
    const dynamicFeedAuthor = spinTextStable(FEED_AUTHOR_SPIN, identitySeed + "auth");

    let rawPinterestUrl = "";
    if (pintUserParam && pintBoardParam) {
        rawPinterestUrl = `https://www.pinterest.com/${pintUserParam}/${pintBoardParam}/`;
    }

    let rawTier2Url = "";
    if (extraBacklinkSegments.length > 0) {
        rawTier2Url = extraBacklinkSegments.join("/");
        if (!rawTier2Url.startsWith("http")) rawTier2Url = "https://" + rawTier2Url;
    }

    const todayStr = new Date().toISOString().slice(0, 10); 
    const dailyHash = stringToHash(todayStr + identitySeed);
    const dynamicLimit = 100 + (dailyHash % 91); 

    const queryParams = [];
    let query = "SELECT Judul, Deskripsi, Image, KodeUnik, tangal FROM Buku WHERE tangal <= DATE('now')";
    if (categoryParam) {
      query += " AND UPPER(Kategori) = UPPER(?)";
      queryParams.push(categoryParam);
    }
    query += ` ORDER BY tangal DESC LIMIT ${dynamicLimit}`; 
    
    const stmt = db.prepare(query).bind(...queryParams);
    const { results } = await stmt.all();

    const lastBuildDate = new Date().toUTCString();
    const picsumSeed = identitySeed || "default";
    const rawPicsumUrl = `https://picsum.photos/seed/${picsumSeed}/1400/1400`;
    const channelCoverUrl = `${SITE_URL}/image-proxy?url=${encodeURIComponent(rawPicsumUrl)}&amp;ext=.jpg`;

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:podcast="https://podcastindex.org/namespace/1.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
<title>${cdata(dynamicFeedTitle)}</title>
<link>${SITE_URL}</link>
<description>${cdata(dynamicFeedDesc)}</description>
<language>${DEFAULT_CONFIG.language}</language>
<copyright>${cdata(dynamicFeedAuthor)}</copyright>
<lastBuildDate>${lastBuildDate}</lastBuildDate>
<generator>Firstory</generator>
<atom:link href="${selfLink}" rel="self" type="application/rss+xml" />
<itunes:summary>${cdata(dynamicFeedDesc)}</itunes:summary>
<itunes:author>${cdata(dynamicFeedAuthor)}</itunes:author>
<itunes:type>episodic</itunes:type>
<itunes:explicit>no</itunes:explicit>
<itunes:owner><itunes:name>${cdata(dynamicFeedAuthor)}</itunes:name><itunes:email>${DYNAMIC_EMAIL}</itunes:email></itunes:owner>
<itunes:image href="${channelCoverUrl}"/>
<image><url>${channelCoverUrl}</url><title>${cdata(dynamicFeedTitle)}</title><link>${SITE_URL}</link></image>
<itunes:category text="${DEFAULT_CONFIG.category}"><itunes:category text="${DEFAULT_CONFIG.subCategory}"/></itunes:category>
`;

    for (const post of results) {
      const audioUrl = `${SITE_URL}/podcast-audio/${post.KodeUnik}.mp3`;
      const postUrl = `${SITE_URL}/post/${post.KodeUnik}`;
      
      const seed = (post.KodeUnik || post.Judul) + identitySeed;

      const isMultiLang = (stringToHash(seed + "langType") % 100) < 50; 
      let awalan = isMultiLang ? spinTextStable(MULTI_LANG_PREFIX, seed + "prefix") : spinTextStable(SPINTAX_PREFIX, seed + "prefix");
      let akhiran = isMultiLang ? spinTextStable("{2025|2026|Full}", seed + "suffix") : spinTextStable(SPINTAX_SUFFIX, seed + "suffix");
      const finalTitle = `${awalan} ${post.Judul} ${akhiran}`;
      const rawDescText = stripTags(post.Deskripsi || "Listen to this audiobook.");

      // 1. Generate Backlink (Disimpan dulu)
      let pinterestPart = "";
      let tier2Part = "";
      const luckFactor = stringToHash(seed + "backlinkLuck") % 100;
      
      if (luckFactor < 70) {
          if (rawPinterestUrl) {
              pinterestPart = `<p>📌 ${spinTextStable(PINTEREST_INTRO, seed + "pintro")}: <a href="${rawPinterestUrl}">${spinTextStable(PINTEREST_ANCHOR, seed + "panchor")}</a></p>`;
          }
          if (rawTier2Url) {
              tier2Part = `<p>🎧 ${spinTextStable(TIER2_INTRO, seed + "tintro")} <strong><a href="${rawTier2Url}">${spinTextStable(TIER2_ANCHOR, seed + "tanchor")}</a></strong></p>`;
          }
      }

      // ============================================================
      // [FIX POSISI] PRIORITAS LINK DOWNLOAD
      // Urutan: Deskripsi -> Download -> Baru Backlink (Paling Bawah)
      // ============================================================
      
      // Untuk <content:encoded> (HTML Lengkap)
      const htmlContent = `
        <p>${post.Deskripsi || ""}</p>
        <hr/>
        <p><strong>Episode Info:</strong> ${post.Judul}</p>
        <p>⬇️ <strong>File Access:</strong> <a href="${postUrl}">Download ${post.Judul}</a></p>
        ${pinterestPart}
        ${tier2Part}
      `;
      
      // Untuk <description> (Teks Pendek + Link Penting)
      const descWithLinks = `${rawDescText.substring(0, 300)}... <br/>⬇️ <strong><a href="${postUrl}">Download Audio</a></strong><br/><br/>${pinterestPart}${tier2Part}`;
      // ============================================================

      let episodeImage = channelCoverUrl; 
      if (post.Image) {
        episodeImage = `${SITE_URL}/image-proxy?url=${encodeURIComponent(post.Image)}&amp;ext=.jpg`;
      }

      const dummySize = 3000000 + (stringToHash(seed + "size") % 5000000);
      const dummyDuration = 600 + (stringToHash(seed + "dur") % 1200);

      xml += `<item>
<title>${cdata(finalTitle)}</title>
<link>${postUrl}</link>
<guid isPermaLink="false">${post.KodeUnik}</guid>
<pubDate>${post.tangal ? new Date(post.tangal).toUTCString() : lastBuildDate}</pubDate>
<enclosure url="${audioUrl}" type="audio/mpeg" length="${dummySize}"/>
<description>${cdata(descWithLinks)}</description>
<content:encoded>${cdata(htmlContent)}</content:encoded>
<itunes:duration>${dummyDuration}</itunes:duration>
<itunes:explicit>no</itunes:explicit>
<itunes:image href="${episodeImage}"/>
<itunes:episodeType>full</itunes:episodeType>
</item>`;
    }

    xml += `</channel></rss>`;

    const finalString = xml.trim(); 
    const encoder = new TextEncoder();
    const data = encoder.encode(finalString);

    return new Response(data, {
      status: 200,
      headers: {
        "Content-Type": "application/rss+xml; charset=utf-8",
        "Cache-Control": "public, max-age=21600, s-maxage=21600, no-transform",
        "Content-Length": data.byteLength.toString(),
        "Access-Control-Allow-Origin": "*" 
      },
    });

  } catch (e) {
    return new Response(`Error: ${e.message}`, { status: 500 });
  }
}
