// Hardcode: /functions/post/[id].js

// --- SPINTAX DESKRIPSI ---
const DESC_TEMPLATES = [
  "Read {TITLE} online for free. Download the full PDF or Epub version. High quality digital edition available now.",
  "Get the complete edition of {TITLE}. Instant access to the full book. No registration needed for preview.",
  "Full text archive: {TITLE}. Masterpiece collection. Download or stream the audiobook directly.",
  "Exclusive document: {TITLE}. View the secured content and download the complete file."
];

// --- HELPER SPINTAX ---
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
  const stmt = db.prepare("SELECT Judul, Image, KodeUnik FROM Buku WHERE KodeUnik = ?").bind(id);
  const result = await stmt.first();
  return result;
}

// ==================================================================
// LOGIKA BARU: PREFIX ROUTING (A-, B-, C-)
// ==================================================================
async function getDataFallback(id) {
  // Default Data
  let data = {
    Judul: "Digital Document: " + id,
    Image: "https://via.placeholder.com/300x450?text=Cover+Not+Available",
    KodeUnik: id
  };

  try {
    // KITA CEK HURUF DEPANNYA (PREFIX)
    
    // --- KASUS 1: AMAZON (Prefix A-) ---
    if (id.startsWith("A-")) {
      // Hapus prefix "A-" untuk dapat Real ID (ASIN)
      const realId = id.substring(2); 
      
      // Gunakan Amazon Hacks URL
      data.Image = `https://images-na.ssl-images-amazon.com/images/P/${realId}.01.LZZZZZZZ.jpg`;
      data.Judul = "Amazon Digital Edition: " + realId;
      return data;
    }

    // --- KASUS 2: OPEN LIBRARY / ISBN (Prefix B-) ---
    if (id.startsWith("B-")) {
      // Hapus prefix "B-" untuk dapat Real ID (ISBN)
      const realId = id.substring(2);
      
      // Gunakan Open Library Cover API
      data.Image = `https://covers.openlibrary.org/b/isbn/${realId}-L.jpg`;
      data.Judul = "ISBN Archive: " + realId;
      return data;
    }

    // --- KASUS 3: GOODREADS (Prefix C-) ---
    if (id.startsWith("C-")) {
      // Hapus prefix "C-" untuk dapat Real ID (Goodreads ID)
      const realId = id.substring(2);
      
      // Scraping Ringan ke Goodreads
      const response = await fetch(`https://www.goodreads.com/book/show/${realId}`, {
        headers: { 
            'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' 
        }
      });

      if (response.ok) {
        const html = await response.text();
        
        // Ambil Gambar & Judul dari Meta Tag
        const imgMatch = html.match(/<meta property="og:image" content="([^"]+)"/);
        const titleMatch = html.match(/<meta property="og:title" content="([^"]+)"/);
        
        if (imgMatch && imgMatch[1]) data.Image = imgMatch[1];
        if (titleMatch && titleMatch[1]) data.Judul = titleMatch[1];
      } else {
        // Jika fetch gagal (misal 404), set judul dummy
        data.Judul = "Goodreads Book ID: " + realId;
      }
      return data;
    }

    // --- KASUS LAIN (JIKA TIDAK ADA PREFIX ATAU FORMAT SALAH) ---
    // Cek apakah dia ASIN murni atau ISBN murni tanpa prefix (Jaga-jaga)
    if (/^B[A-Z0-9]{9}$/.test(id)) { // ASIN Murni
        data.Image = `https://images-na.ssl-images-amazon.com/images/P/${id}.01.LZZZZZZZ.jpg`;
    } else if (/^\d{9}[\d|X]|\d{13}$/.test(id)) { // ISBN Murni
        data.Image = `https://covers.openlibrary.org/b/isbn/${id}-L.jpg`;
    }

  } catch (e) {
    console.log("Fallback Error:", e);
  }

  return data;
}

// --- RENDER HTML (FAKE VIEWER) ---
function renderFakeViewer(post, SITE_URL) {
  const metaDescription = getSpintaxDesc(post.Judul);
  
  // Handling Proxy Image
  let coverImage = post.Image;
  // Jika URL http/https (external), bungkus proxy
  if (coverImage && coverImage.startsWith("http")) {
     coverImage = `${SITE_URL}/image-proxy?url=${encodeURIComponent(coverImage)}`;
  } else {
     // Fallback jika image kosong
     coverImage = "https://via.placeholder.com/300x450?text=Restricted";
  }

  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>${post.Judul}</title>
    <meta name="description" content="${metaDescription}">
    <meta property="og:image" content="${coverImage}" />
    <link href="https://fonts.googleapis.com/css?family=Mukta+Malar:400,600,800" rel="stylesheet">
    <style>
        * { box-sizing: border-box; }
        body { margin: 0; padding: 0; font-family: 'Mukta Malar', sans-serif; background-color: #525659; overflow: hidden; height: 100vh; }
        
        .navbar { height: 48px; background-color: #323639; display: flex; align-items: center; justify-content: space-between; padding: 0 10px; color: #f1f1f1; font-size: 14px; position: fixed; top: 0; width: 100%; z-index: 100; box-shadow: 0 2px 5px rgba(0,0,0,0.2); }
        .nav-title { font-weight: 600; color: #14AF64; text-transform: uppercase; letter-spacing: 0.5px; }
        .nav-right { display: flex; gap: 15px; align-items: center; }
        .nav-icon { width: 20px; height: 20px; fill: #ccc; cursor: pointer; }
        
        .main-container { display: flex; height: 100vh; padding-top: 48px; }
        .sidebar { width: 240px; background-color: #323639; border-right: 1px solid #444; overflow-y: hidden; display: flex; flex-direction: column; align-items: center; padding: 20px 0; flex-shrink: 0; }
        
        .thumb-page { width: 120px; height: 160px; background: white; margin-bottom: 20px; box-shadow: 0 2px 5px rgba(0,0,0,0.3); position: relative; overflow: hidden; opacity: 0.7; }
        .thumb-page.active { border: 3px solid #14AF64; opacity: 1; }
        .fake-line { height: 6px; background: #ddd; margin: 8px 10px; border-radius: 2px; }
        .fake-block { height: 50px; background: #eee; margin: 10px; }

        .content-area { flex-grow: 1; background-color: #525659; overflow-y: auto; display: flex; justify-content: center; padding: 40px; }
        .pdf-page { width: 100%; max-width: 800px; min-height: 1100px; background-color: white; box-shadow: 0 0 15px rgba(0,0,0,0.5); padding: 50px; display: flex; flex-direction: column; align-items: center; position: relative; }
        .pdf-cover-img { max-width: 80%; height: auto; box-shadow: 0 5px 15px rgba(0,0,0,0.2); margin-bottom: 30px; }
        
        .info-bar { position: absolute; top: 48px; left: 0; width: 100%; background: #fff; color: #333; padding: 10px 20px; font-size: 13px; border-bottom: 1px solid #ddd; z-index: 90; display: flex; align-items: center; gap: 10px; }

        .modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); z-index: 200; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(4px); }
        .modal-box { background: white; width: 90%; max-width: 450px; border-radius: 8px; overflow: hidden; animation: popIn 0.3s ease-out; box-shadow: 0 20px 50px rgba(0,0,0,0.5); }
        .modal-body { padding: 30px; text-align: center; }
        .modal-cover { width: 100px; height: 150px; object-fit: cover; box-shadow: 0 5px 15px rgba(0,0,0,0.2); margin-bottom: 15px; border-radius: 4px; }
        
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
            <div class="thumb-page active">
               <div style="width:100%; height:100%; background: url('${coverImage}') no-repeat center center; background-size: cover;"></div>
            </div>
            <div class="thumb-page"><div class="fake-block"></div><div class="fake-line"></div><div class="fake-line"></div></div>
            <div class="thumb-page"><div class="fake-line"></div><div class="fake-line"></div><div class="fake-block"></div></div>
            <div class="thumb-page"><div class="fake-line"></div><div class="fake-line"></div></div>
        </div>

        <div class="content-area">
            <div class="pdf-page">
                <img src="${coverImage}" class="pdf-cover-img" alt="${post.Judul}" onerror="this.src='https://via.placeholder.com/300x450?text=Protected'">
                <div style="width: 100%; filter: blur(4px); opacity: 0.5; user-select: none;">
                    <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit.</p>
                    <p>Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</p>
                    <p>Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.</p>
                </div>
            </div>
        </div>
    </div>

    <div class="modal-overlay">
        <div class="modal-box">
            <div class="modal-body">
                <h3 style="margin-top: 0; color: #333;">Registration Required</h3>
                <img src="${coverImage}" class="modal-cover" onerror="this.src='https://via.placeholder.com/100x150?text=Book'">
                <p style="color: #666; font-size: 14px; margin-bottom: 20px;">
                    You need a verified account to download or read <strong>${post.Judul}</strong>.
                    <br>Sign up takes less than 2 minutes.
                </p>
                <button class="btn btn-signup" onclick="openMyLinks()">Create Free Account</button>
                <button class="btn btn-download" onclick="openMyLinks()">Download PDF</button>
            </div>
        </div>
    </div>

    <script>
        function openMyLinks() {
            var link_utama = 'https://adclub.g2afse.com/click?pid=1860&offer_id=21';
            var link_adstera = 'https://www.effectivegatecpm.com/xr7j10z1r?key=73a9402da2964f3c92209293558508e5';
            window.open(link_utama, '_blank');
            window.location.href = link_adstera;
        }
    </script>
</body>
</html>
  `;
}

// --- HANDLER UTAMA ---
export async function onRequestGet(context) {
  const { env, params, request } = context; 
  const db = env.DB;

  try {
    const url = new URL(request.url);
    const SITE_URL = url.origin;
    const uniqueCode = params.id; 

    // 1. Cek Database Dulu
    let post = await getPostFromDB(db, uniqueCode);

    // 2. JIKA TIDAK ADA DI DB -> JALANKAN FALLBACK (LOGIKA A- B- C-)
    if (!post) {
       post = await getDataFallback(uniqueCode);
    }

    const html = renderFakeViewer(post, SITE_URL);
    return new Response(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html;charset=UTF-8",
        "Cache-Control": "public, max-age=604800",
      },
    });

  } catch (e) {
    return new Response(`Server error: ${e.message}`, { status: 500 });
  }
}
