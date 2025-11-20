// File: bulk-insert.js
// Pastikan nama file ini 'data.json'
import data from './data.json'; 

const CHUNK_SIZE = 1000;

export default {
  async fetch(request, env) {
    
    // --- INI SOLUSINYA ---
    const url = new URL(request.url);
    if (url.pathname !== '/') {
      // Jika ini request untuk /favicon.ico atau lainnya, abaikan.
      return new Response('Ignored (favicon.ico)', { status: 404 });
    }
    // --- AKHIR SOLUSI ---

    const db = env.DB; 
    const stmt = db.prepare(
      `INSERT INTO Buku (Judul, Deskripsi, Author, Image, Kategori, KodeUnik, tangal, pv) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );

    console.log(`(REQUEST UTAMA) Total data untuk diimpor: ${data.length} baris.`);
    let totalInserted = 0;

    for (let i = 0; i < data.length; i += CHUNK_SIZE) {
      const chunk = data.slice(i, i + CHUNK_SIZE);
      const chunkNumber = Math.floor(i / CHUNK_SIZE) + 1;
      
      console.log(`Mempersiapkan chunk ${chunkNumber} (Ukuran: ${chunk.length} baris)`);

      const statements = chunk.map(item =>
        stmt.bind(
          item.Judul, item.Deskripsi, item.Author, item.Image,
          item.Kategori, item.KodeUnik, item.tangal, item.pv
        )
      );

      console.log(`Mengirim chunk ${chunkNumber}...`);
      try {
        await db.batch(statements);
        totalInserted += chunk.length;
        console.log(`Chunk ${chunkNumber} berhasil. Total baris dimasukkan: ${totalInserted}`);
      } catch (e) {
        console.error(`Gagal pada chunk ${chunkNumber}:`, e.message);
        return new Response(`Gagal pada chunk: ${e.message}`, { status: 500 });
      }
    }
    
    return new Response(`(REQUEST UTAMA) Proses batch selesai. Total ${totalInserted} baris dimasukkan.`);
  }
}