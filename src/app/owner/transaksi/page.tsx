import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/auth";
import { dec } from "@/lib/serialize";
import { addDays, parseDateInput, rangeForPreset, witaDateKey } from "@/lib/dates";
import { formatDateID, formatRp, formatTimeID } from "@/lib/format";
import { PAYMENT_LABELS } from "@/lib/labels";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyRow, Table, TableWrap, Td, Th } from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function OwnerTransaksiPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireOwner();
  const sp = await searchParams;
  const tanggal = typeof sp.tanggal === "string" ? sp.tanggal : witaDateKey(new Date());
  const outletId = typeof sp.outlet === "string" && sp.outlet ? sp.outlet : "";
  const from = parseDateInput(tanggal) ?? rangeForPreset("hari-ini").from;
  const to = addDays(from, 1);

  const [outlets, sales] = await Promise.all([
    prisma.outlet.findMany({ where: { isActive: true }, orderBy: { code: "asc" } }),
    prisma.sale.findMany({
      where: { saleDate: { gte: from, lt: to }, ...(outletId ? { outletId } : {}) },
      orderBy: { saleDate: "desc" },
      take: 300,
      include: {
        outlet: { select: { code: true } },
        user: { select: { name: true } },
        _count: { select: { items: true } },
      },
    }),
  ]);

  const completed = sales.filter((s) => s.status === "COMPLETED");
  const omzet = completed.reduce((s, x) => s + dec(x.total), 0);
  const laba = completed.reduce((s, x) => s + dec(x.grossProfit), 0);

  return (
    <>
      <PageHeader
        title="Transaksi Penjualan"
        description={`${formatDateID(from)} · ${completed.length} transaksi · omzet ${formatRp(omzet)} · laba kotor ${formatRp(laba)}`}
        actions={
          <form className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              name="tanggal"
              defaultValue={tanggal}
              className="h-10 rounded-lg border border-line bg-surface px-3 text-sm text-ink"
            />
            <select name="outlet" defaultValue={outletId} className="h-10 rounded-lg border border-line bg-surface px-3 text-sm text-ink">
              <option value="">Semua outlet</option>
              {outlets.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="h-10 rounded-lg border border-line bg-surface px-4 text-sm font-bold text-ink-muted hover:border-primary hover:text-primary"
            >
              Lihat
            </button>
          </form>
        }
      />

      <Card>
        <TableWrap>
          <Table>
            <thead>
              <tr>
                <Th>Invoice</Th>
                <Th>Jam</Th>
                <Th>Outlet</Th>
                <Th>Kasir</Th>
                <Th className="text-right">Item</Th>
                <Th className="text-right">Total</Th>
                <Th className="text-right">Laba Kotor</Th>
                <Th>Bayar</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {sales.length === 0 ? (
                <EmptyRow colSpan={9}>Tidak ada transaksi pada tanggal ini.</EmptyRow>
              ) : (
                sales.map((s) => (
                  <tr key={s.id} className={s.status === "VOID" ? "opacity-60" : ""}>
                    <Td>
                      <Link href={`/owner/transaksi/${s.id}`} className="font-semibold text-primary hover:underline">
                        {s.invoiceNo}
                      </Link>
                    </Td>
                    <Td className="text-ink-muted">{formatTimeID(s.saleDate)}</Td>
                    <Td className="text-ink-muted">{s.outlet.code}</Td>
                    <Td className="text-ink-muted">{s.user.name}</Td>
                    <Td className="text-right tabular-nums">{s._count.items}</Td>
                    <Td className="text-right font-semibold tabular-nums">{formatRp(dec(s.total))}</Td>
                    <Td className="text-right tabular-nums text-success">{formatRp(dec(s.grossProfit))}</Td>
                    <Td className="text-ink-muted">{PAYMENT_LABELS[s.paymentMethod]}</Td>
                    <Td>{s.status === "VOID" ? <Badge tone="danger">VOID</Badge> : <Badge tone="success">OK</Badge>}</Td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
        </TableWrap>
      </Card>
    </>
  );
}
