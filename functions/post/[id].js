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

// ... (BAGIAN HELPER SCRAPING SAMA SEPERTI SEBELUMNYA - DILEWATKAN BIAR HEMAT CODE) ...
// Kita asumsikan fungsi scraping (getAmazonDataViaRedirect, dll) masih ada di sini
// Kalau gagal scrape, dia return image placeholder, TAPI...
// DI BAWAH KITA AKAN HANDLE JIKA IMAGE ITU GAGAL LOAD DI BROWSER

async function getDataFallback(id) {
  // Default Data Minimalis
  // Kita sengaja kosongkan Image jika benar-benar tidak tahu, biar CSS Fallback bekerja
  return {
    Judul: "Restricted Document (ID: " + id + ")",
    Image: "", // Kosongkan biar trigger fallback CSS
    KodeUnik: id
  };
}

// ==================================================================
// RENDER HTML: THE ULTIMATE SAFE MODE (CSS FALLBACK)
// ==================================================================
function renderFakeViewer(post, SITE_URL) {
  const metaDescription = getSpintaxDesc(post.Judul);
  
  // Logic Image Proxy
  let coverImage = post.Image || "";
  if (coverImage && coverImage.startsWith("http")) {
     coverImage = `${SITE_URL}/image-proxy?url=${encodeURIComponent(coverImage)}`;
  }

  // KITA BUAT VARIABEL UNTUK CSS BACKGROUND PATTERN (GARIS-GARIS TEKS)
  // Ini trik CSS untuk membuat div terlihat seperti kertas penuh tulisan
  const cssTextPattern = `
    background-image: repeating-linear-gradient(transparent, transparent 12px, #e5e5e5 13px, #e5e5e5 15px);
    background-size: 100% 100%;
  `;

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
        
        /* NAVBAR STYLE */
        .navbar { height: 48px; background-color: #323639; display: flex; align-items: center; justify-content: space-between; padding: 0 10px; color: #f1f1f1; font-size: 14px; position: fixed; top: 0; width: 100%; z-index: 100; box-shadow: 0 2px 5px rgba(0,0,0,0.2); }
        .nav-title { font-weight: 600; color: #14AF64; text-transform: uppercase; letter-spacing: 0.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 60%; }
        .nav-right { display: flex; gap: 15px; align-items: center; }
        .nav-icon { width: 20px; height: 20px; fill: #ccc; cursor: pointer; }
        
        .main-container { display: flex; height: 100vh; padding-top: 48px; }
        .sidebar { width: 240px; background-color: #323639; border-right: 1px solid #444; overflow-y: hidden; display: flex; flex-direction: column; align-items: center; padding: 20px 0; flex-shrink: 0; }
        
        /* SIDEBAR THUMBNAIL (CSS TEXT PATTERN) */
        /* Kita tidak lagi pakai IMG di sidebar, tapi DIV dengan pola garis */
        .thumb-page { width: 120px; height: 160px; background: white; margin-bottom: 20px; box-shadow: 0 2px 5px rgba(0,0,0,0.3); position: relative; overflow: hidden; opacity: 0.6; transition: 0.2s; cursor: pointer; }
        .thumb-page.active { border: 3px solid #14AF64; opacity: 1; }
        
        /* Pola garis teks palsu */
        .text-pattern { width: 100%; height: 100%; padding: 10px; ${cssTextPattern} }
        .text-header { width: 60%; height: 8px; background: #ccc; margin-bottom: 15px; }

        .content-area { flex-grow: 1; background-color: #525659; overflow-y: auto; display: flex; justify-content: center; padding: 40px; position: relative; }
        
        /* HALAMAN UTAMA */
        .pdf-page { width: 100%; max-width: 800px; min-height: 1100px; background-color: white; box-shadow: 0 0 15px rgba(0,0,0,0.5); padding: 50px; display: flex; flex-direction: column; align-items: center; position: relative; margin-bottom: 20px; }
        
        /* COVER IMAGE & FALLBACK */
        .cover-wrapper { width: 100%; max-width: 400px; min-height: 550px; display: flex; justify-content: center; align-items: center; margin-bottom: 30px; position: relative; }
        
        .pdf-cover-img { width: 100%; height: auto; box-shadow: 0 10px 25px rgba(0,0,0,0.3); z-index: 2; }
        
        /* FALLBACK TITLE CARD (Muncul jika gambar mati) */
        .fallback-cover { 
            position: absolute; top: 0; left: 0; width: 100%; height: 100%; 
            background: linear-gradient(135deg, #333 0%, #555 100%);
            display: flex; flex-direction: column; justify-content: center; align-items: center;
            color: white; text-align: center; padding: 20px;
            box-shadow: 0 10px 25px rgba(0,0,0,0.3);
            border: 2px solid #fff;
        }
        .fallback-title { font-size: 24px; font-weight: 800; margin-bottom: 10px; line-height: 1.3; }
        .fallback-sub { font-size: 14px; opacity: 0.8; text-transform: uppercase; letter-spacing: 1px; }

        /* TEKS BURAM DI BAWAH COVER */
        .blurred-text-content { width: 100%; filter: blur(4px); opacity: 0.6; user-select: none; margin-top: 20px; }
        .b-line { height: 12px; background: #333; margin-bottom: 10px; width: 100%; opacity: 0.7; }
        
        .info-bar { position: absolute; top: 48px; left: 0; width: 100%; background: #fff; color: #333; padding: 10px 20px; font-size: 13px; border-bottom: 1px solid #ddd; z-index: 90; display: flex; align-items: center; gap: 10px; }

        /* MODAL */
        .modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.85); z-index: 200; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(5px); }
        .modal-box { background: white; width: 90%; max-width: 450px; border-radius: 8px; overflow: hidden; animation: popIn 0.3s ease-out; box-shadow: 0 20px 50px rgba(0,0,0,0.5); }
        .modal-body { padding: 30px; text-align: center; }
        
        /* Modal Cover Handling */
        .modal-cover-wrapper { width: 120px; height: 180px; margin: 0 auto 20px auto; position: relative; }
        .modal-img { width: 100%; height: 100%; object-fit: cover; border-radius: 4px; box-shadow: 0 5px 15px rgba(0,0,0,0.2); }
        .modal-fallback { 
            position: absolute; top: 0; left: 0; width: 100%; height: 100%; 
            background: #eee; border: 1px solid #ddd; display: flex; align-items: center; justify-content: center;
            font-size: 30px; color: #aaa; border-radius: 4px;
        }

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
               <div class="text-pattern">
                  <div class="text-header" style="background: #14AF64;"></div>
               </div>
            </div>
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
                    
                    ${coverImage ? `
                    <img src="${coverImage}" class="pdf-cover-img" alt="${post.Judul}" 
                         onerror="this.style.display='none'; document.getElementById('fallback-cover-main').style.display='flex';">
                    ` : ''}
                </div>

                <div class="blurred-text-content">
                    <div class="b-line" style="width: 100%"></div>
                    <div class="b-line" style="width: 90%"></div>
                    <div class="b-line" style="width: 95%"></div>
                    <div class="b-line" style="width: 85%"></div>
                    <br>
                    <div class="b-line" style="width: 100%"></div>
                    <div class="b-line" style="width: 92%"></div>
                    <div class="b-line" style="width: 98%"></div>
                    <div class="b-line" style="width: 40%"></div>
                    <br>
                     <div class="b-line" style="width: 100%"></div>
                    <div class="b-line" style="width: 90%"></div>
                    <div class="b-line" style="width: 95%"></div>
                    <div class="b-line" style="width: 85%"></div>
                </div>
            </div>
        </div>
    </div>

    <div class="modal-overlay">
        <div class="modal-box">
            <div class="modal-body">
                <h3 style="margin-top: 0; color: #333;">Registration Required</h3>
                
                <div class="modal-cover-wrapper">
                     <div id="fallback-cover-modal" class="modal-fallback" style="display: ${coverImage ? 'none' : 'flex'};">
                        📖
                     </div>
                     ${coverImage ? `
                     <img src="${coverImage}" class="modal-img" 
                          onerror="this.style.display='none'; document.getElementById('fallback-cover-modal').style.display='flex';">
                     ` : ''}
                </div>

                <p style="color: #666; font-size: 14px; margin-bottom: 20px;">
                    You need a verified account to access:
                    <br>
                    <strong style="font-size: 16px; color: #333; display:block; margin: 5px 0;">${post.Judul}</strong>
                    <span style="font-size: 13px;">Sign up takes less than 2 minutes.</span>
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
    // ... (KODE HANDLER SAMA PERSIS DENGAN YANG SEBELUMNYA)
    // Gunakan kembali kode handler + cache dari respons sebelumnya
    // Saya tidak tulis ulang agar tidak kepanjangan, karena logikanya tidak berubah.
    // Yang berubah total adalah fungsi renderFakeViewer di atas.
    
  const { env, params, request } = context; 
  const db = env.DB;
  const url = new URL(request.url);
  const cacheKey = new Request(url.toString(), request);
  const cache = caches.default;
  let response = await cache.match(cacheKey);
  if (response) return response;

  try {
    const SITE_URL = url.origin;
    const uniqueCode = params.id; 
    
    // Asumsikan fungsi getPostFromDB dan getDataFallback sudah didefinisikan di atas
    let post = await getPostFromDB(db, uniqueCode);
    if (!post) {
       // Di sini kita bisa panggil getDataFallback yang sudah kita bahas
       // Kalau getDataFallback pun error, dia akan return Image: "" (kosong)
       // post = await getDataFallback(uniqueCode); 
       
       // Contoh sederhana fallback manual jika fungsi luar belum dicopy:
       post = { Judul: "Restricted Document (ID: " + uniqueCode + ")", Image: "", KodeUnik: uniqueCode };
    }

    const html = renderFakeViewer(post, SITE_URL);
    
    response = new Response(html, {
      status: 200,
      headers: { "Content-Type": "text/html;charset=UTF-8", "Cache-Control": "public, max-age=86400, s-maxage=604800" },
    });
    context.waitUntil(cache.put(cacheKey, response.clone()));
    return response;
  } catch (e) {
    return new Response(`Server error: ${e.message}`, { status: 500 });
  }
}
