import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { addDays, keyToDateColumn, witaDateKey, witaStartOfDay } from "@/lib/dates";
import { dec } from "@/lib/serialize";

export const dynamic = "force-dynamic";

/**
 * Cron: isi cache daily_summaries (dipanggil tiap tengah malam WITA).
 * Vercel Cron: jadwalkan "5 16 * * *" UTC (= 00:05 WITA), header:
 *   Authorization: Bearer ${CRON_SECRET}
 * Default merekap H-1; ?date=yyyy-MM-dd untuk backfill tanggal tertentu.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dateParam = req.nextUrl.searchParams.get("date");
  const dayKey =
    dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)
      ? dateParam
      : witaDateKey(addDays(witaStartOfDay(new Date()), -1)); // kemarin (WITA)

  const from = witaStartOfDay(new Date(`${dayKey}T00:00:00+08:00`));
  const to = addDays(from, 1);

  const outlets = await prisma.outlet.findMany({ select: { id: true } });
  const results: Record<string, unknown>[] = [];

  for (const outlet of outlets) {
    const saleWhere = { outletId: outlet.id, status: "COMPLETED" as const, saleDate: { gte: from, lt: to } };
    const [byMethod, items, expenses, purchases] = await Promise.all([
      prisma.sale.groupBy({
        by: ["paymentMethod"],
        where: saleWhere,
        _sum: { total: true, totalCost: true },
        _count: { _all: true },
      }),
      prisma.saleItem.aggregate({ where: { sale: saleWhere }, _sum: { qtyBase: true } }),
      prisma.expense.aggregate({
        where: { outletId: outlet.id, expenseDate: { gte: from, lt: to } },
        _sum: { amount: true },
      }),
      prisma.purchase.aggregate({
        where: { outletId: outlet.id, status: "RECEIVED", purchaseDate: { gte: from, lt: to } },
        _sum: { total: true },
      }),
    ]);

    let revenue = 0;
    let cogs = 0;
    let txCount = 0;
    let cashSales = 0;
    for (const g of byMethod) {
      revenue += dec(g._sum.total);
      cogs += dec(g._sum.totalCost);
      txCount += g._count._all;
      if (g.paymentMethod === "CASH") cashSales += dec(g._sum.total);
    }
    const expenseTotal = dec(expenses._sum.amount);

    const data = {
      revenue: new Prisma.Decimal(revenue),
      cogs: new Prisma.Decimal(cogs),
      grossProfit: new Prisma.Decimal(revenue - cogs),
      expenses: new Prisma.Decimal(expenseTotal),
      netProfit: new Prisma.Decimal(revenue - cogs - expenseTotal),
      txCount,
      itemsSold: new Prisma.Decimal(dec(items._sum.qtyBase)),
      avgTicket: new Prisma.Decimal(txCount > 0 ? revenue / txCount : 0),
      cashSales: new Prisma.Decimal(cashSales),
      nonCashSales: new Prisma.Decimal(revenue - cashSales),
      purchaseTotal: new Prisma.Decimal(dec(purchases._sum.total)),
      computedAt: new Date(),
    };

    await prisma.dailySummary.upsert({
      where: { outletId_date: { outletId: outlet.id, date: keyToDateColumn(dayKey) } },
      update: data,
      create: { outletId: outlet.id, date: keyToDateColumn(dayKey), ...data },
    });
    results.push({ outletId: outlet.id, revenue, txCount });
  }

  return NextResponse.json({ ok: true, date: dayKey, results });
}
