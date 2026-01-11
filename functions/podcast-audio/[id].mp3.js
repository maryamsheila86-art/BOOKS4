// Hardcode: /functions/podcast-audio/[id].mp3.js

// --- [SETTING PENTING] ---
// Tetap sesuai kode kamu sebelumnya
const TOTAL_TRACKS = 1;
const AUDIO_PATH_PREFIX = "/audio/track_";
const AUDIO_PATH_SUFFIX = ".mp3";
// -------------------------

/**
 * Simple hash function
 */
function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; 
  }
  return Math.abs(hash); 
}

/**
 * Main handler (Ganti jadi onRequest agar bisa handle GET dan HEAD)
 */
export async function onRequest(context) {
  const { params, request } = context;
  const id = params.id;

  // Fallback ID jika parameter kosong
  if (!id) {
    return new Response("Not found", { status: 404 });
  }

  // 1. Logika Hash & Path (TETAP SAMA SEPERTI KODEMU)
  const hash = simpleHash(id);
  const trackNumber = (hash % TOTAL_TRACKS) + 1; 
  const trackId = trackNumber.toString().padStart(3, "0"); 
  
  // URL Target: /audio/track_001.mp3
  const targetAudioUrl = `${AUDIO_PATH_PREFIX}${trackId}${AUDIO_PATH_SUFFIX}`;

  const url = new URL(request.url);
  const fullAudioUrl = new URL(targetAudioUrl, url.origin);

  // ============================================================
  // 🚀 [NEW] BAGIAN KHUSUS UNTUK SOUNDON (HEAD REQUEST)
  // SoundOn mengecek file ini ada atau tidak tanpa mendownload isinya.
  // ============================================================
  if (request.method === "HEAD") {
    try {
      // Kita "ping" file aslinya (track_001.mp3)
      const originalHeadResponse = await fetch(fullAudioUrl.href, { method: "HEAD" });
      
      // Kembalikan status & header file asli ke SoundOn
      return new Response(null, {
        status: originalHeadResponse.status,
        headers: originalHeadResponse.headers
      });
    } catch (e) {
      // Jika error saat cek file asli
      return new Response(null, { status: 404 });
    }
  }
  // ============================================================

  // 2. Logika GET (Download/Play Audio) - TETAP SAMA
  try {
    const response = await fetch(fullAudioUrl.href);

    if (!response.ok) {
      return new Response(
        `File not found: ${targetAudioUrl}. Pastikan file 'track_001.mp3' ada di folder '/audio/'`,
        { status: 404 }
      );
    }

    const newHeaders = new Headers(response.headers);
    // Tambahan: Access-Control agar bisa diputar di player luar
    newHeaders.set("Access-Control-Allow-Origin", "*");
    newHeaders.set("Cache-Control", "public, s-maxage=86400, max-age=86400");

    return new Response(response.body, {
      status: 200,
      headers: newHeaders,
    });
  } catch (e) {
    return new Response(`Error fetching audio: ${e.message}`, { status: 500 });
  }
}
