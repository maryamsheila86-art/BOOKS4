// Hardcode: /functions/podcast-audio/[id].mp3.js

const TOTAL_TRACKS = 1;
const AUDIO_PATH_PREFIX = "/podcast-audio/track_"; 
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

  // 1. Tentukan URL Fisik
  const hash = simpleHash(id);
  const trackNumber = (hash % TOTAL_TRACKS) + 1; 
  const trackId = trackNumber.toString().padStart(3, "0");
  const targetAudioUrl = `${AUDIO_PATH_PREFIX}${trackId}${AUDIO_PATH_SUFFIX}`;

  const url = new URL(request.url);
  const fullAudioUrl = new URL(targetAudioUrl, url.origin);

  const fetchAudio = async (method) => {
    const requestHeaders = new Headers(request.headers);
    return await fetch(fullAudioUrl.href, {
      method: method,
      headers: requestHeaders
    });
  };

  try {
    // HEAD Request (Validator Check)
    if (request.method === "HEAD") {
      const resp = await fetchAudio("HEAD");
      if (!resp.ok) return new Response(null, { status: 404 });

      const newHeaders = new Headers(resp.headers);
      // 🔥 FIX FATAL ERROR CONTENT TYPE
      newHeaders.set("Content-Type", "audio/mpeg"); 
      newHeaders.set("Accept-Ranges", "bytes");
      newHeaders.set("Access-Control-Allow-Origin", "*");
      
      return new Response(null, { status: resp.status, headers: newHeaders });
    }

    // GET Request
    const resp = await fetchAudio("GET");
    if (!resp.ok) return new Response(`File not found: ${targetAudioUrl}`, { status: 404 });

    const newHeaders = new Headers(resp.headers);
    
    // 🔥 FIX FATAL ERROR CONTENT TYPE
    // Kita timpa apapun balasan server dengan audio/mpeg yang valid
    newHeaders.set("Content-Type", "audio/mpeg"); 
    newHeaders.set("Accept-Ranges", "bytes");
    newHeaders.set("Access-Control-Allow-Origin", "*");
    
    // 🔥 PENTING: NO-TRANSFORM
    // Mencegah Cloudflare melakukan GZIP/Brotli pada file MP3 yang merusak validasi
    newHeaders.set("Cache-Control", "public, max-age=86400, no-transform"); 

    return new Response(resp.body, {
      status: resp.status,
      headers: newHeaders,
    });

  } catch (e) {
    return new Response(`Error: ${e.message}`, { status: 500 });
  }
}
