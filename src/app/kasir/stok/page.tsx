import { Search } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireKasir } from "@/lib/auth";
import { dec } from "@/lib/serialize";
import { formatNumber } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyRow, Table, TableWrap, Td, Th } from "@/components/ui/table";

export const dynamic = "force-dynamic";

/** Stok outlet kasir — read-only, TANPA kolom HPP/nilai stok (PRD §3.2). */
export default async function KasirStokPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireKasir();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";

  const inventories = await prisma.inventory.findMany({
    where: {
      outletId: user.outletId,
      product: {
        isActive: true,
        ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { sku: { contains: q, mode: "insensitive" } }] } : {}),
      },
    },
    include: {
      product: { select: { name: true, sku: true, baseUnit: true, category: { select: { name: true } } } },
    },
    orderBy: { product: { name: "asc" } },
    take: 300,
  });

  return (
    <>
      <PageHeader title="Stok Outlet" description={`${user.outletName} · hanya lihat, tidak bisa mengubah`} />

      <form className="mb-4 max-w-sm">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint" />
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Cari nama / SKU…"
            className="h-11 w-full rounded-lg border border-line bg-surface pl-9 pr-3 text-sm text-ink"
          />
        </div>
      </form>

      <Card>
        <TableWrap>
          <Table>
            <thead>
              <tr>
                <Th>Produk</Th>
                <Th>Kategori</Th>
                <Th className="text-right">Stok</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {inventories.length === 0 ? (
                <EmptyRow colSpan={4}>Tidak ada produk.</EmptyRow>
              ) : (
                inventories.map((inv) => {
                  const qty = dec(inv.qty);
                  const min = dec(inv.minStock);
                  const status = qty <= 0 ? "habis" : min > 0 && qty <= min ? "menipis" : "aman";
                  return (
                    <tr key={inv.id}>
                      <Td>
                        <p className="font-semibold">{inv.product.name}</p>
                        <p className="text-[11px] text-ink-faint">{inv.product.sku}</p>
                      </Td>
                      <Td className="text-ink-muted">{inv.product.category.name}</Td>
                      <Td className="text-right font-semibold tabular-nums">
                        {formatNumber(qty)} {inv.product.baseUnit}
                      </Td>
                      <Td>
                        <Badge tone={status === "habis" ? "danger" : status === "menipis" ? "warn" : "success"}>
                          {status.toUpperCase()}
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
    </>
  );
}
