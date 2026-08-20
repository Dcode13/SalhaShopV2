/**
 * Kompresi & konversi foto produk DI BROWSER (canvas):
 *  - resize maks 1024px (utama) + 192px (thumbnail)
 *  - konversi JPG/JPEG/PNG → WebP
 *  - jamin ukuran akhir < 2 MB (turunkan kualitas bertahap bila perlu)
 * Tanpa dependensi server — aman untuk Vercel serverless.
 */

export type CompressedImages = { main: Blob; thumb: Blob };

const MAX_BYTES = 2 * 1024 * 1024; // 2 MB

async function toCanvas(file: File, maxDim: number): Promise<HTMLCanvasElement> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" }); // hormati rotasi EXIF
  } catch {
    bitmap = await createImageBitmap(file);
  }
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("Canvas tidak tersedia di browser ini.");
  }
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  return canvas;
}

function encodeWebp(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Gagal mengenkode gambar."))),
      "image/webp",
      quality
    );
  });
}

export async function compressToWebp(file: File): Promise<CompressedImages> {
  if (!/^image\/(png|jpe?g|webp)$/i.test(file.type)) {
    throw new Error("Format foto harus JPG, JPEG, PNG, atau WebP.");
  }

  const mainCanvas = await toCanvas(file, 1024);
  let main: Blob | null = null;
  for (const quality of [0.82, 0.7, 0.55, 0.4]) {
    const blob = await encodeWebp(mainCanvas, quality);
    if (blob.type !== "image/webp") {
      // Safari lama tidak bisa ekspor WebP dari canvas
      throw new Error("Browser ini tidak mendukung konversi WebP — gunakan Chrome atau Edge.");
    }
    if (blob.size <= MAX_BYTES) {
      main = blob;
      break;
    }
  }
  if (!main) throw new Error("Foto tetap melebihi 2 MB setelah dikompres. Coba foto lain.");

  const thumbCanvas = await toCanvas(file, 192);
  const thumb = await encodeWebp(thumbCanvas, 0.75);

  return { main, thumb };
}
