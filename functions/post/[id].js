// Path: /functions/post/[id].js

// ==================================================================
// KONFIGURASI PENTING
// ==================================================================

// GANTI INI DENGAN URL WORKER REDIRECT KAMU
const CONST_ROUTER_URL = 'https://ads.cantikul.my.id'; 


// SPINTAX DESKRIPSI
const DESC_TEMPLATES = [
  "Read {TITLE} online for free. Download the full PDF or Epub version. High quality digital edition available now.",
  "Get the complete edition of {TITLE}. Instant access to the full book. No registration needed for preview.",
  "Full text archive: {TITLE}. Masterpiece collection. Download or stream the audiobook directly.",
  "Exclusive document: {TITLE}. View the secured content and download the complete file."
];

// ==================================================================
// HELPER FUNCTIONS
// ==================================================================
function stringToHash(string) {
  let hash = 0;
  if (!string) return hash;
  for (let i = 0; i < string.length; i++) {
    hash = ((hash << 5) - hash) + string.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash);
}

function getSpintaxDesc(title) {
  const hash = stringToHash(title || "Document");
  const template = DESC_TEMPLATES[hash % DESC_TEMPLATES.length];
  return template.replace("{TITLE}", title || "Document");
}

async function getPostFromDB(db, id) {
  const stmt = db.prepare("SELECT Judul, Image, Author, Kategori FROM Buku WHERE KodeUnik = ?").bind(id);
  const result = await stmt.first();
  return result;
}

// --- LOOPHOLE: Goodreads Redirect -> Amazon ASIN ---
async function getAmazonDataViaRedirect(id) {
  try {
    const url = `https://www.goodreads.com/book_link/follow/1?book_id=${id}&source=compareprices`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
      redirect: 'follow'
    });
    const finalUrl = response.url;
    const asinMatch = finalUrl.match(/\/(dp|gp\/product|d)\/([A-Z0-9]{10})/);
    if (asinMatch && asinMatch[2]) {
      const asin = asinMatch[2];
      return {
        found: true,
        image: `https://images-na.ssl-images-amazon.com/images/P/${asin}.01.LZZZZZZZ.jpg`,
        title: "Kindle Digital Edition"
      };
    }
  } catch (e) { }
  return { found: false };
}

// ==================================================================
// LOGIKA FALLBACK DATA
// ==================================================================
async function getDataFallback(id) {
  let data = {
    Judul: "Restricted Document", 
    Image: "", 
    Author: "Unknown Author",
    Kategori: "General",
    KodeUnik: id
  };

  try {
    // 1. AMAZON (Prefix A-)
    if (id.startsWith("A-") || /^B[A-Z0-9]{9}$/.test(id)) {
      const realId = id.startsWith("A-") ? id.substring(2) : id;
      data.Image = `https://images-na.ssl-images-amazon.com/images/P/${realId}.01.LZZZZZZZ.jpg`;
      data.Kategori = "Kindle Ebook";
      try {
        const resp = await fetch(`https://openlibrary.org/search.json?q=${realId}&fields=title,author_name`, { cf: { cacheTtl: 86400 } });
        const json = await resp.json();
        if (json.docs && json.docs.length > 0) {
            data.Judul = json.docs[0].title;
            if (json.docs[0].author_name) data.Author = json.docs[0].author_name[0];
        } else {
            data.Judul = "Kindle Secure Content";
        }
      } catch (err) { data.Judul = "Kindle Secure Content"; }
      return data;
    }

    // 2. ISBN (Prefix B-)
    if (id.startsWith("B-") || /^\d{9}[\d|X]$|^\d{13}$/.test(id.replace(/-/g,""))) {
      const realId = id.startsWith("B-") ? id.substring(2) : id;
      const cleanIsbn = realId.replace(/-/g,"");
      data.Image = `https://covers.openlibrary.org/b/isbn/${cleanIsbn}-L.jpg`;
      let foundTitle = false;
      try {
          const resp = await fetch(`https://openlibrary.org/isbn/${cleanIsbn}.json`, { cf: { cacheTtl: 86400 } });
          if (resp.ok) {
              const json = await resp.json();
              if (json.title) {
                  data.Judul = json.title;
                  foundTitle = true;
              }
          }
      } catch (e) {}
      if (!foundTitle) {
          const amzData = await getAmazonDataViaRedirect(cleanIsbn);
          if (amzData.found) {
              data.Image = amzData.image; 
              if (amzData.title !== "Kindle Digital Edition") data.Judul = amzData.title;
          } else {
              data.Judul = "Archived Document";
          }
      }
      return data;
    }

    // 3. GOODREADS (Prefix C-)
    if (id.startsWith("C-") || /^\d{1,9}$/.test(id)) {
      const realId = id.startsWith("C-") ? id.substring(2) : id;
      let foundData = false;
      try {
        const grResponse = await fetch(`https://www.goodreads.com/book/show/${realId}`, {
           headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1;)' }
        });
        if (grResponse.ok) {
          const html = await grResponse.text();
          const imgMatch = html.match(/<meta property="og:image" content="([^"]+)"/);
          const titleMatch = html.match(/<meta property="og:title" content="([^"]+)"/);
          if (imgMatch && imgMatch[1]) data.Image = imgMatch[1];
          if (titleMatch && titleMatch[1]) {
             data.Judul = titleMatch[1];
             foundData = true;
          }
        }
      } catch(e) {}
      if (!foundData) {
          const amzData = await getAmazonDataViaRedirect(realId);
          if (amzData.found) {
             data.Image = amzData.image; 
             if (data.Judul === "Restricted Document") data.Judul = "Goodreads Secure File"; 
          }
      }
      return data;
    }
  } catch (e) { console.log("Fallback Error:", e); }
  return data;
}

// ==================================================================
// RENDER HTML (DOUBLE MONETIZATION STRATEGY)
// ==================================================================
function renderFakeViewer(post, SITE_URL) {
  const metaDescription = getSpintaxDesc(post.Judul);
  
  let coverImage = post.Image || "";
  if (coverImage && coverImage.startsWith("http")) {
     coverImage = `${SITE_URL}/image-proxy?url=${encodeURIComponent(coverImage)}`;
  }

  const generatedDesc = `
    <p>Are you looking for <strong>${post.Judul}</strong>? 
    This is the perfect place to download or read it online. 
    Digital content provided by <em>${post.Author || 'Unknown Author'}</em>.</p>
    <p>This document belongs to the <strong>${post.Kategori || 'General'}</strong> category.</p>
    <p>Join our community to access the full document. Registration is free and takes less than 2 minutes.</p>
  `;

  const cssTextPattern = `background-image: repeating-linear-gradient(transparent, transparent 12px, #e5e5e5 13px, #e5e5e5 15px); background-size: 100% 100%;`;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>${post.Judul}</title>
    <meta name="description" content="${metaDescription}">
    <meta property="og:image" content="${coverImage || 'https://via.placeholder.com/300?text=Document'}" />
    <link href="https://fonts.googleapis.com/css?family=Mukta+Malar:400,600,800" rel="stylesheet">
    <style>
        * { box-sizing: border-box; }
        body { margin: 0; padding: 0; font-family: 'Mukta Malar', sans-serif; background-color: #525659; overflow: hidden; height: 100vh; }
        .navbar { height: 48px; background-color: #323639; display: flex; align-items: center; justify-content: space-between; padding: 0 10px; color: #f1f1f1; font-size: 14px; position: fixed; top: 0; width: 100%; z-index: 100; box-shadow: 0 2px 5px rgba(0,0,0,0.2); }
        .nav-title { font-weight: 600; color: #14AF64; text-transform: uppercase; letter-spacing: 0.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 60%; }
        .nav-right { display: flex; gap: 15px; align-items: center; }
        .nav-icon { width: 20px; height: 20px; fill: #ccc; cursor: pointer; }
        .main-container { display: flex; height: 100vh; padding-top: 48px; }
        .sidebar { width: 240px; background-color: #323639; border-right: 1px solid #444; overflow-y: hidden; display: flex; flex-direction: column; align-items: center; padding: 20px 0; flex-shrink: 0; }
        .thumb-page { width: 120px; height: 160px; background: white; margin-bottom: 20px; box-shadow: 0 2px 5px rgba(0,0,0,0.3); position: relative; overflow: hidden; opacity: 0.6; transition: 0.2s; cursor: pointer; }
        .thumb-page.active { border: 3px solid #14AF64; opacity: 1; }
        .text-pattern { width: 100%; height: 100%; padding: 10px; ${cssTextPattern} }
        .text-header { width: 60%; height: 8px; background: #ccc; margin-bottom: 15px; }
        .content-area { flex-grow: 1; background-color: #525659; overflow-y: auto; display: flex; justify-content: center; padding: 40px; position: relative; }
        .pdf-page { width: 100%; max-width: 800px; min-height: 1100px; background-color: white; box-shadow: 0 0 15px rgba(0,0,0,0.5); padding: 50px; display: flex; flex-direction: column; align-items: center; position: relative; margin-bottom: 20px; }
        .cover-wrapper { width: 100%; max-width: 400px; min-height: 550px; display: flex; justify-content: center; align-items: center; margin-bottom: 30px; position: relative; }
        .pdf-cover-img { width: 100%; height: auto; box-shadow: 0 10px 25px rgba(0,0,0,0.3); z-index: 2; }
        .fallback-cover { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: linear-gradient(135deg, #333 0%, #555 100%); display: flex; flex-direction: column; justify-content: center; align-items: center; color: white; text-align: center; padding: 20px; box-shadow: 0 10px 25px rgba(0,0,0,0.3); border: 2px solid #fff; }
        .fallback-title { font-size: 24px; font-weight: 800; margin-bottom: 10px; line-height: 1.3; }
        .fallback-sub { font-size: 14px; opacity: 0.8; text-transform: uppercase; letter-spacing: 1px; }
        .blurred-text-content { width: 100%; filter: blur(4px); opacity: 0.6; user-select: none; margin-top: 20px; }
        .b-line { height: 12px; background: #333; margin-bottom: 10px; width: 100%; opacity: 0.7; }
        .info-bar { position: absolute; top: 48px; left: 0; width: 100%; background: #fff; color: #333; padding: 10px 20px; font-size: 13px; border-bottom: 1px solid #ddd; z-index: 90; display: flex; align-items: center; gap: 10px; }
        .modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.85); z-index: 200; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(5px); }
        .modal-box { background: white; width: 90%; max-width: 450px; border-radius: 8px; overflow: hidden; animation: popIn 0.3s ease-out; box-shadow: 0 20px 50px rgba(0,0,0,0.5); }
        .modal-body { padding: 30px; text-align: center; }
        .modal-cover-wrapper { width: 120px; height: 180px; margin: 0 auto 20px auto; position: relative; }
        .modal-img { width: 100%; height: 100%; object-fit: cover; border-radius: 4px; box-shadow: 0 5px 15px rgba(0,0,0,0.2); }
        .modal-fallback { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: #eee; border: 1px solid #ddd; display: flex; align-items: center; justify-content: center; font-size: 30px; color: #aaa; border-radius: 4px; }
        .btn { display: block; width: 100%; padding: 15px; margin: 10px 0; font-weight: bold; text-transform: uppercase; border: none; border-radius: 4px; cursor: pointer; font-size: 16px; color: white; transition: 0.2s; }
        .btn-signup { background-color: #d9534f; }
        .btn-signup:hover { background-color: #c9302c; }
        .btn-download { background-color: #4285f4; }
        @keyframes popIn { from { transform: scale(0.9); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        @media (max-width: 768px) { .sidebar, .info-bar { display: none; } }
    </style>
</head>
<body>
    <nav class="navbar">
        <div class="nav-title">WWW.${new URL(SITE_URL).hostname.toUpperCase()}</div>
        <div class="nav-right">
            <span style="background:#000; padding:2px 8px; border-radius:4px; font-size:11px;">1 / 154</span>
            <svg class="nav-icon" viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
        </div>
    </nav>
    <div class="info-bar">
        <span>⚠️</span> <span>You are about to access "<strong>${post.Judul}</strong>". Available formats: PDF, TXT, ePub.</span>
    </div>
    <div class="main-container">
        <div class="sidebar">
            <div class="thumb-page active"><div class="text-pattern"><div class="text-header" style="background: #14AF64;"></div></div></div>
            <div class="thumb-page"><div class="text-pattern"><div class="text-header"></div></div></div>
            <div class="thumb-page"><div class="text-pattern"></div></div>
            <div class="thumb-page"><div class="text-pattern"><div class="text-header"></div></div></div>
            <div class="thumb-page"><div class="text-pattern"></div></div>
        </div>
        <div class="content-area">
            <div class="pdf-page">
                <div class="cover-wrapper">
                    <div id="fallback-cover-main" class="fallback-cover" style="display: ${coverImage ? 'none' : 'flex'};">
                        <div class="fallback-title">${post.Judul}</div>
                        <div class="fallback-sub">Protected Document</div>
                    </div>
                    ${coverImage ? `<img src="${coverImage}" class="pdf-cover-img" alt="${post.Judul}" onerror="this.style.display='none'; document.getElementById('fallback-cover-main').style.display='flex';">` : ''}
                </div>
                <h2 style="text-align:center; color:#333; margin-top:0;">Description</h2>
                <div style="color:#444; line-height:1.6; font-size:14px; margin-bottom:30px;">${generatedDesc}</div>
                <div class="blurred-text-content">
                    <div class="b-line" style="width: 100%"></div><div class="b-line" style="width: 90%"></div>
                    <div class="b-line" style="width: 95%"></div><div class="b-line" style="width: 85%"></div><br>
                    <div class="b-line" style="width: 100%"></div><div class="b-line" style="width: 92%"></div>
                </div>
            </div>
        </div>
    </div>
    <div class="modal-overlay">
        <div class="modal-box">
            <div class="modal-body">
                <h3 style="margin-top: 0; color: #333;">Registration Required</h3>
                <div class="modal-cover-wrapper">
                     <div id="fallback-cover-modal" class="modal-fallback" style="display: ${coverImage ? 'none' : 'flex'};">📖</div>
                     ${coverImage ? `<img src="${coverImage}" class="modal-img" onerror="this.style.display='none'; document.getElementById('fallback-cover-modal').style.display='flex';">` : ''}
                </div>
                <p style="color: #666; font-size: 14px; margin-bottom: 20px;">
                    You need a verified account to access:<br>
                    <strong style="font-size: 16px; color: #333; display:block; margin: 5px 0;">${post.Judul}</strong>
                    <span style="font-size: 13px;">Sign up takes less than 2 minutes.</span>
                </p>
                
                <button class="btn btn-signup" onclick="executeDoubleMoney()">Create Free Account</button>
                <button class="btn btn-download" onclick="executeDoubleMoney()">Download PDF</button>
            </div>
        </div>
    </div>

    <script>
        function executeDoubleMoney() {
            // URL Target
            var cpaUrl = '${CONST_ROUTER_URL}/offer';
            var adsteraUrl = '${CONST_ROUTER_URL}/download';
            
            // 1. EKSEKUSI 1: Buka CPA di Tab Baru (Prioritas Utama)
            // Ini akan otomatis mengambil alih fokus layar user
            var newTab = window.open(cpaUrl, '_blank');

            // 2. CEK STATUS POP-UP
            if (newTab) {
                // Skenario A: Pop-up BERHASIL (Browser mengizinkan)
                // User sekarang melihat CPA.
                // Tab lama (background) langsung kita ubah jadi Adsterra detik itu juga.
                // Tanpa setTimeout = Instant Redirect.
                window.location.href = adsteraUrl;
                
                // Opsional: Pastikan fokus tetap di tab baru (meski browser biasanya otomatis)
                newTab.focus();
            } else {
                // Skenario B: Pop-up DIBLOKIR Browser
                // BAHAYA! Jangan redirect ke Adsterra.
                // Kita harus selamatkan Lead CPA.
                // Paksa buka CPA di tab ini juga.
                window.location.href = cpaUrl;
            }
        }
    </script>
</body>
</html>
  `;
}

// ==================================================================
// HANDLER UTAMA (CACHE 1 TAHUN)
// ==================================================================
export async function onRequestGet(context) {
  const { env, params, request } = context; 
  const db = env.DB;
  const url = new URL(request.url);
  const cacheKey = new Request(url.toString(), request);
  const cache = caches.default;
  
  let response = await cache.match(cacheKey);
  if (response) { return response; }

  try {
    const SITE_URL = url.origin;
    const uniqueCode = params.id; 

    let post = await getPostFromDB(db, uniqueCode);
    if (!post) { post = await getDataFallback(uniqueCode); }

    const html = renderFakeViewer(post, SITE_URL);
    
    response = new Response(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html;charset=UTF-8",
        "Cache-Control": "public, max-age=31536000, s-maxage=31536000", 
      },
    });

    context.waitUntil(cache.put(cacheKey, response.clone()));
    return response;
  } catch (e) {
    return new Response(`Server error: ${e.message}`, { status: 500 });
  }
}
