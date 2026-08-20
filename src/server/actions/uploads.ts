"use server";

import { requireOwner } from "@/lib/auth";
import { deleteByPublicUrl, publicImageUrl, storageConfigured, uploadImage } from "@/lib/storage";

const MAX_MAIN = 2 * 1024 * 1024; // 2 MB (sinkron dgn limit bucket)
const MAX_THUMB = 512 * 1024;

/** Validasi magic bytes WebP: "RIFF" …… "WEBP" — jangan percaya Content-Type dari client. */
function isWebp(buf: ArrayBuffer): boolean {
  const b = new Uint8Array(buf);
  return (
    b.length > 12 &&
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50
  );
}

export type UploadImageResult = { ok: true; url: string } | { ok: false; error: string };

/** Terima foto produk (sudah dikompres+WebP di browser), simpan ke Supabase Storage. */
export async function uploadProductImage(formData: FormData): Promise<UploadImageResult> {
  await requireOwner();
  if (!storageConfigured()) {
    return {
      ok: false,
      error: "Upload foto belum aktif — isi SUPABASE_SERVICE_ROLE_KEY di .env (lihat README).",
    };
  }

  const file = formData.get("file");
  const thumb = formData.get("thumb");
  if (!(file instanceof File) || !(thumb instanceof File)) {
    return { ok: false, error: "File tidak ditemukan." };
  }
  if (file.size > MAX_MAIN) return { ok: false, error: "Ukuran foto melebihi 2 MB setelah kompresi." };
  if (thumb.size > MAX_THUMB) return { ok: false, error: "Thumbnail terlalu besar." };

  const [mainBuf, thumbBuf] = await Promise.all([file.arrayBuffer(), thumb.arrayBuffer()]);
  if (!isWebp(mainBuf) || !isWebp(thumbBuf)) {
    return { ok: false, error: "File harus berformat WebP (konversi otomatis gagal — gunakan Chrome/Edge)." };
  }

  const id = crypto.randomUUID();
  try {
    await uploadImage(`${id}.webp`, mainBuf, "image/webp");
    await uploadImage(`${id}_thumb.webp`, thumbBuf, "image/webp");
  } catch (e) {
    console.error("uploadProductImage gagal:", e);
    return { ok: false, error: e instanceof Error ? e.message : "Upload gagal." };
  }
  return { ok: true, url: publicImageUrl(`${id}.webp`) };
}

/** Hapus foto yang baru diunggah tapi batal dipakai (dipanggil dari form). */
export async function removeProductImage(url: string): Promise<{ ok: boolean }> {
  await requireOwner();
  await deleteByPublicUrl(url);
  return { ok: true };
}
