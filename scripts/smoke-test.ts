/** Smoke test koneksi Supabase + query kritis (dijalankan dgn tsx dari folder proyek). */
import { PrismaClient, Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // 1. Koneksi + isi data
  const [outlets, users, products, inventories, prices, movements] = await Promise.all([
    prisma.outlet.count(),
    prisma.user.count(),
    prisma.product.count(),
    prisma.inventory.count(),
    prisma.productPrice.count(),
    prisma.stockMovement.count(),
  ]);
  console.log(`✅ Koneksi OK — outlet:${outlets} user:${users} produk:${products} inventori:${inventories} harga:${prices} movement:${movements}`);

  // 2. Verifikasi password owner (bcrypt)
  const owner = await prisma.user.findUnique({ where: { email: "owner@salhashop.id" } });
  if (!owner?.passwordHash || !bcrypt.compareSync("owner123", owner.passwordHash)) {
    throw new Error("Password owner tidak cocok!");
  }
  console.log("✅ Login owner terverifikasi (bcrypt cocok)");

  // 3. SQL agregasi harian WITA (query yang dipakai rekap & dashboard)
  const from = new Date(Date.now() - 7 * 86_400_000);
  const to = new Date(Date.now() + 86_400_000);
  const salesAgg = await prisma.$queryRaw<{ day: string; revenue: number; cogs: number; tx: number; cash: number }[]>`
    SELECT to_char(("saleDate" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Makassar'), 'YYYY-MM-DD') AS day,
           COALESCE(SUM(total), 0)::float8 AS revenue,
           COALESCE(SUM("totalCost"), 0)::float8 AS cogs,
           COUNT(*)::int AS tx,
           COALESCE(SUM(CASE WHEN "paymentMethod" = 'CASH' THEN total ELSE 0 END), 0)::float8 AS cash
    FROM sales
    WHERE status = 'COMPLETED' AND "saleDate" >= ${from} AND "saleDate" < ${to}
    GROUP BY 1`;
  const expAgg = await prisma.$queryRaw<{ day: string; amount: number }[]>`
    SELECT to_char(("expenseDate" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Makassar'), 'YYYY-MM-DD') AS day,
           COALESCE(SUM(amount), 0)::float8 AS amount
    FROM expenses
    WHERE "expenseDate" >= ${from} AND "expenseDate" < ${to}
    GROUP BY 1`;
  console.log(`✅ SQL agregasi WITA jalan (sales rows:${salesAgg.length}, expense rows:${expAgg.length})`);

  // 4. Cek RLS aktif + owner-bypass tetap bisa baca
  const rls = await prisma.$queryRaw<{ relname: string; relrowsecurity: boolean }[]>`
    SELECT relname, relrowsecurity FROM pg_class
    WHERE relname IN ('sales','inventories','users') AND relkind = 'r'`;
  console.log(`✅ RLS: ${rls.map((r) => `${r.relname}=${r.relrowsecurity ? "ON" : "off"}`).join(" ")}`);

  // 5. Cek stok demo terbaca (query POS)
  const sample = await prisma.inventory.findFirst({
    where: { qty: { gt: new Prisma.Decimal(0) } },
    include: { product: { select: { name: true } }, outlet: { select: { code: true } } },
  });
  console.log(`✅ Stok demo terbaca: ${sample?.product.name} @ ${sample?.outlet.code} = ${sample?.qty}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error("❌", e.message ?? e);
    prisma.$disconnect();
    process.exit(1);
  });
