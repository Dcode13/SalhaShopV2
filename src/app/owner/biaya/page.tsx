import { redirect } from "next/navigation";
import { Wallet } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/auth";
import { dec } from "@/lib/serialize";
import { parseDateInput, rangeForPreset, witaDateKey } from "@/lib/dates";
import { formatDateID, formatRp } from "@/lib/format";
import { createExpense } from "@/server/actions/expenses";
import { createExpenseCategory } from "@/server/actions/master";
import { PeriodFilter, parsePeriodParams } from "@/components/period-filter";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyRow, Table, TableWrap, Td, Th } from "@/components/ui/table";
import { Input, Label, Select } from "@/components/ui/field";
import { DeleteExpenseButton } from "./delete-expense-button";

export const dynamic = "force-dynamic";

export default async function BiayaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireOwner();
  const sp = await searchParams;
  const params = parsePeriodParams({ ...sp, periode: sp.periode ?? "bulan-ini" });
  const range = rangeForPreset(params.periode, parseDateInput(params.from), parseDateInput(params.to));
  const error = typeof sp.error === "string" ? sp.error : null;

  const [outlets, categories, expenses] = await Promise.all([
    prisma.outlet.findMany({ where: { isActive: true }, orderBy: { code: "asc" } }),
    prisma.expenseCategory.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.expense.findMany({
      where: {
        expenseDate: { gte: range.from, lt: range.to },
        ...(params.outlet ? { outletId: params.outlet } : {}),
      },
      orderBy: { expenseDate: "desc" },
      take: 300,
      include: {
        category: { select: { name: true } },
        outlet: { select: { code: true } },
        user: { select: { name: true } },
      },
    }),
  ]);

  const total = expenses.reduce((s, e) => s + dec(e.amount), 0);

  return (
    <>
      <PageHeader
        title="Biaya Operasional"
        description={`Total periode: ${formatRp(total)} — pembelian stok barang TIDAK dicatat di sini (itu lewat modul Pembelian)`}
      />

      <PeriodFilter basePath="/owner/biaya" current={params} outlets={outlets.map((o) => ({ id: o.id, name: o.name }))} />

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="self-start">
          <CardHeader
            title={
              <span className="inline-flex items-center gap-2">
                <Wallet className="size-4 text-primary" /> Input Biaya
              </span>
            }
            description="Sewa, listrik, gaji, retribusi, transport, dll."
          />
          <CardBody>
            <form
              action={async (fd: FormData) => {
                "use server";
                const outletRaw = String(fd.get("outletId") ?? "");
                const res = await createExpense({
                  outletId: outletRaw === "SHARED" ? null : outletRaw,
                  categoryId: String(fd.get("categoryId") ?? ""),
                  expenseDate: String(fd.get("expenseDate") ?? ""),
                  amount: Number(fd.get("amount") ?? 0),
                  description: String(fd.get("description") ?? ""),
                  isRecurring: fd.get("isRecurring") === "on",
                });
                if (!res.ok) redirect(`/owner/biaya?error=${encodeURIComponent(res.error)}`);
                redirect("/owner/biaya");
              }}
              className="space-y-3"
            >
              <div>
                <Label>Dibebankan ke</Label>
                <Select name="outletId" defaultValue={outlets[0]?.id}>
                  {outlets.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                  <option value="SHARED">Biaya bersama (gabungan)</option>
                </Select>
              </div>
              <div>
                <Label>Kategori</Label>
                <Select name="categoryId">
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Tanggal</Label>
                <Input type="date" name="expenseDate" defaultValue={witaDateKey(new Date())} required />
              </div>
              <div>
                <Label>Nominal</Label>
                <Input type="number" name="amount" min={1} placeholder="0" required className="text-right" />
              </div>
              <div>
                <Label>Keterangan</Label>
                <Input name="description" placeholder="cth: listrik kios Agustus" required />
              </div>
              <label className="flex items-center gap-2 text-xs font-semibold text-ink-muted">
                <input type="checkbox" name="isRecurring" className="size-4 accent-[var(--primary)]" />
                Biaya rutin bulanan
              </label>
              {error ? <p className="rounded-lg bg-danger-soft px-3 py-2 text-xs font-semibold text-red-800">{error}</p> : null}
              <button
                type="submit"
                className="h-11 w-full rounded-lg bg-primary text-sm font-bold text-primary-fg hover:bg-primary-strong"
              >
                Simpan Biaya
              </button>
            </form>

            <div className="mt-4 border-t border-line pt-3">
              <form
                action={async (fd: FormData) => {
                  "use server";
                  await createExpenseCategory(String(fd.get("name") ?? ""));
                  redirect("/owner/biaya");
                }}
                className="flex gap-2"
              >
                <input
                  name="name"
                  placeholder="+ kategori biaya baru"
                  className="h-9 flex-1 rounded-lg border border-line bg-surface px-3 text-xs text-ink"
                  required
                />
                <button type="submit" className="h-9 rounded-lg border border-line px-3 text-xs font-bold text-ink-muted hover:border-primary hover:text-primary">
                  Tambah
                </button>
              </form>
            </div>
          </CardBody>
        </Card>

        <Card className="xl:col-span-2">
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Tanggal</Th>
                  <Th>Kategori</Th>
                  <Th>Keterangan</Th>
                  <Th>Outlet</Th>
                  <Th className="text-right">Nominal</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {expenses.length === 0 ? (
                  <EmptyRow colSpan={6}>Belum ada biaya di periode ini.</EmptyRow>
                ) : (
                  expenses.map((e) => (
                    <tr key={e.id}>
                      <Td className="text-ink-muted">{formatDateID(e.expenseDate)}</Td>
                      <Td>
                        <Badge tone="primary">{e.category.name}</Badge>
                        {e.isRecurring ? (
                          <Badge tone="info" className="ml-1">
                            RUTIN
                          </Badge>
                        ) : null}
                      </Td>
                      <Td>
                        <p>{e.description}</p>
                        <p className="text-[11px] text-ink-faint">oleh {e.user.name}</p>
                      </Td>
                      <Td className="text-ink-muted">{e.outlet?.code ?? <Badge tone="neutral">BERSAMA</Badge>}</Td>
                      <Td className="text-right font-semibold tabular-nums">{formatRp(dec(e.amount))}</Td>
                      <Td>
                        <DeleteExpenseButton
                          expenseId={e.id}
                          label={`${formatDateID(e.expenseDate)} · ${e.category.name} · ${e.description} · ${formatRp(dec(e.amount))}`}
                        />
                      </Td>
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
