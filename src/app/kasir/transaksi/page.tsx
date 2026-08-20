import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireKasir } from "@/lib/auth";
import { dec } from "@/lib/serialize";
import { addDays, parseDateInput, rangeForPreset, witaDateKey } from "@/lib/dates";
import { formatDateID, formatRp, formatTimeID } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyRow, Table, TableWrap, Td, Th } from "@/components/ui/table";

export const dynamic = "force-dynamic";

/** Riwayat transaksi yang dibuat kasir ini sendiri (PRD §3.2). */
export default async function KasirTransaksiPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireKasir();
  const sp = await searchParams;
  const tanggal = typeof sp.tanggal === "string" ? sp.tanggal : witaDateKey(new Date());
  const from = parseDateInput(tanggal) ?? rangeForPreset("hari-ini").from;
  const to = addDays(from, 1);

  const sales = await prisma.sale.findMany({
    where: { userId: user.id, outletId: user.outletId, saleDate: { gte: from, lt: to } },
    orderBy: { saleDate: "desc" },
    include: { _count: { select: { items: true } } },
  });

  const totalHari = sales.filter((s) => s.status === "COMPLETED").reduce((sum, s) => sum + dec(s.total), 0);

  return (
    <>
      <PageHeader
        title="Riwayat Transaksi Saya"
        description={`${formatDateID(from)} · ${sales.length} transaksi · omzet ${formatRp(totalHari)}`}
        actions={
          <form className="flex items-center gap-2">
            <input
              type="date"
              name="tanggal"
              defaultValue={tanggal}
              className="h-10 rounded-lg border border-line bg-surface px-3 text-sm text-ink"
            />
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
                <Th className="text-right">Item</Th>
                <Th className="text-right">Total</Th>
                <Th>Bayar</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {sales.length === 0 ? (
                <EmptyRow colSpan={6}>Tidak ada transaksi pada tanggal ini.</EmptyRow>
              ) : (
                sales.map((s) => (
                  <tr key={s.id}>
                    <Td>
                      <Link href={`/kasir/transaksi/${s.id}`} className="font-semibold text-primary hover:underline">
                        {s.invoiceNo}
                      </Link>
                    </Td>
                    <Td className="text-ink-muted">{formatTimeID(s.saleDate)}</Td>
                    <Td className="text-right tabular-nums">{s._count.items}</Td>
                    <Td className="text-right font-semibold tabular-nums">{formatRp(dec(s.total))}</Td>
                    <Td className="text-ink-muted">{s.paymentMethod === "CASH" ? "Tunai" : s.paymentMethod}</Td>
                    <Td>{s.status === "VOID" ? <Badge tone="danger">VOID</Badge> : <Badge tone="success">OK</Badge>}</Td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
        </TableWrap>
      </Card>

      <p className="mt-3 text-xs text-ink-faint">
        Perlu membatalkan transaksi? Hubungi owner — void hanya bisa dilakukan owner dan tercatat di audit log.
      </p>
    </>
  );
}
