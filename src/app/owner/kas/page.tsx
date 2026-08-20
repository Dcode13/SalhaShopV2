import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/auth";
import { dec } from "@/lib/serialize";
import { formatDateTimeID, formatRp } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyRow, Table, TableWrap, Td, Th } from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function KasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireOwner();
  const sp = await searchParams;
  const outletId = typeof sp.outlet === "string" && sp.outlet ? sp.outlet : "";

  const [outlets, sessions] = await Promise.all([
    prisma.outlet.findMany({ where: { isActive: true }, orderBy: { code: "asc" } }),
    prisma.cashSession.findMany({
      where: outletId ? { outletId } : {},
      orderBy: { openedAt: "desc" },
      take: 60,
      include: { outlet: { select: { code: true } }, user: { select: { name: true } } },
    }),
  ]);

  return (
    <>
      <PageHeader
        title="Kas & Shift"
        description="Riwayat shift kasir kedua outlet + hasil rekonsiliasi kas"
        actions={
          <form className="flex items-center gap-2">
            <select name="outlet" defaultValue={outletId} className="h-10 rounded-lg border border-line bg-surface px-3 text-sm text-ink">
              <option value="">Semua outlet</option>
              {outlets.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
            <button type="submit" className="h-10 rounded-lg border border-line bg-surface px-4 text-sm font-bold text-ink-muted hover:border-primary hover:text-primary">
              Filter
            </button>
          </form>
        }
      />

      <Card>
        <TableWrap>
          <Table>
            <thead>
              <tr>
                <Th>Outlet</Th>
                <Th>Kasir</Th>
                <Th>Dibuka</Th>
                <Th>Ditutup</Th>
                <Th className="text-right">Kas Awal</Th>
                <Th className="text-right">Tunai</Th>
                <Th className="text-right">Non-tunai</Th>
                <Th className="text-right">Kas Keluar</Th>
                <Th className="text-right">Seharusnya</Th>
                <Th className="text-right">Fisik</Th>
                <Th className="text-right">Selisih</Th>
                <Th className="text-right">Tx</Th>
              </tr>
            </thead>
            <tbody>
              {sessions.length === 0 ? (
                <EmptyRow colSpan={12}>Belum ada shift.</EmptyRow>
              ) : (
                sessions.map((s) => {
                  const diff = s.difference === null ? null : dec(s.difference);
                  return (
                    <tr key={s.id}>
                      <Td className="font-semibold">{s.outlet.code}</Td>
                      <Td className="text-ink-muted">{s.user.name}</Td>
                      <Td className="whitespace-nowrap text-xs text-ink-muted">{formatDateTimeID(s.openedAt)}</Td>
                      <Td className="whitespace-nowrap text-xs text-ink-muted">
                        {s.closedAt ? formatDateTimeID(s.closedAt) : <Badge tone="info">MASIH BUKA</Badge>}
                      </Td>
                      <Td className="text-right tabular-nums">{formatRp(dec(s.openingCash))}</Td>
                      <Td className="text-right tabular-nums">{formatRp(dec(s.cashSales))}</Td>
                      <Td className="text-right tabular-nums">{formatRp(dec(s.nonCashSales))}</Td>
                      <Td className="text-right tabular-nums">{formatRp(dec(s.cashExpenses))}</Td>
                      <Td className="text-right tabular-nums">{s.status === "CLOSED" ? formatRp(dec(s.expectedCash)) : "—"}</Td>
                      <Td className="text-right tabular-nums">{s.actualCash !== null ? formatRp(dec(s.actualCash)) : "—"}</Td>
                      <Td className="text-right">
                        {diff === null ? (
                          "—"
                        ) : (
                          <Badge tone={diff === 0 ? "success" : diff < 0 ? "danger" : "warn"}>
                            {diff > 0 ? "+" : ""}
                            {formatRp(diff)}
                          </Badge>
                        )}
                      </Td>
                      <Td className="text-right tabular-nums">{s.totalTx}</Td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </Table>
        </TableWrap>
      </Card>
    </>
  );
}
