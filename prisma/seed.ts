/**
 * Seed data awal: 2 outlet, 3 user, kategori biaya, kategori produk dasar, settings.
 * Jalankan: npm run db:seed
 *
 * ⚠️ Ganti password default segera setelah login pertama (menu Pengguna).
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // ── Outlets ──────────────────────────────────────────────
  const grosir = await prisma.outlet.upsert({
    where: { code: "GROSIR" },
    update: {},
    create: {
      code: "GROSIR",
      name: "Lapak Grosir Salha",
      type: "GROSIR",
      address: "Pasar — Lapak Grosir",
    },
  });

  const kios = await prisma.outlet.upsert({
    where: { code: "KIOS" },
    update: {},
    create: {
      code: "KIOS",
      name: "Kios Terminal Salha",
      type: "KIOS",
      address: "Terminal — Kios",
    },
  });

  // ── Users ────────────────────────────────────────────────
  const hash = (pw: string) => bcrypt.hashSync(pw, 10);

  await prisma.user.upsert({
    where: { email: "owner@salhashop.id" },
    update: {},
    create: {
      email: "owner@salhashop.id",
      passwordHash: hash("owner123"),
      name: "Owner Salha Shop",
      role: "OWNER",
    },
  });

  await prisma.user.upsert({
    where: { email: "kasir.grosir@salhashop.id" },
    update: {},
    create: {
      email: "kasir.grosir@salhashop.id",
      passwordHash: hash("kasir123"),
      name: "Kasir Lapak Grosir",
      role: "KASIR",
      outletId: grosir.id,
    },
  });

  await prisma.user.upsert({
    where: { email: "kasir.kios@salhashop.id" },
    update: {},
    create: {
      email: "kasir.kios@salhashop.id",
      passwordHash: hash("kasir123"),
      name: "Kasir Kios Terminal",
      role: "KASIR",
      outletId: kios.id,
    },
  });

  // ── Kategori biaya ───────────────────────────────────────
  const expenseCategories = [
    "Sewa",
    "Listrik & Air",
    "Gaji",
    "Transport Kulakan",
    "Retribusi",
    "Plastik & Kemasan",
    "Kerugian Stok",
    "Lain-lain",
  ];
  for (const name of expenseCategories) {
    await prisma.expenseCategory.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  // ── Kategori produk dasar ────────────────────────────────
  const productCategories = [
    "Sembako",
    "Minuman",
    "Rokok",
    "Snack",
    "Plastik & Kemasan",
    "Alat Dapur",
    "Perabot Rumah Tangga",
    "Kebersihan",
  ];
  let order = 0;
  for (const name of productCategories) {
    await prisma.category.upsert({
      where: { name },
      update: {},
      create: { name, sortOrder: order++ },
    });
  }

  // ── Settings ─────────────────────────────────────────────
  const settings: Record<string, string> = {
    store_name: "Salha Shop",
    max_discount_kasir: "5000", // diskon nominal maksimal per transaksi oleh kasir
    receipt_footer: "Terima kasih telah berbelanja di Salha Shop",
    low_stock_default: "5",
  };
  for (const [key, value] of Object.entries(settings)) {
    await prisma.setting.upsert({
      where: { key },
      update: {},
      create: { key, value },
    });
  }

  console.log("✅ Seed selesai.");
  console.log("   Login owner : owner@salhashop.id / owner123");
  console.log("   Kasir grosir: kasir.grosir@salhashop.id / kasir123");
  console.log("   Kasir kios  : kasir.kios@salhashop.id / kasir123");
  console.log("   ⚠️ Segera ganti password lewat menu Pengguna.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
