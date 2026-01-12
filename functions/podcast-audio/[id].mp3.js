// Hardcode: /functions/podcast-audio/[id].mp3.js

const TOTAL_TRACKS = 1;

// [PERBAIKAN] Sesuaikan dengan lokasi aslimu di 'public/audio'
// Script akan mencari: /audio/track_001.mp3
const AUDIO_PATH_PREFIX = "/audio/track_"; 
const AUDIO_PATH_SUFFIX = ".mp3";

function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) & hash; 
  }
  return Math.abs(hash); 
}

export async function onRequest(context) {
  const { params, request } = context;
  const id = params.id || "default";

  // 1. Tentukan File Target
  const hash = simpleHash(id);
  const trackNumber = (hash % TOTAL_TRACKS) + 1; 
  const trackId = trackNumber.toString().padStart(3, "0");
  
  // Hasil Akhir: /audio/track_001.mp3
  const targetAudioUrl = `${AUDIO_PATH_PREFIX}${trackId}${AUDIO_PATH_SUFFIX}`;

  const url = new URL(request.url);
  const fullAudioUrl = new URL(targetAudioUrl, url.origin);

  // Helper fetch
  const fetchAudio = async (method) => {
    const requestHeaders = new Headers(request.headers);
    return await fetch(fullAudioUrl.href, {
      method: method,
      headers: requestHeaders
    });
  };

  try {
    // ============================================================
    // 🚀 HANDLE HEAD REQUEST (Validator Check)
    // ============================================================
    if (request.method === "HEAD") {
      const resp = await fetchAudio("HEAD");
      
      // Jika file fisik tidak ketemu di /audio/track_001.mp3
      if (!resp.ok) {
        // Kita return 404 polos agar validator tahu
        return new Response(null, { status: 404 });
      }

      const newHeaders = new Headers(resp.headers);
      newHeaders.set("Content-Type", "audio/mpeg");
      newHeaders.set("Accept-Ranges", "bytes");
      newHeaders.set("Access-Control-Allow-Origin", "*");
      
      return new Response(null, { status: resp.status, headers: newHeaders });
    }

    // ============================================================
    // 🚀 HANDLE GET REQUEST (Play/Download)
    // ============================================================
    const resp = await fetchAudio("GET");
    
    if (!resp.ok) {
      return new Response(
        `Error 404: File audio tidak ditemukan di '${targetAudioUrl}'.\nPastikan file 'track_001.mp3' ada di folder 'public/audio/'.`,
        { status: 404 }
      );
    }

    const newHeaders = new Headers(resp.headers);
    
    // Header Wajib untuk Podcast
    newHeaders.set("Content-Type", "audio/mpeg");
    newHeaders.set("Accept-Ranges", "bytes"); 
    newHeaders.set("Access-Control-Allow-Origin", "*");
    // No-Transform mencegah Cloudflare merusak encoding audio
    newHeaders.set("Cache-Control", "public, max-age=86400, no-transform"); 

    return new Response(resp.body, {
      status: resp.status,
      headers: newHeaders,
    });

  } catch (e) {
    return new Response(`Server Error: ${e.message}`, { status: 500 });
  }
}
