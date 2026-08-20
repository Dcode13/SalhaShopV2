import { prisma } from "@/lib/prisma";
import { requireKasir } from "@/lib/auth";
import { dec } from "@/lib/serialize";
import { formatDateTimeID, formatRp } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyRow, Table, TableWrap, Td, Th } from "@/components/ui/table";
import { ShiftClient } from "./shift-client";

export const dynamic = "force-dynamic";

export default async function ShiftPage() {
  const user = await requireKasir();

  const [open, history] = await Promise.all([
    prisma.cashSession.findFirst({
      where: { userId: user.id, outletId: user.outletId, status: "OPEN" },
    }),
    prisma.cashSession.findMany({
      where: { userId: user.id, status: "CLOSED" },
      orderBy: { closedAt: "desc" },
      take: 7,
    }),
  ]);

  return (
    <>
      <PageHeader title="Shift Kasir" description="Buka shift dengan kas awal, tutup shift dengan hitung kas fisik." />

      <div className="grid gap-4 lg:grid-cols-2">
        <ShiftClient
          openSession={
            open
              ? {
                  openedAt: open.openedAt.toISOString(),
                  openingCash: dec(open.openingCash),
                  cashSales: dec(open.cashSales),
                  nonCashSales: dec(open.nonCashSales),
                  cashExpenses: dec(open.cashExpenses),
                  totalTx: open.totalTx,
                }
              : null
          }
        />

        <Card>
          <CardHeader title="Riwayat 7 Shift Terakhir" description="Selisih = kas fisik − kas seharusnya" />
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Ditutup</Th>
                  <Th className="text-right">Omzet Tunai</Th>
                  <Th className="text-right">Kas Seharusnya</Th>
                  <Th className="text-right">Selisih</Th>
                </tr>
              </thead>
              <tbody>
                {history.length === 0 ? (
                  <EmptyRow colSpan={4}>Belum ada shift yang ditutup.</EmptyRow>
                ) : (
                  history.map((s) => {
                    const diff = dec(s.difference);
                    return (
                      <tr key={s.id}>
                        <Td className="text-ink-muted">{s.closedAt ? formatDateTimeID(s.closedAt) : "-"}</Td>
                        <Td className="text-right tabular-nums">{formatRp(dec(s.cashSales))}</Td>
                        <Td className="text-right tabular-nums">{formatRp(dec(s.expectedCash))}</Td>
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
      </div>
    </>
  );
}
