import Link from "next/link";
import { Search } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/auth";
import { dec } from "@/lib/serialize";
import { formatNumber, formatRp } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyRow, Table, TableWrap, Td, Th } from "@/components/ui/table";
import { buttonClass } from "@/components/ui/button";
import { AdjustStockButton } from "./adjust-button";

export const dynamic = "force-dynamic";

/** Stok semua outlet — kolom HPP & nilai stok hanya di halaman owner ini (PRD §8.5). */
export default async function OwnerStokPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireOwner();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const outletId = typeof sp.outlet === "string" && sp.outlet ? sp.outlet : "";
  const kategori = typeof sp.kategori === "string" && sp.kategori ? sp.kategori : "";

  const [outlets, categories, inventories] = await Promise.all([
    prisma.outlet.findMany({ where: { isActive: true }, orderBy: { code: "asc" } }),
    prisma.category.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.inventory.findMany({
      where: {
        ...(outletId ? { outletId } : {}),
        product: {
          isActive: true,
          ...(kategori ? { categoryId: kategori } : {}),
          ...(q
            ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { sku: { contains: q, mode: "insensitive" } }] }
            : {}),
        },
      },
      include: {
        product: { select: { id: true, name: true, sku: true, baseUnit: true, category: { select: { name: true } } } },
        outlet: { select: { name: true, code: true } },
      },
      orderBy: { product: { name: "asc" } },
      take: 400,
    }),
  ]);

  const totalValue = inventories.reduce((s, inv) => s + dec(inv.qty) * dec(inv.avgCost), 0);

  return (
    <>
      <PageHeader
        title="Manajemen Stok"
        description={`Nilai stok tampilan ini: ${formatRp(totalValue)}`}
        actions={
          <Link href="/owner/pembelian/baru" className={buttonClass("primary", "md")}>
            + Pembelian / Restock
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
            placeholder="Cari nama / SKU…"
            className="h-10 w-56 rounded-lg border border-line bg-surface pl-9 pr-3 text-sm text-ink"
          />
        </div>
        <select name="outlet" defaultValue={outletId} className="h-10 rounded-lg border border-line bg-surface px-3 text-sm text-ink">
          <option value="">Semua outlet</option>
          {outlets.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
        <select name="kategori" defaultValue={kategori} className="h-10 rounded-lg border border-line bg-surface px-3 text-sm text-ink">
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
                <Th>Produk</Th>
                <Th>Outlet</Th>
                <Th className="text-right">Stok</Th>
                <Th>Status</Th>
                <Th className="text-right">HPP Rata-rata</Th>
                <Th className="text-right">Nilai Stok</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {inventories.length === 0 ? (
                <EmptyRow colSpan={7}>Tidak ada data stok.</EmptyRow>
              ) : (
                inventories.map((inv) => {
                  const qty = dec(inv.qty);
                  const min = dec(inv.minStock);
                  const avgCost = dec(inv.avgCost);
                  const status = qty <= 0 ? "habis" : min > 0 && qty <= min ? "menipis" : "aman";
                  return (
                    <tr key={inv.id}>
                      <Td>
                        <Link href={`/owner/produk/${inv.product.id}`} className="font-semibold text-primary hover:underline">
                          {inv.product.name}
                        </Link>
                        <p className="text-[11px] text-ink-faint">
                          {inv.product.sku} · {inv.product.category.name}
                        </p>
                      </Td>
                      <Td className="text-ink-muted">{inv.outlet.code}</Td>
                      <Td className="text-right font-bold tabular-nums">
                        {formatNumber(qty)} {inv.product.baseUnit}
                      </Td>
                      <Td>
                        <Badge tone={status === "habis" ? "danger" : status === "menipis" ? "warn" : "success"}>
                          {status.toUpperCase()}
                        </Badge>
                      </Td>
                      <Td className="text-right tabular-nums">
                        {avgCost > 0 ? formatRp(avgCost) : <Badge tone="danger">HPP KOSONG</Badge>}
                      </Td>
                      <Td className="text-right font-semibold tabular-nums">{formatRp(qty * avgCost)}</Td>
                      <Td>
                        <AdjustStockButton
                          productId={inv.product.id}
                          outletId={inv.outletId}
                          productName={inv.product.name}
                          outletName={inv.outlet.name}
                          currentQty={qty}
                          baseUnit={inv.product.baseUnit}
                        />
                      </Td>
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
