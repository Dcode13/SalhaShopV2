/**
 * Reset data TRANSAKSI (persiapan go-live) — master data TIDAK disentuh.
 *
 * Yang dihapus : penjualan, pembelian, piutang, retur, opname, transfer,
 *               mutasi stok NON-INITIAL, biaya, shift/kas, rekap harian,
 *               permintaan produk, audit log.
 * Yang aman   : user, outlet, kategori, supplier, produk, satuan, harga,
 *               settings, dan catatan stok awal (movement INITIAL).
 * Setelahnya  : inventories dihitung ulang dari ledger yang tersisa
 *               (qty = Σ movement INITIAL; avgCost dikembalikan ke HPP awal).
 *
 * Pemakaian:
 *   npx tsx scripts/reset-transaksi.ts          → pratinjau (dry-run)
 *   npx tsx scripts/reset-transaksi.ts --yes    → benar-benar menghapus
 */
import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();
const EXECUTE = process.argv.includes("--yes");

async function counts() {
  const [
    receivables,
    saleReturns,
    sales,
    purchases,
    opnames,
    transfers,
    movesNonInitial,
    expenses,
    sessions,
    summaries,
    requests,
    audits,
  ] = await Promise.all([
    prisma.receivable.count(),
    prisma.saleReturn.count(),
    prisma.sale.count(),
    prisma.purchase.count(),
    prisma.stockOpname.count(),
    prisma.stockTransfer.count(),
    prisma.stockMovement.count({ where: { type: { not: "INITIAL" } } }),
    prisma.expense.count(),
    prisma.cashSession.count(),
    prisma.dailySummary.count(),
    prisma.productRequest.count(),
    prisma.auditLog.count(),
  ]);
  return { receivables, saleReturns, sales, purchases, opnames, transfers, movesNonInitial, expenses, sessions, summaries, requests, audits };
}

async function main() {
  const before = await counts();
  console.log("Data transaksi saat ini:", JSON.stringify(before));

  const total = Object.values(before).reduce((a, b) => a + b, 0);
  if (total === 0) {
    console.log("✅ Sudah bersih — tidak ada yang perlu dihapus.");
    return;
  }
  if (!EXECUTE) {
    console.log("ℹ️ Dry-run. Jalankan dengan --yes untuk benar-benar menghapus.");
    return;
  }

  // urutan aman terhadap foreign key
  await prisma.$transaction([
    prisma.receivable.deleteMany(),
    prisma.saleReturn.deleteMany(), // sale_return_items ikut (cascade)
    prisma.sale.deleteMany(), // sale_items ikut (cascade)
    prisma.purchase.deleteMany(), // purchase_items ikut (cascade)
    prisma.stockOpname.deleteMany(), // items ikut (cascade)
    prisma.stockTransfer.deleteMany(), // items ikut (cascade)
    prisma.stockMovement.deleteMany({ where: { type: { not: "INITIAL" } } }),
    prisma.expense.deleteMany(),
    prisma.cashSession.deleteMany(),
    prisma.dailySummary.deleteMany(),
    prisma.productRequest.deleteMany(),
    prisma.auditLog.deleteMany(),
  ]);
  console.log("🗑️ Data transaksi dihapus.");

  // hitung ulang stok dari ledger yang tersisa (hanya INITIAL)
  const inventories = await prisma.inventory.findMany({ select: { id: true, productId: true, outletId: true } });
  let restored = 0;
  for (const inv of inventories) {
    const [agg, initial] = await Promise.all([
      prisma.stockMovement.aggregate({
        where: { productId: inv.productId, outletId: inv.outletId },
        _sum: { qtyChange: true },
      }),
      prisma.stockMovement.findFirst({
        where: { productId: inv.productId, outletId: inv.outletId, type: "INITIAL" },
        orderBy: { createdAt: "desc" },
        select: { avgCostAfter: true },
      }),
    ]);
    const qty = agg._sum.qtyChange ?? new Prisma.Decimal(0);
    await prisma.inventory.update({
      where: { id: inv.id },
      data: {
        qty,
        ...(initial?.avgCostAfter ? { avgCost: initial.avgCostAfter } : {}),
      },
    });
    restored++;
  }
  console.log(`📦 ${restored} record stok dihitung ulang dari ledger (INITIAL).`);

  const after = await counts();
  console.log("Sisa data transaksi:", JSON.stringify(after));
  console.log("✅ Reset selesai. Master data (produk, user, outlet, harga, kategori) tidak berubah.");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error("❌", e);
    prisma.$disconnect();
    process.exit(1);
  });
