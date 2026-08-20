import Link from "next/link";
import { PackagePlus, Search } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/auth";
import { dec } from "@/lib/serialize";
import { formatNumber } from "@/lib/format";
import { toggleProductActive } from "@/server/actions/products";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyRow, Table, TableWrap, Td, Th } from "@/components/ui/table";
import { buttonClass } from "@/components/ui/button";
import { DeleteProductButton } from "./delete-product-button";

export const dynamic = "force-dynamic";

export default async function ProdukListPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireOwner();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const kategori = typeof sp.kategori === "string" ? sp.kategori : "";

  const [categories, products, total] = await Promise.all([
    prisma.category.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.product.findMany({
      where: {
        ...(kategori ? { categoryId: kategori } : {}),
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { sku: { contains: q, mode: "insensitive" } },
                { barcode: { equals: q } },
              ],
            }
          : {}),
      },
      include: {
        category: { select: { name: true } },
        inventories: { include: { outlet: { select: { code: true } } } },
        _count: { select: { prices: true, saleItems: true, purchaseItems: true } },
      },
      orderBy: { name: "asc" },
      take: 200,
    }),
    prisma.product.count(),
  ]);

  return (
    <>
      <PageHeader
        title="Master Produk"
        description={`${total} produk terdaftar`}
        actions={
          <Link href="/owner/produk/baru" className={buttonClass("primary", "md")}>
            <PackagePlus className="size-4" /> Produk Baru
          </Link>
        }
      />

      <form className="mb-4 flex flex-wrap gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint" />
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Cari nama / SKU / barcode…"
            className="h-10 w-64 rounded-lg border border-line bg-surface pl-9 pr-3 text-sm text-ink"
          />
        </div>
        <select
          name="kategori"
          defaultValue={kategori}
          className="h-10 rounded-lg border border-line bg-surface px-3 text-sm text-ink"
        >
          <option value="">Semua kategori</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button type="submit" className={buttonClass("outline", "md")}>
          Filter
        </button>
      </form>

      <Card>
        <TableWrap>
          <Table>
            <thead>
              <tr>
                <Th>SKU</Th>
                <Th>Nama</Th>
                <Th>Kategori</Th>
                <Th className="text-right">Stok per Outlet</Th>
                <Th>Harga</Th>
                <Th>Status</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {products.length === 0 ? (
                <EmptyRow colSpan={7}>Tidak ada produk. Klik “Produk Baru” untuk mulai input.</EmptyRow>
              ) : (
                products.map((p) => (
                  <tr key={p.id} className={p.isActive ? "" : "opacity-50"}>
                    <Td className="font-mono text-xs text-ink-muted">{p.sku}</Td>
                    <Td>
                      <Link href={`/owner/produk/${p.id}`} className="font-semibold text-primary hover:underline">
                        {p.name}
                      </Link>
                    </Td>
                    <Td className="text-ink-muted">{p.category.name}</Td>
                    <Td className="text-right">
                      {p.inventories.length === 0 ? (
                        <span className="text-xs text-ink-faint">—</span>
                      ) : (
                        <div className="flex flex-col items-end gap-0.5">
                          {p.inventories.map((inv) => (
                            <span key={inv.id} className="text-xs tabular-nums">
                              <span className="font-semibold text-ink-faint">{inv.outlet.code}</span>{" "}
                              <span className="font-bold">{formatNumber(dec(inv.qty))}</span> {p.baseUnit}
                            </span>
                          ))}
                        </div>
                      )}
                    </Td>
                    <Td>
                      {p._count.prices === 0 ? (
                        <Badge tone="danger">BELUM ADA HARGA</Badge>
                      ) : (
                        <Badge tone="success">{p._count.prices} harga</Badge>
                      )}
                    </Td>
                    <Td>{p.isActive ? <Badge tone="success">AKTIF</Badge> : <Badge tone="neutral">NONAKTIF</Badge>}</Td>
                    <Td>
                      <div className="flex items-center justify-end gap-2">
                        <form
                          action={async () => {
                            "use server";
                            await toggleProductActive(p.id);
                          }}
                        >
                          <button type="submit" className="text-xs font-bold text-ink-muted hover:text-primary">
                            {p.isActive ? "Nonaktifkan" : "Aktifkan"}
                          </button>
                        </form>
                        <DeleteProductButton
                          productId={p.id}
                          productName={p.name}
                          sku={p.sku}
                          hasHistory={p._count.saleItems > 0 || p._count.purchaseItems > 0}
                          isActive={p.isActive}
                          stockNote={
                            p.inventories
                              .filter((inv) => dec(inv.qty) > 0)
                              .map((inv) => `${inv.outlet.code} ${formatNumber(dec(inv.qty))} ${p.baseUnit}`)
                              .join(" · ") || null
                          }
                          iconOnly
                        />
                      </div>
                    </Td>
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
