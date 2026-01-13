// Hardcode: /functions/post/[id].js

// --- KONFIGURASI SPINTAX DESKRIPSI (Untuk Meta Tag SEO) ---
// Karena database "Diet" tidak punya deskripsi, kita generate on-the-fly.
const DESC_TEMPLATES = [
  "Read {TITLE} online for free. Download the full PDF or Epub version. High quality digital edition available now.",
  "Get the complete edition of {TITLE}. Instant access to the full book. No registration needed for preview.",
  "Looking for {TITLE}? Start reading the full version now. Available in PDF, EPUB, and MOBI formats.",
  "Full text archive: {TITLE}. Masterpiece collection. Download or stream the audiobook directly.",
  "Exclusive document: {TITLE}. View the secured content and download the complete file."
];

// --- FUNGSI HELPER ---
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
  const hash = stringToHash(title);
  const template = DESC_TEMPLATES[hash % DESC_TEMPLATES.length];
  return template.replace("{TITLE}", title);
}

async function getPost(db, id) {
  // Kita cuma butuh Judul dan Image. Hemat reads & storage!
  const stmt = db.prepare("SELECT Judul, Image, KodeUnik FROM Buku WHERE KodeUnik = ?").bind(id);
  const result = await stmt.first();
  return result;
}

// --- TEMPLATE UTAMA (FAKE PDF VIEWER) ---
function renderFakeViewer(post, SITE_URL) {
  const metaDescription = getSpintaxDesc(post.Judul);
  
  // Gambar Proxy (Agar tidak kena mixed content / hotlink protection)
  let coverImage = "https://via.placeholder.com/300x450?text=Cover+Not+Found";
  if (post.Image) {
    coverImage = `${SITE_URL}/image-proxy?url=${encodeURIComponent(post.Image)}`;
  }

  // Generate Thumbnail Dummy (Untuk Sidebar)
  // Kita pakai gambar cover yang sama tapi di-blur atau dimurahkan
  const sidebarThumb = coverImage; 

  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>Read: ${post.Judul} - Secure PDF Viewer</title>
    <meta name="description" content="${metaDescription}">
    
    <meta property="og:type" content="book" />
    <meta property="og:title" content="${post.Judul}" />
    <meta property="og:description" content="${metaDescription}" />
    <meta property="og:image" content="${coverImage}" />
    
    <link href="https://fonts.googleapis.com/css?family=Mukta+Malar:400,600,800" rel="stylesheet">
    <style>
        /* CSS RESET & PDF VIEWER STYLE */
        * { box-sizing: border-box; }
        body { margin: 0; padding: 0; font-family: 'Mukta Malar', sans-serif; background-color: #525659; overflow: hidden; height: 100vh; }
        
        /* TOP BAR */
        .navbar { height: 48px; background-color: #323639; display: flex; align-items: center; justify-content: space-between; padding: 0 10px; box-shadow: 0 2px 5px rgba(0,0,0,0.2); color: #f1f1f1; font-size: 14px; position: fixed; top: 0; width: 100%; z-index: 100; }
        .nav-left, .nav-right { display: flex; align-items: center; gap: 15px; }
        .nav-title { font-weight: 600; color: #14AF64; text-transform: uppercase; letter-spacing: 0.5px; }
        .nav-icon { width: 24px; height: 24px; fill: #e0e0e0; cursor: pointer; opacity: 0.8; }
        .nav-icon:hover { opacity: 1; }
        .page-counter { background: #000; padding: 2px 8px; border-radius: 4px; font-size: 12px; }

        /* MAIN LAYOUT */
        .main-container { display: flex; height: 100vh; padding-top: 48px; }
        
        /* SIDEBAR THUMBNAILS */
        .sidebar { width: 220px; background-color: #323639; border-right: 1px solid #444; overflow-y: hidden; display: flex; flex-direction: column; align-items: center; padding-top: 20px; flex-shrink: 0; }
        .thumb-ring { margin-bottom: 20px; padding: 5px; border-radius: 4px; transition: 0.2s; cursor: pointer; opacity: 0.6; }
        .thumb-ring.active { border: 2px solid #14AF64; opacity: 1; }
        .thumb-img { width: 100px; height: 140px; object-fit: cover; box-shadow: 0 4px 8px rgba(0,0,0,0.3); background: white; }
        
        /* CONTENT AREA */
        .content-area { flex-grow: 1; background-color: #525659; overflow-y: auto; display: flex; justify-content: center; position: relative; padding: 30px; }
        .pdf-page { width: 100%; max-width: 800px; height: auto; min-height: 1100px; background-color: white; box-shadow: 0 0 10px rgba(0,0,0,0.5); padding: 0; position: relative; margin-bottom: 30px; }
        .pdf-image { width: 100%; height: auto; display: block; }
        
        /* INFO BAR */
        .info-bar { position: absolute; top: 48px; left: 0; width: 100%; background: #fff; color: #333; padding: 8px 20px; font-size: 13px; border-bottom: 1px solid #ddd; z-index: 90; display: flex; align-items: center; }
        .info-icon { margin-right: 8px; color: #f0ad4e; font-size: 16px; }

        /* MODAL POPUP */
        .modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); z-index: 200; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(2px); }
        .modal-box { background: white; width: 100%; max-width: 550px; border-radius: 6px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); overflow: hidden; animation: popIn 0.3s ease-out; position: relative; }
        .modal-body { padding: 30px; text-align: center; }
        .modal-cover { width: 120px; height: 180px; object-fit: cover; box-shadow: 0 5px 15px rgba(0,0,0,0.2); margin-bottom: 20px; }
        .modal-title { font-size: 20px; font-weight: 700; color: #333; margin-bottom: 10px; }
        .modal-text { font-size: 14px; color: #666; margin-bottom: 25px; line-height: 1.5; }
        
        /* BUTTONS */
        .btn { display: inline-block; padding: 12px 30px; font-size: 16px; font-weight: 600; text-transform: uppercase; border-radius: 4px; cursor: pointer; text-decoration: none; transition: 0.2s; border: none; width: 100%; margin-bottom: 10px; }
        .btn-red { background-color: #d9534f; color: white; }
        .btn-red:hover { background-color: #c9302c; }
        .btn-blue { background-color: #4285f4; color: white; }
        
        /* STATS */
        .stats { display: flex; justify-content: center; gap: 15px; margin-top: 15px; font-size: 12px; color: #777; }
        .stat-item { display: flex; align-items: center; gap: 5px; }

        @keyframes popIn { from { transform: scale(0.9); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        
        /* RESPONSIVE */
        @media (max-width: 768px) {
            .sidebar { display: none; }
            .info-bar { display: none; }
            .modal-box { width: 90%; }
        }
    </style>
</head>
<body>

    <nav class="navbar">
        <div class="nav-left">
            <strong class="nav-title">WWW.${new URL(SITE_URL).hostname.toUpperCase()}</strong>
        </div>
        <div class="nav-right">
            <span class="page-counter">2 / 74</span>
            <svg class="nav-icon" viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg> <svg class="nav-icon" viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg> <svg class="nav-icon" viewBox="0 0 24 24"><path d="M19 3h-4.18C14.4 1.84 13.3 1 12 1c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm2 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/></svg> </div>
    </nav>

    <div class="info-bar">
        <span class="info-icon">⚠️</span> 
        <span>You are about to access "<strong>${post.Judul}</strong>". This document is available to read and download in PDF, TXT, ePub format.</span>
    </div>

    <div class="main-container">
        <div class="sidebar">
            <div class="thumb-ring active"><img src="${sidebarThumb}" class="thumb-img"></div>
            <div class="thumb-ring"><img src="${sidebarThumb}" class="thumb-img" style="filter: blur(1px);"></div>
            <div class="thumb-ring"><img src="${sidebarThumb}" class="thumb-img" style="filter: blur(2px);"></div>
            <div class="thumb-ring"><img src="${sidebarThumb}" class="thumb-img" style="filter: blur(2px);"></div>
        </div>

        <div class="content-area">
            <div class="pdf-page">
                <img src="${coverImage}" class="pdf-image" alt="${post.Judul}">
            </div>
        </div>
    </div>

    <div class="modal-overlay">
        <div class="modal-box">
            <div class="modal-body">
                <h2 class="modal-title">You Must be a Registered User to Access This Book</h2>
                
                <img src="${coverImage}" class="modal-cover" alt="Book Cover">
                
                <p class="modal-text">
                    Don't have an account yet?<br>
                    Sign up now! It only takes <strong><u>2 minutes</u></strong> to sign up.
                </p>

                <button class="btn btn-red" onclick="openMyLinks()">Sign Up Free</button>
                <button class="btn btn-blue" onclick="openMyLinks()">Download PDF</button>

                <div class="stats">
                    <span class="stat-item">⬇️ DOWNLOAD Unlimited Books</span>
                    <span class="stat-item">👥 Join Over 581,222 Happy Readers</span>
                </div>
            </div>
        </div>
    </div>

    <script>
        // SCRIPT AFFILIATE (Sama seperti sebelumnya)
        function openMyLinks() {
            // GANTI LINK INI DENGAN LINK AFFILIATE KAMU
            var link_utama = 'https://adclub.g2afse.com/click?pid=1860&offer_id=21';
            var link_adstera = 'https://www.effectivegatecpm.com/xr7j10z1r?key=73a9402da2964f3c92209293558508e5';
            
            // Buka tab baru ke offer utama
            window.open(link_utama, '_blank');
            // Redirect halaman ini ke direct link (Adsterra/Lainnya)
            window.location.href = link_adstera;
        }

        // Auto redirect after few seconds (Optional - Biar agresif)
        // setTimeout(openMyLinks, 120000); 
    </script>
</body>
</html>
  `;
}

// --- HANDLER WORKER ---
export async function onRequestGet(context) {
  const { env, params, request } = context; 
  const db = env.DB;

  try {
    const url = new URL(request.url);
    const SITE_URL = url.origin;
    const uniqueCode = params.id; 

    // Ambil data buku (Judul & Image saja)
    const post = await getPost(db, uniqueCode);

    // Jika data tidak ada, kita bisa tampilkan 404 atau
    // Tampilkan fake page dengan data dummy (agar traffic tidak bocor)
    if (!post) {
       const dummyPost = {
         Judul: "Document Protected",
         Image: "", 
         KodeUnik: "000"
       };
       return new Response(renderFakeViewer(dummyPost, SITE_URL), { 
         headers: { "Content-Type": "text/html;charset=UTF-8" }
       });
    }

    // Render Halaman
    const html = renderFakeViewer(post, SITE_URL);
    return new Response(html, {
      headers: {
        "Content-Type": "text/html;charset=UTF-8",
        // Cache 1 jam agar hemat database read
        "Cache-Control": "public, max-age=3600",
      },
    });

  } catch (e) {
    return new Response(`Server error: ${e.message}`, { status: 500 });
  }
}
