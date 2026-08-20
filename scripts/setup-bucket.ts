/** Setup bucket Supabase Storage "produk": publik, maks 2 MB, hanya image/webp. */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRaw`
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES ('produk', 'produk', true, 2097152, ARRAY['image/webp']::text[])
    ON CONFLICT (id) DO UPDATE
      SET public = EXCLUDED.public,
          file_size_limit = EXCLUDED.file_size_limit,
          allowed_mime_types = EXCLUDED.allowed_mime_types`;
  const rows = await prisma.$queryRaw<
    { id: string; public: boolean; file_size_limit: bigint | null; allowed_mime_types: string[] | null }[]
  >`SELECT id, public, file_size_limit, allowed_mime_types FROM storage.buckets WHERE id = 'produk'`;
  for (const r of rows) {
    console.log(
      `✅ bucket "${r.id}" — public:${r.public} limit:${String(r.file_size_limit)} bytes mime:${(r.allowed_mime_types ?? []).join(",")}`
    );
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error("❌", e.message ?? e);
    prisma.$disconnect();
    process.exit(1);
  });
