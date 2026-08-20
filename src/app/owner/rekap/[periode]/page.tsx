import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/auth";
import { dec } from "@/lib/serialize";
import { cn } from "@/lib/utils";
import {
  addDays,
  keyToInstant,
  parseDateInput,
  witaDateKey,
  witaStartOfDay,
  witaStartOfMonth,
  witaStartOfNextMonth,
  witaStartOfWeek,
  witaMonthOfYear,
  type DateRange,
} from "@/lib/dates";
import {
  formatDateID,
  formatDateLongID,
  formatMonthID,
  formatNumber,
  formatPercent,
  formatRp,
} from "@/lib/format";
import { getDailyBreakdown, getPeriodSummary, type PeriodSummary } from "@/server/reports";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyRow, Table, TableWrap, Td, Th } from "@/components/ui/table";
import { PrintButton } from "@/components/print-button";
import { OmzetLabaChart } from "@/components/charts";

export const dynamic = "force-dynamic";

const PERIODES = [
  { key: "harian", label: "Harian" },
  { key: "mingguan", label: "Mingguan" },
  { key: "bulanan", label: "Bulanan" },
  { key: "tahunan", label: "Tahunan" },
] as const;

type PeriodeKey = (typeof PERIODES)[number]["key"];

function Tabs({ active }: { active: PeriodeKey }) {
  return (
    <div className="mb-5 flex gap-1 rounded-lg border border-line bg-surface p-1 no-print w-fit">
      {PERIODES.map((p) => (
        <Link
          key={p.key}
          href={`/owner/rekap/${p.key}`}
          className={cn(
            "rounded-md px-4 py-2 text-sm font-bold transition-colors",
            active === p.key ? "bg-primary text-primary-fg" : "text-ink-muted hover:bg-primary-soft hover:text-primary"
          )}
        >
          {p.label}
        </Link>
      ))}
    </div>
  );
}

function SummaryBlock({ title, s, highlight = false }: { title: string; s: PeriodSummary; highlight?: boolean }) {
  return (
    <Card className={highlight ? "border-primary bg-primary-softer" : ""}>
      <CardHeader title={title} />
      <CardBody className="space-y-1.5 text-sm">
        <div className="flex justify-between">
          <span className="text-ink-muted">Omzet</span>
          <span className="font-semibold tabular-nums">{formatRp(s.revenue)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-ink-muted">HPP</span>
          <span className="tabular-nums">{formatRp(s.cogs)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-ink-muted">Laba Kotor</span>
          <span className="font-semibold tabular-nums">
            {formatRp(s.grossProfit)} <span className="text-xs text-ink-faint">({formatPercent(s.marginPct)})</span>
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-ink-muted">Biaya Operasional</span>
          <span className="tabular-nums">− {formatRp(s.expenses)}</span>
        </div>
        <div className="flex justify-between border-t border-line pt-2 text-base font-extrabold">
          <span>LABA BERSIH</span>
          <span className={cn("tabular-nums", s.netProfit >= 0 ? "text-success" : "text-danger")}>{formatRp(s.netProfit)}</span>
        </div>
        <p className="pt-1 text-xs text-ink-faint">
          Transaksi: {formatNumber(s.txCount)} · Rata-rata: {formatRp(s.avgTicket)} · Tunai {formatRp(s.cashSales)} / Non-tunai{" "}
          {formatRp(s.nonCashSales)}
        </p>
      </CardBody>
    </Card>
  );
}

function DailyTable({ rows, labelFor }: { rows: Awaited<ReturnType<typeof getDailyBreakdown>>; labelFor: (day: string) => string }) {
  const tot = rows.reduce(
    (a, r) => ({
      revenue: a.revenue + r.revenue,
      gross: a.gross + r.grossProfit,
      exp: a.exp + r.expenses,
      net: a.net + r.netProfit,
      tx: a.tx + r.txCount,
    }),
    { revenue: 0, gross: 0, exp: 0, net: 0, tx: 0 }
  );
  const activeDays = rows.filter((r) => r.txCount > 0).length || 1;
  return (
    <TableWrap>
      <Table>
        <thead>
          <tr>
            <Th>Periode</Th>
            <Th className="text-right">Omzet</Th>
            <Th className="text-right">Laba Kotor</Th>
            <Th className="text-right">Biaya</Th>
            <Th className="text-right">Laba Bersih</Th>
            <Th className="text-right">Transaksi</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.day}>
              <Td className="font-semibold">{labelFor(r.day)}</Td>
              <Td className="text-right tabular-nums">{formatRp(r.revenue)}</Td>
              <Td className="text-right tabular-nums">{formatRp(r.grossProfit)}</Td>
              <Td className="text-right tabular-nums">{formatRp(r.expenses)}</Td>
              <Td className={cn("text-right font-semibold tabular-nums", r.netProfit >= 0 ? "text-success" : "text-danger")}>
                {formatRp(r.netProfit)}
              </Td>
              <Td className="text-right tabular-nums">{r.txCount}</Td>
            </tr>
          ))}
          <tr className="bg-primary-softer font-extrabold">
            <Td>TOTAL</Td>
            <Td className="text-right tabular-nums">{formatRp(tot.revenue)}</Td>
            <Td className="text-right tabular-nums">{formatRp(tot.gross)}</Td>
            <Td className="text-right tabular-nums">{formatRp(tot.exp)}</Td>
            <Td className="text-right tabular-nums">{formatRp(tot.net)}</Td>
            <Td className="text-right tabular-nums">{tot.tx}</Td>
          </tr>
          <tr className="text-ink-muted">
            <Td>Rata-rata / hari aktif</Td>
            <Td className="text-right tabular-nums">{formatRp(tot.revenue / activeDays)}</Td>
            <Td className="text-right tabular-nums">{formatRp(tot.gross / activeDays)}</Td>
            <Td className="text-right tabular-nums">{formatRp(tot.exp / activeDays)}</Td>
            <Td className="text-right tabular-nums">{formatRp(tot.net / activeDays)}</Td>
            <Td className="text-right tabular-nums">{Math.round(tot.tx / activeDays)}</Td>
          </tr>
        </tbody>
      </Table>
    </TableWrap>
  );
}

export default async function RekapPage({
  params,
  searchParams,
}: {
  params: Promise<{ periode: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireOwner();
  const { periode } = await params;
  const sp = await searchParams;
  if (!PERIODES.some((p) => p.key === periode)) notFound();
  const key = periode as PeriodeKey;

  const outlets = await prisma.outlet.findMany({ where: { isActive: true }, orderBy: { code: "asc" } });
  const now = new Date();

  // ── HARIAN ──────────────────────────────────────────────
  if (key === "harian") {
    const tanggal = typeof sp.tanggal === "string" ? sp.tanggal : witaDateKey(now);
    const from = parseDateInput(tanggal) ?? witaStartOfDay(now);
    const range: DateRange = { from, to: addDays(from, 1) };

    const [combined, perOutlet, sessions] = await Promise.all([
      getPeriodSummary(range),
      Promise.all(outlets.map(async (o) => ({ outlet: o, s: await getPeriodSummary(range, o.id) }))),
      prisma.cashSession.findMany({
        where: { closedAt: { gte: range.from, lt: range.to } },
        include: { outlet: { select: { name: true } } },
      }),
    ]);

    return (
      <>
        <PageHeader
          title="Rekap Harian"
          description={formatDateLongID(from)}
          actions={
            <>
              <form className="flex items-center gap-2 no-print">
                <input type="date" name="tanggal" defaultValue={tanggal} className="h-10 rounded-lg border border-line bg-surface px-3 text-sm" />
                <button type="submit" className="h-10 rounded-lg border border-line bg-surface px-4 text-sm font-bold text-ink-muted hover:border-primary hover:text-primary">
                  Lihat
                </button>
              </form>
              <PrintButton />
            </>
          }
        />
        <Tabs active={key} />

        <div className="grid gap-4 lg:grid-cols-3">
          {perOutlet.map(({ outlet, s }) => (
            <SummaryBlock key={outlet.id} title={outlet.name} s={s} />
          ))}
          <SummaryBlock title="TOTAL SALHA SHOP" s={combined} highlight />
        </div>

        <Card className="mt-4">
          <CardHeader title="Selisih Kas Hari Ini" description="Dari shift yang ditutup pada tanggal ini" />
          <CardBody>
            {sessions.length === 0 ? (
              <p className="text-sm text-ink-faint">Belum ada shift ditutup pada tanggal ini.</p>
            ) : (
              <div className="flex flex-wrap gap-3">
                {sessions.map((s) => {
                  const diff = dec(s.difference);
                  return (
                    <Badge key={s.id} tone={diff === 0 ? "success" : diff < 0 ? "danger" : "warn"} className="px-3 py-1.5 text-xs">
                      {s.outlet.name}: {diff > 0 ? "+" : ""}
                      {formatRp(diff)}
                    </Badge>
                  );
                })}
              </div>
            )}
          </CardBody>
        </Card>
      </>
    );
  }

  // ── MINGGUAN ────────────────────────────────────────────
  if (key === "mingguan") {
    const tanggal = typeof sp.tanggal === "string" ? sp.tanggal : witaDateKey(now);
    const anchor = parseDateInput(tanggal) ?? witaStartOfDay(now);
    const from = witaStartOfWeek(anchor);
    const range: DateRange = { from, to: addDays(from, 7) };
    const rows = await getDailyBreakdown(range);

    return (
      <>
        <PageHeader
          title="Rekap Mingguan"
          description={`${formatDateID(range.from)} – ${formatDateID(addDays(range.to, -1))} (Senin–Minggu)`}
          actions={
            <>
              <form className="flex items-center gap-2 no-print">
                <input type="date" name="tanggal" defaultValue={tanggal} className="h-10 rounded-lg border border-line bg-surface px-3 text-sm" />
                <button type="submit" className="h-10 rounded-lg border border-line bg-surface px-4 text-sm font-bold text-ink-muted hover:border-primary hover:text-primary">
                  Lihat
                </button>
              </form>
              <PrintButton />
            </>
          }
        />
        <Tabs active={key} />
        <Card>
          <DailyTable
            rows={rows}
            labelFor={(day) =>
              new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "short", timeZone: "Asia/Makassar" }).format(
                keyToInstant(day)
              )
            }
          />
        </Card>
      </>
    );
  }

  // ── BULANAN ─────────────────────────────────────────────
  if (key === "bulanan") {
    const bulan = typeof sp.bulan === "string" && /^\d{4}-\d{2}$/.test(sp.bulan) ? sp.bulan : witaDateKey(now).slice(0, 7);
    const from = keyToInstant(`${bulan}-01`);
    const range: DateRange = { from, to: witaStartOfNextMonth(from) };
    const prevRange: DateRange = { from: witaStartOfMonth(addDays(from, -1)), to: from };

    const [rows, summary, prevSummary, catGroups] = await Promise.all([
      getDailyBreakdown(range),
      getPeriodSummary(range),
      getPeriodSummary(prevRange),
      prisma.saleItem.groupBy({
        by: ["productId"],
        where: { sale: { status: "COMPLETED", saleDate: { gte: range.from, lt: range.to } } },
        _sum: { subtotal: true, grossProfit: true, qtyBase: true },
      }),
    ]);

    // agregasi per kategori produk
    const prodCats = await prisma.product.findMany({
      where: { id: { in: catGroups.map((g) => g.productId) } },
      select: { id: true, category: { select: { name: true } } },
    });
    const catName = new Map(prodCats.map((p) => [p.id, p.category.name]));
    const byCat = new Map<string, { revenue: number; profit: number }>();
    for (const g of catGroups) {
      const name = catName.get(g.productId) ?? "?";
      const cur = byCat.get(name) ?? { revenue: 0, profit: 0 };
      cur.revenue += dec(g._sum.subtotal);
      cur.profit += dec(g._sum.grossProfit);
      byCat.set(name, cur);
    }
    const catRows = [...byCat.entries()].sort((a, b) => b[1].revenue - a[1].revenue);

    // breakdown per minggu
    const weekMap = new Map<string, typeof rows>();
    for (const r of rows) {
      const wk = witaDateKey(witaStartOfWeek(keyToInstant(r.day)));
      const arr = weekMap.get(wk) ?? [];
      arr.push(r);
      weekMap.set(wk, arr);
    }
    const weekRows = [...weekMap.entries()].map(([wk, days]) => ({
      day: wk,
      revenue: days.reduce((s, d) => s + d.revenue, 0),
      cogs: days.reduce((s, d) => s + d.cogs, 0),
      grossProfit: days.reduce((s, d) => s + d.grossProfit, 0),
      expenses: days.reduce((s, d) => s + d.expenses, 0),
      netProfit: days.reduce((s, d) => s + d.netProfit, 0),
      txCount: days.reduce((s, d) => s + d.txCount, 0),
      cashSales: 0,
    }));

    const deltaOmzet = prevSummary.revenue > 0 ? ((summary.revenue - prevSummary.revenue) / prevSummary.revenue) * 100 : null;
    const deltaNet = prevSummary.netProfit !== 0 ? ((summary.netProfit - prevSummary.netProfit) / Math.abs(prevSummary.netProfit)) * 100 : null;

    return (
      <>
        <PageHeader
          title="Rekap Bulanan"
          description={formatMonthID(from)}
          actions={
            <>
              <form className="flex items-center gap-2 no-print">
                <input type="month" name="bulan" defaultValue={bulan} className="h-10 rounded-lg border border-line bg-surface px-3 text-sm" />
                <button type="submit" className="h-10 rounded-lg border border-line bg-surface px-4 text-sm font-bold text-ink-muted hover:border-primary hover:text-primary">
                  Lihat
                </button>
              </form>
              <PrintButton />
            </>
          }
        />
        <Tabs active={key} />

        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-line bg-surface p-4 shadow-card">
            <p className="text-xs font-semibold text-ink-muted">Omzet</p>
            <p className="text-xl font-extrabold tabular-nums">{formatRp(summary.revenue)}</p>
            {deltaOmzet !== null ? (
              <p className={cn("text-xs font-bold", deltaOmzet >= 0 ? "text-success" : "text-danger")}>
                {deltaOmzet >= 0 ? "▲" : "▼"} {formatPercent(Math.abs(deltaOmzet))} vs bulan lalu
              </p>
            ) : null}
          </div>
          <div className="rounded-xl border border-line bg-surface p-4 shadow-card">
            <p className="text-xs font-semibold text-ink-muted">Laba Bersih</p>
            <p className={cn("text-xl font-extrabold tabular-nums", summary.netProfit >= 0 ? "text-success" : "text-danger")}>
              {formatRp(summary.netProfit)}
            </p>
            {deltaNet !== null ? (
              <p className={cn("text-xs font-bold", deltaNet >= 0 ? "text-success" : "text-danger")}>
                {deltaNet >= 0 ? "▲" : "▼"} {formatPercent(Math.abs(deltaNet))} vs bulan lalu
              </p>
            ) : null}
          </div>
          <div className="rounded-xl border border-line bg-surface p-4 shadow-card">
            <p className="text-xs font-semibold text-ink-muted">Transaksi</p>
            <p className="text-xl font-extrabold tabular-nums">{formatNumber(summary.txCount)}</p>
            <p className="text-xs text-ink-muted">rata-rata {formatRp(summary.avgTicket)}</p>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader title="Breakdown per Minggu" />
            <DailyTable rows={weekRows} labelFor={(wk) => `Minggu ${formatDateID(keyToInstant(wk))}`} />
          </Card>
          <Card>
            <CardHeader title="Penjualan per Kategori Produk" />
            <TableWrap>
              <Table>
                <thead>
                  <tr>
                    <Th>Kategori</Th>
                    <Th className="text-right">Omzet</Th>
                    <Th className="text-right">Laba Kotor</Th>
                  </tr>
                </thead>
                <tbody>
                  {catRows.length === 0 ? (
                    <EmptyRow colSpan={3}>Belum ada penjualan bulan ini.</EmptyRow>
                  ) : (
                    catRows.map(([name, v]) => (
                      <tr key={name}>
                        <Td className="font-semibold">{name}</Td>
                        <Td className="text-right tabular-nums">{formatRp(v.revenue)}</Td>
                        <Td className="text-right tabular-nums text-success">{formatRp(v.profit)}</Td>
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

  // ── TAHUNAN ─────────────────────────────────────────────
  const tahun = typeof sp.tahun === "string" && /^\d{4}$/.test(sp.tahun) ? Number(sp.tahun) : Number(witaDateKey(now).slice(0, 4));
  const from = witaMonthOfYear(tahun, 1);
  const range: DateRange = { from, to: witaMonthOfYear(tahun + 1, 1) };
  const daily = await getDailyBreakdown(range);

  const monthRows = Array.from({ length: 12 }, (_, i) => {
    const mk = `${tahun}-${String(i + 1).padStart(2, "0")}`;
    const days = daily.filter((d) => d.day.startsWith(mk));
    return {
      day: `${mk}-01`,
      mk,
      revenue: days.reduce((s, d) => s + d.revenue, 0),
      cogs: days.reduce((s, d) => s + d.cogs, 0),
      grossProfit: days.reduce((s, d) => s + d.grossProfit, 0),
      expenses: days.reduce((s, d) => s + d.expenses, 0),
      netProfit: days.reduce((s, d) => s + d.netProfit, 0),
      txCount: days.reduce((s, d) => s + d.txCount, 0),
      cashSales: 0,
    };
  });

  const withSales = monthRows.filter((m) => m.revenue > 0);
  const best = withSales.length ? withSales.reduce((a, b) => (b.netProfit > a.netProfit ? b : a)) : null;
  const worst = withSales.length ? withSales.reduce((a, b) => (b.netProfit < a.netProfit ? b : a)) : null;

  return (
    <>
      <PageHeader
        title="Rekap Tahunan"
        description={`Tahun ${tahun}`}
        actions={
          <>
            <form className="flex items-center gap-2 no-print">
              <input
                type="number"
                name="tahun"
                defaultValue={tahun}
                min={2020}
                max={2100}
                className="h-10 w-24 rounded-lg border border-line bg-surface px-3 text-sm"
              />
              <button type="submit" className="h-10 rounded-lg border border-line bg-surface px-4 text-sm font-bold text-ink-muted hover:border-primary hover:text-primary">
                Lihat
              </button>
            </form>
            <PrintButton />
          </>
        }
      />
      <Tabs active={key} />

      {best && worst ? (
        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-success/40 bg-success-soft p-4">
            <p className="text-xs font-bold text-green-800">Bulan terbaik</p>
            <p className="text-lg font-extrabold text-green-900">
              {formatMonthID(keyToInstant(best.day))} — {formatRp(best.netProfit)}
            </p>
          </div>
          <div className="rounded-xl border border-danger/40 bg-danger-soft p-4">
            <p className="text-xs font-bold text-red-800">Bulan terburuk</p>
            <p className="text-lg font-extrabold text-red-900">
              {formatMonthID(keyToInstant(worst.day))} — {formatRp(worst.netProfit)}
            </p>
          </div>
        </div>
      ) : null}

      <Card className="mb-4">
        <CardHeader title="Tren Bulanan" />
        <CardBody>
          <OmzetLabaChart
            data={monthRows.map((m) => ({
              label: formatMonthID(keyToInstant(m.day)).split(" ")[0],
              Omzet: m.revenue,
              "Laba Bersih": m.netProfit,
            }))}
          />
        </CardBody>
      </Card>

      <Card>
        <DailyTable rows={monthRows} labelFor={(day) => formatMonthID(keyToInstant(day))} />
      </Card>
    </>
  );
}
