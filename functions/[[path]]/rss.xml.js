// Hardcode: /functions/[[path]]/rss.xml.js

const BLOG_TITLE = "EBOOK LIBRARY";
const BLOG_DESCRIPTION = "Download Free PDF Ebooks Best Seller";

// --- CONFIG: SPINTAX (CPA TARGET: TIER 1 COUNTRIES) ---
// Target: English, German, French, Spanish, Italian.
// (BAGIAN INI TIDAK DIUBAH SAMA SEKALI DARI FILE 1)

// Prefix Variations
const SPINTAX_PREFIX = `{Download|Get|Free|Read|Review|Grab} \
{PDF|Epub|Mobi|Audiobook|Kindle|Book} \
{Online|Directly|Instant|Fast}`;

const SPINTAX_SUFFIX = `{Full Version|Unabridged|Complete Edition|2026 Updated} \
{No Sign Up|Direct Link|High Speed|Free Account} \
{Best Seller|Trending|Viral|Must Read}`;

// Multi-language Variations
const MULTI_LANG_PREFIX = `{Download|Herunterladen (DE)|Télécharger (FR)|Descargar (ES)|Scarica (IT)} \
{Free|Kostenlos|Gratuit|Gratis} \
{PDF|Ebook|Livre|Libro}`;

// --- END CONFIG ---

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
 * Mengubah string menjadi angka integer (Hash).
 */
function stringToHash(string) {
  let hash = 0;
  if (string.length === 0) return hash;
  for (let i = 0; i < string.length; i++) {
    const char = string.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/**
 * Spintax Deterministik.
 */
function spinTextStable(text, seedStr) {
  return text.replace(/\{([^{}]+)\}/g, function (match, content) {
    const choices = content.split("|");
    const uniqueHash = stringToHash(seedStr + content);
    const index = uniqueHash % choices.length;
    return choices[index];
  });
}

export async function onRequestGet(context) {
  const { env, request, params } = context;
  const db = env.DB;

  try {
    const url = new URL(request.url);

    // ============================================================
    // 🚀 UPGRADE DARI FILE 2: DETEKSI SUBDOMAIN/ROUTER
    // ============================================================
    // Mengecek apakah request datang dari Router (misal: user.domain.com)
    const forwardedHost = request.headers.get("X-Forwarded-Host");
    
    // Jika ada header router, pakai itu. Jika tidak, pakai origin asli.
    const SITE_URL = forwardedHost 
      ? `${url.protocol}//${forwardedHost}` 
      : url.origin;
    // ============================================================

    const pathSegments = params.path || [];
    const kategori = pathSegments[0] || null;

    // Logika Query tetap dari File 1 (Limit 50 & Spintax friendly)
    const queryParams = [];
    let query =
      "SELECT Judul, Deskripsi, Image, KodeUnik, tangal FROM Buku WHERE tangal IS NOT NULL AND tangal <= DATE('now')";

    if (kategori) {
      query += " AND UPPER(Kategori) = UPPER(?)";
      queryParams.push(kategori);
    }
    
    // Tetap urutkan stabil agar RSS Reader senang
    query += " ORDER BY tangal DESC LIMIT 50"; 
    
    const stmt = db.prepare(query).bind(...queryParams);
    const { results } = await stmt.all();

    const feedTitle = kategori
      ? `${escapeXML(BLOG_TITLE)} - ${escapeXML(kategori)} Collection`
      : escapeXML(BLOG_TITLE);
      
    // 🚀 UPGRADE: Self Link harus mengikuti SITE_URL yang sudah dideteksi router
    const selfPath = url.pathname; 
    const selfLink = `${SITE_URL}${selfPath}`;

    let xml = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>${feedTitle}</title>
  <link>${SITE_URL}</link>
  <description>${escapeXML(BLOG_DESCRIPTION)}</description>
  <language>en-us</language>
  <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
  <atom:link href="${selfLink}" rel="self" type="application/rss+xml" />
`;

    for (const post of results) {
      // 🚀 UPGRADE: postUrl sekarang aman menggunakan domain router
      const postUrl = `${SITE_URL}/post/${post.KodeUnik}`;
      
      const judulAsli = escapeXML(post.Judul);
      const seed = post.KodeUnik || post.Judul; 

      // --- LOGIKA SPINTAX DETERMINISTIK (TETAP UTUH) ---
      const isMultiLang = (stringToHash(seed + "langType") % 100) < 50; 

      let awalan = "";
      let akhiran = "";

      if (isMultiLang) {
        awalan = spinTextStable(MULTI_LANG_PREFIX, seed + "prefix");
        akhiran = spinTextStable("{2025|2026|Full}", seed + "suffix"); 
      } else {
        awalan = spinTextStable(SPINTAX_PREFIX, seed + "prefix");
        akhiran = spinTextStable(SPINTAX_SUFFIX, seed + "suffix");
      }

      const judulBaru = `${awalan} ${judulAsli} ${akhiran}`;
      const ctaDesc = spinTextStable("{Click to Download|Get it Now|Read Online}", seed + "cta");

      let proxiedImageUrl = "";
      if (post.Image) {
        const encodedImageUrl = encodeURIComponent(post.Image);
        // 🚀 UPGRADE: Image Proxy juga aman menggunakan domain router
        proxiedImageUrl = `${SITE_URL}/image-proxy?url=${encodedImageUrl}`;
      }

      xml += `
  <item>
    <title>${escapeXML(judulBaru)}</title> 
    <link>${postUrl}</link>
    <guid isPermaLink="true">${postUrl}</guid>
    <g:id>${escapeXML(post.KodeUnik)}</g:id>
    <description><![CDATA[
      ${post.Deskripsi || "Summary not available."}<br/><br/> 
      <strong>${ctaDesc}</strong>: <a href="${postUrl}">${escapeXML(judulBaru)}</a>
    ]]></description>
    ${
      proxiedImageUrl
        ? `<g:image_link>${escapeXML(proxiedImageUrl)}</g:image_link>`
        : ""
    }
    <g:availability>in stock</g:availability>
    ${
      post.tangal
        ? `<pubDate>${new Date(post.tangal).toUTCString()}</pubDate>`
        : ""
    }
    </item>
`;
    }
    xml += `
</channel>
</rss>`;

    return new Response(xml, {
      headers: {
        "Content-Type": "application/rss+xml; charset=utf-8",
        "Cache-Control": "s-maxage=3600", 
      },
    });
  } catch (e) {
    return new Response(`Server error: ${e.message}`, {
      status: 500,
      headers: { "Content-Type": "text/plain" },
    });
  }
}
