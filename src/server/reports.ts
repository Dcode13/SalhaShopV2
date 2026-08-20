import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { dec } from "@/lib/serialize";
import { dayKeysInRange, type DateRange } from "@/lib/dates";

/**
 * Rumus laporan (lihat PRD §5.3):
 *   Omzet        = Σ sales.total (status COMPLETED)
 *   HPP (COGS)   = Σ sales.totalCost  ← snapshot cost_at_sale saat transaksi
 *   Laba Kotor   = Omzet − HPP
 *   Laba Bersih  = Laba Kotor − Biaya Operasional
 * Biaya bersama (outletId NULL) hanya ikut dihitung pada laporan gabungan.
 */

export type PeriodSummary = {
  revenue: number;
  cogs: number;
  grossProfit: number;
  expenses: number;
  netProfit: number;
  txCount: number;
  itemsSold: number;
  avgTicket: number;
  cashSales: number;
  nonCashSales: number;
  marginPct: number;
};

export async function getPeriodSummary(range: DateRange, outletId?: string): Promise<PeriodSummary> {
  const saleWhere: Prisma.SaleWhereInput = {
    status: "COMPLETED",
    saleDate: { gte: range.from, lt: range.to },
    ...(outletId ? { outletId } : {}),
  };

  const [byMethod, items, expensesAgg] = await Promise.all([
    prisma.sale.groupBy({
      by: ["paymentMethod"],
      where: saleWhere,
      _sum: { total: true, totalCost: true },
      _count: { _all: true },
    }),
    prisma.saleItem.aggregate({
      where: { sale: saleWhere },
      _sum: { qtyBase: true },
    }),
    prisma.expense.aggregate({
      where: {
        expenseDate: { gte: range.from, lt: range.to },
        ...(outletId ? { outletId } : {}),
      },
      _sum: { amount: true },
    }),
  ]);

  let revenue = 0;
  let cogs = 0;
  let txCount = 0;
  let cashSales = 0;
  for (const g of byMethod) {
    const t = dec(g._sum.total);
    revenue += t;
    cogs += dec(g._sum.totalCost);
    txCount += g._count._all;
    if (g.paymentMethod === "CASH") cashSales += t;
  }

  const grossProfit = revenue - cogs;
  const expenses = dec(expensesAgg._sum.amount);
  const netProfit = grossProfit - expenses;

  return {
    revenue,
    cogs,
    grossProfit,
    expenses,
    netProfit,
    txCount,
    itemsSold: dec(items._sum.qtyBase),
    avgTicket: txCount > 0 ? revenue / txCount : 0,
    cashSales,
    nonCashSales: revenue - cashSales,
    marginPct: revenue > 0 ? (grossProfit / revenue) * 100 : 0,
  };
}

export type DailyRow = {
  day: string; // 'yyyy-MM-dd' (WITA)
  revenue: number;
  cogs: number;
  grossProfit: number;
  expenses: number;
  netProfit: number;
  txCount: number;
  cashSales: number;
};

/** Agregasi per hari (WITA) — satu query SQL, efisien juga untuk rentang setahun. */
export async function getDailyBreakdown(range: DateRange, outletId?: string): Promise<DailyRow[]> {
  const outletSales = outletId ? Prisma.sql`AND "outletId" = ${outletId}` : Prisma.empty;
  const outletExp = outletId ? Prisma.sql`AND "outletId" = ${outletId}` : Prisma.empty;

  type SalesRow = { day: string; revenue: number; cogs: number; tx: number; cash: number };
  type ExpRow = { day: string; amount: number };

  const [salesRows, expenseRows] = await Promise.all([
    prisma.$queryRaw<SalesRow[]>`
      SELECT to_char(("saleDate" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Makassar'), 'YYYY-MM-DD') AS day,
             COALESCE(SUM(total), 0)::float8 AS revenue,
             COALESCE(SUM("totalCost"), 0)::float8 AS cogs,
             COUNT(*)::int AS tx,
             COALESCE(SUM(CASE WHEN "paymentMethod" = 'CASH' THEN total ELSE 0 END), 0)::float8 AS cash
      FROM sales
      WHERE status = 'COMPLETED'
        AND "saleDate" >= ${range.from} AND "saleDate" < ${range.to}
        ${outletSales}
      GROUP BY 1
    `,
    prisma.$queryRaw<ExpRow[]>`
      SELECT to_char(("expenseDate" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Makassar'), 'YYYY-MM-DD') AS day,
             COALESCE(SUM(amount), 0)::float8 AS amount
      FROM expenses
      WHERE "expenseDate" >= ${range.from} AND "expenseDate" < ${range.to}
        ${outletExp}
      GROUP BY 1
    `,
  ]);

  const salesMap = new Map(salesRows.map((r) => [r.day, r]));
  const expMap = new Map(expenseRows.map((r) => [r.day, r.amount]));

  return dayKeysInRange(range).map((day) => {
    const s = salesMap.get(day);
    const expenses = expMap.get(day) ?? 0;
    const revenue = s?.revenue ?? 0;
    const cogs = s?.cogs ?? 0;
    return {
      day,
      revenue,
      cogs,
      grossProfit: revenue - cogs,
      expenses,
      netProfit: revenue - cogs - expenses,
      txCount: s?.tx ?? 0,
      cashSales: s?.cash ?? 0,
    };
  });
}

export type TopProduct = { productId: string; name: string; qty: number; revenue: number; profit: number };

export async function getTopProducts(
  range: DateRange,
  outletId: string | undefined,
  by: "qty" | "profit",
  limit = 10
): Promise<TopProduct[]> {
  const grouped = await prisma.saleItem.groupBy({
    by: ["productId"],
    where: {
      sale: {
        status: "COMPLETED",
        saleDate: { gte: range.from, lt: range.to },
        ...(outletId ? { outletId } : {}),
      },
    },
    _sum: { qtyBase: true, subtotal: true, grossProfit: true },
  });

  const sorted = grouped
    .map((g) => ({
      productId: g.productId,
      qty: dec(g._sum.qtyBase),
      revenue: dec(g._sum.subtotal),
      profit: dec(g._sum.grossProfit),
    }))
    .sort((a, b) => (by === "qty" ? b.qty - a.qty : b.profit - a.profit))
    .slice(0, limit);

  const products = await prisma.product.findMany({
    where: { id: { in: sorted.map((s) => s.productId) } },
    select: { id: true, name: true },
  });
  const nameMap = new Map(products.map((p) => [p.id, p.name]));

  return sorted.map((s) => ({ ...s, name: nameMap.get(s.productId) ?? "(produk terhapus)" }));
}

export async function getExpenseByCategory(range: DateRange, outletId?: string) {
  const grouped = await prisma.expense.groupBy({
    by: ["categoryId"],
    where: {
      expenseDate: { gte: range.from, lt: range.to },
      ...(outletId ? { outletId } : {}),
    },
    _sum: { amount: true },
  });
  const cats = await prisma.expenseCategory.findMany({
    where: { id: { in: grouped.map((g) => g.categoryId) } },
    select: { id: true, name: true },
  });
  const nameMap = new Map(cats.map((c) => [c.id, c.name]));
  return grouped
    .map((g) => ({ name: nameMap.get(g.categoryId) ?? "?", value: dec(g._sum.amount) }))
    .sort((a, b) => b.value - a.value);
}

export type LowStockItem = {
  productId: string;
  name: string;
  outletName: string;
  outletId: string;
  qty: number;
  minStock: number;
  baseUnit: string;
};

/** Stok menipis: qty ≤ minStock (dengan minStock > 0) atau qty ≤ 0. */
export async function getLowStock(outletId?: string, limit = 50): Promise<LowStockItem[]> {
  const inventories = await prisma.inventory.findMany({
    where: {
      ...(outletId ? { outletId } : {}),
      product: { isActive: true },
    },
    select: {
      productId: true,
      outletId: true,
      qty: true,
      minStock: true,
      product: { select: { name: true, baseUnit: true } },
      outlet: { select: { name: true } },
    },
  });

  return inventories
    .map((inv) => ({
      productId: inv.productId,
      outletId: inv.outletId,
      name: inv.product.name,
      outletName: inv.outlet.name,
      qty: dec(inv.qty),
      minStock: dec(inv.minStock),
      baseUnit: inv.product.baseUnit,
    }))
    .filter((r) => r.qty <= 0 || (r.minStock > 0 && r.qty <= r.minStock))
    .sort((a, b) => a.qty - b.qty)
    .slice(0, limit);
}

/** Produk mati: punya stok tapi tidak pernah terjual ≥ `days` hari terakhir. */
export async function getDeadStock(days = 30, outletId?: string, limit = 10) {
  const since = new Date(Date.now() - days * 86_400_000);
  const sold = await prisma.saleItem.groupBy({
    by: ["productId"],
    where: { sale: { status: "COMPLETED", saleDate: { gte: since }, ...(outletId ? { outletId } : {}) } },
  });
  const soldIds = new Set(sold.map((s) => s.productId));

  const inventories = await prisma.inventory.findMany({
    where: {
      qty: { gt: 0 },
      ...(outletId ? { outletId } : {}),
      product: { isActive: true },
    },
    select: {
      productId: true,
      qty: true,
      avgCost: true,
      product: { select: { name: true, baseUnit: true } },
      outlet: { select: { name: true } },
    },
  });

  return inventories
    .filter((inv) => !soldIds.has(inv.productId))
    .map((inv) => ({
      productId: inv.productId,
      name: inv.product.name,
      outletName: inv.outlet.name,
      qty: dec(inv.qty),
      baseUnit: inv.product.baseUnit,
      stockValue: dec(inv.qty) * dec(inv.avgCost),
    }))
    .sort((a, b) => b.stockValue - a.stockValue)
    .slice(0, limit);
}

/** Nilai stok = Σ (qty × avgCost) — modal yang mengendap. */
export async function getStockValue(outletId?: string): Promise<number> {
  const rows = await prisma.inventory.findMany({
    where: { qty: { gt: 0 }, ...(outletId ? { outletId } : {}) },
    select: { qty: true, avgCost: true },
  });
  return rows.reduce((sum, r) => sum + dec(r.qty) * dec(r.avgCost), 0);
}

export async function getRecentSales(limit = 10, outletId?: string, userId?: string) {
  return prisma.sale.findMany({
    where: {
      ...(outletId ? { outletId } : {}),
      ...(userId ? { userId } : {}),
    },
    orderBy: { saleDate: "desc" },
    take: limit,
    select: {
      id: true,
      invoiceNo: true,
      saleDate: true,
      total: true,
      status: true,
      paymentMethod: true,
      outlet: { select: { name: true, code: true } },
      user: { select: { name: true } },
      _count: { select: { items: true } },
    },
  });
}
