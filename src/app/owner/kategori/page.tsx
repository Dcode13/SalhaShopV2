import { redirect } from "next/navigation";
import { Tags } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/auth";
import { createCategory, renameCategory, toggleCategory } from "@/server/actions/master";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyRow, Table, TableWrap, Td, Th } from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function KategoriPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireOwner();
  const sp = await searchParams;
  const error = typeof sp.error === "string" ? sp.error : null;

  const categories = await prisma.category.findMany({
    orderBy: { sortOrder: "asc" },
    include: { _count: { select: { products: true } } },
  });

  return (
    <>
      <PageHeader title="Kategori Produk" description="Kelompok produk untuk filter POS & laporan" />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="self-start">
          <CardHeader
            title={
              <span className="inline-flex items-center gap-2">
                <Tags className="size-4 text-primary" /> Kategori Baru
              </span>
            }
          />
          <CardBody>
            <form
              action={async (fd: FormData) => {
                "use server";
                const res = await createCategory(String(fd.get("name") ?? ""));
                if (!res.ok) redirect(`/owner/kategori?error=${encodeURIComponent(res.error)}`);
                redirect("/owner/kategori");
              }}
              className="flex gap-2"
            >
              <input
                name="name"
                required
                placeholder="cth: Sembako"
                className="h-10 flex-1 rounded-lg border border-line bg-surface px-3 text-sm text-ink"
              />
              <button type="submit" className="h-10 rounded-lg bg-primary px-4 text-sm font-bold text-primary-fg hover:bg-primary-strong">
                Tambah
              </button>
            </form>
            {error ? <p className="mt-2 rounded-lg bg-danger-soft px-3 py-2 text-xs font-semibold text-red-800">{error}</p> : null}
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Nama</Th>
                  <Th className="text-right">Jumlah Produk</Th>
                  <Th>Status</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {categories.length === 0 ? (
                  <EmptyRow colSpan={4}>Belum ada kategori.</EmptyRow>
                ) : (
                  categories.map((c) => (
                    <tr key={c.id} className={c.isActive ? "" : "opacity-50"}>
                      <Td>
                        <form
                          action={async (fd: FormData) => {
                            "use server";
                            await renameCategory(c.id, String(fd.get("name") ?? ""));
                          }}
                          className="flex items-center gap-2"
                        >
                          <input
                            name="name"
                            defaultValue={c.name}
                            className="h-9 w-48 rounded-lg border border-transparent bg-transparent px-2 text-sm font-semibold text-ink hover:border-line focus:border-primary focus:bg-surface"
                          />
                          <button type="submit" className="text-xs font-bold text-ink-faint hover:text-primary">
                            Simpan
                          </button>
                        </form>
                      </Td>
                      <Td className="text-right tabular-nums">{c._count.products}</Td>
                      <Td>{c.isActive ? <Badge tone="success">AKTIF</Badge> : <Badge tone="neutral">NONAKTIF</Badge>}</Td>
                      <Td>
                        <form
                          action={async () => {
                            "use server";
                            await toggleCategory(c.id);
                          }}
                        >
                          <button type="submit" className="text-xs font-bold text-ink-muted hover:text-primary">
                            {c.isActive ? "Nonaktifkan" : "Aktifkan"}
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
