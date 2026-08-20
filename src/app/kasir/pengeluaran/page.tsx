import { prisma } from "@/lib/prisma";
import { requireKasir } from "@/lib/auth";
import { dec } from "@/lib/serialize";
import { rangeForPreset } from "@/lib/dates";
import { formatRp, formatTimeID } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyRow, Table, TableWrap, Td, Th } from "@/components/ui/table";
import { PengeluaranForm } from "./pengeluaran-form";

export const dynamic = "force-dynamic";

export default async function PengeluaranPage() {
  const user = await requireKasir();
  const today = rangeForPreset("hari-ini");

  const [categories, todayExpenses] = await Promise.all([
    prisma.expenseCategory.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.expense.findMany({
      where: { userId: user.id, expenseDate: { gte: today.from, lt: today.to } },
      orderBy: { expenseDate: "desc" },
      include: { category: { select: { name: true } } },
    }),
  ]);

  const total = todayExpenses.reduce((s, e) => s + dec(e.amount), 0);

  return (
    <>
      <PageHeader
        title="Catat Pengeluaran"
        description="Kas keluar kecil dari laci (parkir, kresek, dll). Mengurangi kas seharusnya saat tutup shift."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <PengeluaranForm categories={categories.map((c) => ({ id: c.id, name: c.name }))} />

        <Card>
          <CardHeader title="Pengeluaran Saya Hari Ini" description={`Total ${formatRp(total)}`} />
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Jam</Th>
                  <Th>Kategori</Th>
                  <Th>Keterangan</Th>
                  <Th className="text-right">Nominal</Th>
                </tr>
              </thead>
              <tbody>
                {todayExpenses.length === 0 ? (
                  <EmptyRow colSpan={4}>Belum ada pengeluaran hari ini.</EmptyRow>
                ) : (
                  todayExpenses.map((e) => (
                    <tr key={e.id}>
                      <Td className="text-ink-muted">{formatTimeID(e.expenseDate)}</Td>
                      <Td>{e.category.name}</Td>
                      <Td className="text-ink-muted">{e.description}</Td>
                      <Td className="text-right font-semibold tabular-nums">{formatRp(dec(e.amount))}</Td>
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
