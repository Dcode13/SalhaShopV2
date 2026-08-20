import { redirect } from "next/navigation";
import { Truck } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/auth";
import { saveSupplier, toggleSupplier } from "@/server/actions/master";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyRow, Table, TableWrap, Td, Th } from "@/components/ui/table";
import { Input, Label, Textarea } from "@/components/ui/field";

export const dynamic = "force-dynamic";

export default async function SupplierPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireOwner();
  const sp = await searchParams;
  const editId = typeof sp.edit === "string" ? sp.edit : null;
  const error = typeof sp.error === "string" ? sp.error : null;

  const suppliers = await prisma.supplier.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { purchases: true } } },
  });
  const editing = editId ? suppliers.find((s) => s.id === editId) : null;

  return (
    <>
      <PageHeader title="Supplier" description="Data grosir / distributor langganan untuk modul pembelian" />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="self-start">
          <CardHeader
            title={
              <span className="inline-flex items-center gap-2">
                <Truck className="size-4 text-primary" /> {editing ? `Edit: ${editing.name}` : "Supplier Baru"}
              </span>
            }
          />
          <CardBody>
            <form
              action={async (fd: FormData) => {
                "use server";
                const res = await saveSupplier({
                  id: editing?.id,
                  name: String(fd.get("name") ?? ""),
                  phone: String(fd.get("phone") ?? ""),
                  address: String(fd.get("address") ?? ""),
                  note: String(fd.get("note") ?? ""),
                });
                if (!res.ok) redirect(`/owner/supplier?error=${encodeURIComponent(res.error)}`);
                redirect("/owner/supplier");
              }}
              className="space-y-3"
            >
              <div>
                <Label htmlFor="s-name">Nama *</Label>
                <Input id="s-name" name="name" defaultValue={editing?.name ?? ""} required placeholder="cth: Toko Grosir Berkah" />
              </div>
              <div>
                <Label htmlFor="s-phone">Telepon</Label>
                <Input id="s-phone" name="phone" defaultValue={editing?.phone ?? ""} placeholder="08xx…" />
              </div>
              <div>
                <Label htmlFor="s-address">Alamat</Label>
                <Input id="s-address" name="address" defaultValue={editing?.address ?? ""} />
              </div>
              <div>
                <Label htmlFor="s-note">Catatan</Label>
                <Textarea id="s-note" name="note" defaultValue={editing?.note ?? ""} placeholder="cth: bisa hutang 2 minggu" />
              </div>
              {error ? <p className="rounded-lg bg-danger-soft px-3 py-2 text-xs font-semibold text-red-800">{error}</p> : null}
              <div className="flex gap-2">
                <button type="submit" className="h-10 flex-1 rounded-lg bg-primary text-sm font-bold text-primary-fg hover:bg-primary-strong">
                  {editing ? "Simpan Perubahan" : "Tambah Supplier"}
                </button>
                {editing ? (
                  <a href="/owner/supplier" className="flex h-10 items-center rounded-lg border border-line px-4 text-sm font-bold text-ink-muted hover:border-primary">
                    Batal
                  </a>
                ) : null}
              </div>
            </form>
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Nama</Th>
                  <Th>Telepon</Th>
                  <Th className="text-right">Nota Pembelian</Th>
                  <Th>Status</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {suppliers.length === 0 ? (
                  <EmptyRow colSpan={5}>Belum ada supplier.</EmptyRow>
                ) : (
                  suppliers.map((s) => (
                    <tr key={s.id} className={s.isActive ? "" : "opacity-50"}>
                      <Td>
                        <a href={`/owner/supplier?edit=${s.id}`} className="font-semibold text-primary hover:underline">
                          {s.name}
                        </a>
                        {s.note ? <p className="text-[11px] text-ink-faint">{s.note}</p> : null}
                      </Td>
                      <Td className="text-ink-muted">{s.phone ?? "—"}</Td>
                      <Td className="text-right tabular-nums">{s._count.purchases}</Td>
                      <Td>{s.isActive ? <Badge tone="success">AKTIF</Badge> : <Badge tone="neutral">NONAKTIF</Badge>}</Td>
                      <Td>
                        <form
                          action={async () => {
                            "use server";
                            await toggleSupplier(s.id);
                          }}
                        >
                          <button type="submit" className="text-xs font-bold text-ink-muted hover:text-primary">
                            {s.isActive ? "Nonaktifkan" : "Aktifkan"}
                          </button>
                        </form>
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
