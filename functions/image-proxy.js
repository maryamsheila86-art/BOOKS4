// Hardcode: /functions/image-proxy.js

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const targetUrl = url.searchParams.get("url");

  if (!targetUrl) {
    return new Response("Missing URL parameter", { status: 400 });
  }

  try {
    // 1. Fetch gambar target
    // PENTING: redirect: "follow" ditambahkan. 
    // Ini memaksa Worker mengejar redirect Picsum sampai dapat file aslinya,
    // baru dikirim ke validator. Jadi validator terima beres (gambar jadi).
    const imageResponse = await fetch(targetUrl, {
      method: "GET",
      redirect: "follow", // <--- INI PNYELAMATNYA
      headers: {
        // Pura-pura jadi browser biar server gambar gak nolak
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
      }
    });

    if (!imageResponse.ok) {
      return new Response("Failed to fetch image", { status: 502 });
    }

    // 2. Siapkan Header Baru yang Bersih
    const newHeaders = new Headers(imageResponse.headers);

    // Hapus header sampah yang bisa bikin validator bingung
    newHeaders.delete("content-security-policy");
    newHeaders.delete("x-frame-options");
    
    // Tambah header wajib agar dianggap valid & aman
    newHeaders.set("Access-Control-Allow-Origin", "*");
    newHeaders.set("Cache-Control", "public, max-age=86400, s-maxage=86400");
    
    // Pastikan Content-Type valid (image/jpeg)
    // Kadang server asal ngasih type aneh, kita paksa jadi image kalau perlu
    const contentType = newHeaders.get("content-type");
    if (!contentType || !contentType.startsWith("image")) {
        newHeaders.set("Content-Type", "image/jpeg");
    }

    // 3. Kirim Gambar Final
    return new Response(imageResponse.body, {
      status: 200,
      headers: newHeaders
    });

  } catch (e) {
    return new Response(`Proxy Error: ${e.message}`, { status: 500 });
  }
}
