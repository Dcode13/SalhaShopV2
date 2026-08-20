import Link from "next/link";
import {
  Banknote,
  Boxes,
  PackageX,
  Receipt,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { dec } from "@/lib/serialize";
import {
  keyToInstant,
  parseDateInput,
  previousRange,
  rangeForPreset,
  type DateRange,
} from "@/lib/dates";
import { formatDateID, formatDateTimeID, formatNumber, formatPercent, formatRp } from "@/lib/format";
import {
  getDailyBreakdown,
  getDeadStock,
  getExpenseByCategory,
  getLowStock,
  getPeriodSummary,
  getRecentSales,
  getStockValue,
  getTopProducts,
} from "@/server/reports";
import { PeriodFilter, parsePeriodParams } from "@/components/period-filter";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyRow, Table, TableWrap, Td, Th } from "@/components/ui/table";
import { buttonClass } from "@/components/ui/button";
import { BiayaDonut, OmzetLabaChart, OutletBarChart, TopProdukBar } from "@/components/charts";

export const dynamic = "force-dynamic";

function delta(cur: number, prev: number): number | null {
  if (prev === 0) return null;
  return ((cur - prev) / Math.abs(prev)) * 100;
}

function dayLabel(key: string): string {
  return `${Number(key.slice(8, 10))}/${Number(key.slice(5, 7))}`;
}

function monthLabel(key: string): string {
  return new Intl.DateTimeFormat("id-ID", { month: "short", timeZone: "Asia/Makassar" }).format(
    keyToInstant(`${key}-15`)
  );
}

/** Bila rentang > 62 hari, gabungkan baris harian menjadi bulanan agar grafik terbaca. */
function chartRows(daily: Awaited<ReturnType<typeof getDailyBreakdown>>, range: DateRange) {
  const days = Math.round((range.to.getTime() - range.from.getTime()) / 86_400_000);
  if (days <= 62) {
    return daily.map((d) => ({ label: dayLabel(d.day), Omzet: d.revenue, "Laba Bersih": d.netProfit }));
  }
  const byMonth = new Map<string, { Omzet: number; laba: number }>();
  for (const d of daily) {
    const mk = d.day.slice(0, 7);
    const cur = byMonth.get(mk) ?? { Omzet: 0, laba: 0 };
    cur.Omzet += d.revenue;
    cur.laba += d.netProfit;
    byMonth.set(mk, cur);
  }
  return [...byMonth.entries()].map(([mk, v]) => ({
    label: monthLabel(mk),
    Omzet: v.Omzet,
    "Laba Bersih": v.laba,
  }));
}

export default async function OwnerDashboard({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = parsePeriodParams(await searchParams);
  const range = rangeForPreset(params.periode, parseDateInput(params.from), parseDateInput(params.to));
  const prev = previousRange(range);
  const outletId = params.outlet;

  const outlets = await prisma.outlet.findMany({ where: { isActive: true }, orderBy: { code: "asc" } });

  const [summary, prevSummary, daily, expenseCats, topQty, topProfit, lowStock, deadStock, stockValue, recentSales] =
    await Promise.all([
      getPeriodSummary(range, outletId),
      getPeriodSummary(prev, outletId),
      getDailyBreakdown(range, outletId),
      getExpenseByCategory(range, outletId),
      getTopProducts(range, outletId, "qty"),
      getTopProducts(range, outletId, "profit"),
      getLowStock(outletId, 8),
      getDeadStock(30, outletId, 6),
      getStockValue(outletId),
      getRecentSales(8, outletId),
    ]);

  // Perbandingan & grafik antar outlet (hanya saat melihat semua outlet)
  const showCompare = !outletId && outlets.length > 1;
  const perOutlet = showCompare
    ? await Promise.all(
        outlets.map(async (o) => ({
          outlet: o,
          summary: await getPeriodSummary(range, o.id),
          daily: await getDailyBreakdown(range, o.id),
        }))
      )
    : [];

  let outletChart: { data: Record<string, number | string>[]; keys: string[] } | null = null;
  if (showCompare) {
    const keys = perOutlet.map((p) => p.outlet.name);
    const labels = chartRows(perOutlet[0].daily, range).map((r) => r.label);
    const series = perOutlet.map((p) => chartRows(p.daily, range));
    outletChart = {
      keys,
      data: labels.map((label, i) => {
        const row: Record<string, number | string> = { label };
        perOutlet.forEach((p, oi) => {
          row[p.outlet.name] = series[oi][i]?.Omzet ?? 0;
        });
        return row;
      }),
    };
  }

  const lastSessions = await prisma.cashSession.findMany({
    where: { status: "CLOSED", ...(outletId ? { outletId } : {}) },
    orderBy: { closedAt: "desc" },
    take: outletId ? 1 : outlets.length,
    distinct: ["outletId"],
    include: { outlet: { select: { name: true } }, user: { select: { name: true } } },
  });

  return (
    <>
      <PageHeader
        title="Dashboard Owner"
        description={`Periode ${formatDateID(range.from)} – ${formatDateID(new Date(range.to.getTime() - 1))}`}
      />

      <PeriodFilter
        basePath="/owner/dashboard"
        current={params}
        outlets={outlets.map((o) => ({ id: o.id, name: o.name }))}
      />

      {/* KPI */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard
          label="Omzet"
          value={formatRp(summary.revenue)}
          delta={delta(summary.revenue, prevSummary.revenue)}
          sub="vs periode sblm"
          icon={<TrendingUp className="size-4" />}
        />
        <StatCard
          label="Laba Kotor"
          value={formatRp(summary.grossProfit)}
          delta={delta(summary.grossProfit, prevSummary.grossProfit)}
          sub={`margin ${formatPercent(summary.marginPct)}`}
          icon={<TrendingUp className="size-4" />}
        />
        <StatCard
          label="Biaya Operasional"
          value={formatRp(summary.expenses)}
          delta={delta(summary.expenses, prevSummary.expenses)}
          icon={<Wallet className="size-4" />}
        />
        <StatCard
          label="Laba Bersih"
          value={formatRp(summary.netProfit)}
          delta={delta(summary.netProfit, prevSummary.netProfit)}
          sub="vs periode sblm"
          icon={<Banknote className="size-4" />}
          highlight
        />
        <StatCard
          label="Transaksi"
          value={formatNumber(summary.txCount)}
          sub={`rata-rata ${formatRp(summary.avgTicket)}`}
          icon={<Receipt className="size-4" />}
        />
        <StatCard
          label="Nilai Stok"
          value={formatRp(stockValue)}
          sub="modal mengendap"
          icon={<Boxes className="size-4" />}
        />
      </div>

      {/* Grafik utama */}
      <div className="mt-5 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Omzet vs Laba Bersih" description="Per hari dalam periode terpilih" />
          <CardBody>
            <OmzetLabaChart data={chartRows(daily, range)} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Komposisi Biaya" description="Per kategori biaya" />
          <CardBody>
            {expenseCats.length > 0 ? (
              <BiayaDonut data={expenseCats} />
            ) : (
              <p className="py-16 text-center text-sm text-ink-faint">Belum ada biaya di periode ini.</p>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Perbandingan outlet */}
      {showCompare ? (
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader title="Omzet per Outlet" description="Bar bertumpuk Grosir vs Kios" />
            <CardBody>{outletChart ? <OutletBarChart data={outletChart.data} keys={outletChart.keys} /> : null}</CardBody>
          </Card>
          <Card>
            <CardHeader title="Bandingkan Outlet" description="Ringkasan periode terpilih" />
            <TableWrap>
              <Table>
                <thead>
                  <tr>
                    <Th>Metrik</Th>
                    {perOutlet.map((p) => (
                      <Th key={p.outlet.id} className="text-right">
                        {p.outlet.name}
                      </Th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(
                    [
                      ["Omzet", (s: typeof summary) => formatRp(s.revenue)],
                      ["Laba Kotor", (s: typeof summary) => formatRp(s.grossProfit)],
                      ["Margin", (s: typeof summary) => formatPercent(s.marginPct)],
                      ["Biaya", (s: typeof summary) => formatRp(s.expenses)],
                      ["Laba Bersih", (s: typeof summary) => formatRp(s.netProfit)],
                      ["Transaksi", (s: typeof summary) => formatNumber(s.txCount)],
                      ["Rata-rata / transaksi", (s: typeof summary) => formatRp(s.avgTicket)],
                    ] as const
                  ).map(([label, fn]) => (
                    <tr key={label}>
                      <Td className="font-semibold text-ink-muted">{label}</Td>
                      {perOutlet.map((p) => (
                        <Td key={p.outlet.id} className="text-right font-semibold tabular-nums">
                          {fn(p.summary)}
                        </Td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          </Card>
        </div>
      ) : null}

      {/* Produk terlaris & paling untung */}
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="10 Produk Terlaris" description="Berdasarkan qty terjual (base unit)" />
          <CardBody>
            {topQty.length > 0 ? (
              <TopProdukBar data={topQty.map((t) => ({ name: t.name, value: t.qty }))} unit="qty" />
            ) : (
              <p className="py-10 text-center text-sm text-ink-faint">Belum ada penjualan di periode ini.</p>
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="10 Produk Paling Untung" description="Berdasarkan laba kotor" />
          <CardBody>
            {topProfit.length > 0 ? (
              <TopProdukBar data={topProfit.map((t) => ({ name: t.name, value: t.profit }))} unit="rp" />
            ) : (
              <p className="py-10 text-center text-sm text-ink-faint">Belum ada penjualan di periode ini.</p>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Peringatan & aktivitas */}
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title={
              <span className="inline-flex items-center gap-1.5">
                <PackageX className="size-4 text-danger" /> Stok Menipis
              </span>
            }
            description="qty ≤ stok minimum"
            action={
              <Link href="/owner/pembelian/baru" className={buttonClass("soft", "sm")}>
                <ShoppingCart className="size-3.5" /> Buat Pembelian
              </Link>
            }
          />
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Produk</Th>
                  <Th>Outlet</Th>
                  <Th className="text-right">Sisa</Th>
                  <Th className="text-right">Min</Th>
                </tr>
              </thead>
              <tbody>
                {lowStock.length === 0 ? (
                  <EmptyRow colSpan={4}>Semua stok aman 👍</EmptyRow>
                ) : (
                  lowStock.map((r) => (
                    <tr key={`${r.productId}-${r.outletId}`}>
                      <Td className="font-semibold">{r.name}</Td>
                      <Td className="text-ink-muted">{r.outletName}</Td>
                      <Td className="text-right">
                        <Badge tone={r.qty <= 0 ? "danger" : "warn"}>
                          {formatNumber(r.qty)} {r.baseUnit}
                        </Badge>
                      </Td>
                      <Td className="text-right text-ink-muted tabular-nums">{formatNumber(r.minStock)}</Td>
                    </tr>
                  ))
                )}
              </tbody>
            </Table>
          </TableWrap>
        </Card>

        <Card>
          <CardHeader
            title={
              <span className="inline-flex items-center gap-1.5">
                <TrendingDown className="size-4 text-warn" /> Produk Mati (&gt;30 hari tak terjual)
              </span>
            }
            description="Modal nyangkut — pertimbangkan promo/retur"
          />
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Produk</Th>
                  <Th>Outlet</Th>
                  <Th className="text-right">Stok</Th>
                  <Th className="text-right">Nilai Modal</Th>
                </tr>
              </thead>
              <tbody>
                {deadStock.length === 0 ? (
                  <EmptyRow colSpan={4}>Tidak ada produk mati 🎉</EmptyRow>
                ) : (
                  deadStock.map((r) => (
                    <tr key={`${r.productId}-${r.outletName}`}>
                      <Td className="font-semibold">{r.name}</Td>
                      <Td className="text-ink-muted">{r.outletName}</Td>
                      <Td className="text-right tabular-nums">
                        {formatNumber(r.qty)} {r.baseUnit}
                      </Td>
                      <Td className="text-right font-semibold tabular-nums">{formatRp(r.stockValue)}</Td>
                    </tr>
                  ))
                )}
              </tbody>
            </Table>
          </TableWrap>
        </Card>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Selisih Kas Shift Terakhir" description="Rekonsiliasi tutup shift per outlet" />
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Outlet</Th>
                  <Th>Kasir</Th>
                  <Th>Ditutup</Th>
                  <Th className="text-right">Selisih</Th>
                </tr>
              </thead>
              <tbody>
                {lastSessions.length === 0 ? (
                  <EmptyRow colSpan={4}>Belum ada shift yang ditutup.</EmptyRow>
                ) : (
                  lastSessions.map((s) => {
                    const diff = dec(s.difference);
                    return (
                      <tr key={s.id}>
                        <Td className="font-semibold">{s.outlet.name}</Td>
                        <Td className="text-ink-muted">{s.user.name}</Td>
                        <Td className="text-ink-muted">{s.closedAt ? formatDateTimeID(s.closedAt) : "-"}</Td>
                        <Td className="text-right">
                          <Badge tone={diff === 0 ? "success" : diff < 0 ? "danger" : "warn"}>
                            {diff > 0 ? "+" : ""}
                            {formatRp(diff)}
                          </Badge>
                        </Td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </Table>
          </TableWrap>
        </Card>

        <Card>
          <CardHeader
            title="Transaksi Terbaru"
            action={
              <Link href="/owner/transaksi" className="text-xs font-bold text-primary hover:underline">
                Lihat semua →
              </Link>
            }
          />
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Invoice</Th>
                  <Th>Outlet</Th>
                  <Th>Waktu</Th>
                  <Th className="text-right">Total</Th>
                </tr>
              </thead>
              <tbody>
                {recentSales.length === 0 ? (
                  <EmptyRow colSpan={4}>Belum ada transaksi.</EmptyRow>
                ) : (
                  recentSales.map((s) => (
                    <tr key={s.id}>
                      <Td>
                        <Link href={`/owner/transaksi/${s.id}`} className="font-semibold text-primary hover:underline">
                          {s.invoiceNo}
                        </Link>
                        {s.status === "VOID" ? (
                          <Badge tone="danger" className="ml-2">
                            VOID
                          </Badge>
                        ) : null}
                      </Td>
                      <Td className="text-ink-muted">{s.outlet.name}</Td>
                      <Td className="text-ink-muted">{formatDateTimeID(s.saleDate)}</Td>
                      <Td className="text-right font-semibold tabular-nums">{formatRp(dec(s.total))}</Td>
                    </tr>
                  ))
                )}
              </tbody>
            </Table>
          </TableWrap>
        </Card>
      </div>
    </>
  );
}
