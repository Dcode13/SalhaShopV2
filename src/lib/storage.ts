import "server-only";

/**
 * Supabase Storage (bucket "produk") via REST API — tanpa dependensi tambahan.
 * Endpoint S3 project (…/storage/v1/s3) dilayani backend yang sama; di sini
 * dipakai jalur REST-nya (…/storage/v1/object/…) karena cukup satu kredensial:
 * SUPABASE_SERVICE_ROLE_KEY (server-only, tidak pernah sampai ke browser).
 */

const BUCKET = "produk";

function baseUrl(): string {
  return (process.env.SUPABASE_STORAGE_URL ?? "").replace(/\/+$/, "").replace(/\/s3$/, "");
}

function serviceKey(): string {
  return process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
}

export function storageConfigured(): boolean {
  return baseUrl().length > 0 && serviceKey().length > 0;
}

function authHeaders(): Record<string, string> {
  const key = serviceKey();
  return { Authorization: `Bearer ${key}`, apikey: key };
}

export function publicImageUrl(path: string): string {
  return `${baseUrl()}/object/public/${BUCKET}/${path}`;
}

export async function uploadImage(path: string, bytes: ArrayBuffer, contentType: string): Promise<void> {
  const res = await fetch(`${baseUrl()}/object/${BUCKET}/${path}`, {
    method: "POST",
    headers: {
      ...authHeaders(),
      "Content-Type": contentType,
      "x-upsert": "true",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
    body: bytes,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Upload ke storage gagal (${res.status}): ${text.slice(0, 200)}`);
  }
}

/** Hapus foto utama + thumbnail dari public URL-nya. Best-effort (gagal diabaikan). */
export async function deleteByPublicUrl(url: string): Promise<void> {
  if (!storageConfigured()) return;
  const marker = `/object/public/${BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx < 0) return;
  const mainPath = url.slice(idx + marker.length).split("?")[0];
  const paths = [...new Set([mainPath, mainPath.replace(/\.webp$/, "_thumb.webp")])];
  await Promise.all(
    paths.map(async (p) => {
      try {
        await fetch(`${baseUrl()}/object/${BUCKET}/${p}`, { method: "DELETE", headers: authHeaders() });
      } catch (e) {
        console.error("Gagal hapus file storage:", p, e);
      }
    })
  );
}
