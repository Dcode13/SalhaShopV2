import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Copy } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/auth";
import { storageConfigured } from "@/lib/storage";
import { dec } from "@/lib/serialize";
import { formatDateTimeID, formatNumber, formatRp } from "@/lib/format";
import { MOVEMENT_LABELS } from "@/lib/labels";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyRow, Table, TableWrap, Td, Th } from "@/components/ui/table";
import { buttonClass } from "@/components/ui/button";
import { ProductForm } from "../product-form";
import { buildProductInitial } from "../form-data";
import { DeleteProductButton } from "../delete-product-button";

export const dynamic = "force-dynamic";

export default async function ProdukDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireOwner();
  const { id } = await params;

  const [product, initial, categories, outlets, movements] = await Promise.all([
    prisma.product.findUnique({
      where: { id },
      include: {
        inventories: { include: { outlet: { select: { name: true } } } },
        _count: { select: { saleItems: true, purchaseItems: true } },
      },
    }),
    buildProductInitial(id),
    prisma.category.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
    prisma.outlet.findMany({ where: { isActive: true }, orderBy: { code: "asc" } }),
    prisma.stockMovement.findMany({
      where: { productId: id },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { outlet: { select: { code: true } }, user: { select: { name: true } } },
    }),
  ]);

  if (!product || !initial) notFound();

  const hasHistory =
    product._count.saleItems > 0 || product._count.purchaseItems > 0 || movements.some((m) => m.type !== "INITIAL");
  const stockNote =
    product.inventories
      .filter((inv) => dec(inv.qty) > 0)
      .map((inv) => `${inv.outlet.name} ${formatNumber(dec(inv.qty))} ${product.baseUnit}`)
      .join(" · ") || null;

  return (
    <>
      <PageHeader
        title={product.name}
        description={`SKU ${product.sku} · satuan dasar: ${product.baseUnit}`}
        actions={
          <>
            <Link href="/owner/produk" className={buttonClass("ghost", "sm")}>
              <ArrowLeft className="size-4" /> Daftar Produk
            </Link>
            <Link href={`/owner/produk/baru?dari=${product.id}`} className={buttonClass("soft", "sm")}>
              <Copy className="size-4" /> Duplikat Produk Ini
            </Link>
            <DeleteProductButton
              productId={product.id}
              productName={product.name}
              sku={product.sku}
              hasHistory={hasHistory}
              isActive={product.isActive}
              stockNote={stockNote}
              redirectTo="/owner/produk"
            />
          </>
        }
      />

      {/* stok & HPP per outlet (hanya owner yang melihat HPP) */}
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        {product.inventories.map((inv) => (
          <div key={inv.id} className="rounded-xl border border-line bg-surface p-4 shadow-card">
            <p className="text-xs font-bold text-ink-muted">{inv.outlet.name}</p>
            <div className="mt-1 flex items-end justify-between">
              <p className="text-xl font-extrabold text-ink tabular-nums">
                {formatNumber(dec(inv.qty))} <span className="text-sm font-semibold text-ink-muted">{product.baseUnit}</span>
              </p>
              <div className="text-right text-xs">
                <p className="text-ink-muted">
                  HPP: <span className="font-bold text-ink">{formatRp(dec(inv.avgCost))}</span>
                </p>
                <p className="text-ink-muted">
                  Nilai stok: <span className="font-bold text-ink">{formatRp(dec(inv.qty) * dec(inv.avgCost))}</span>
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 2xl:grid-cols-2">
        <div>
          <ProductForm
            categories={categories.map((c) => ({ id: c.id, name: c.name }))}
            outlets={outlets.map((o) => ({ id: o.id, name: o.name }))}
            productId={product.id}
            initial={initial}
            storageReady={storageConfigured()}
          />
        </div>

        <Card className="self-start">
          <CardHeader title="Kartu Stok" description="50 mutasi terakhir (ledger stock_movements)" />
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Waktu</Th>
                  <Th>Jenis</Th>
                  <Th>Outlet</Th>
                  <Th className="text-right">Perubahan</Th>
                  <Th className="text-right">Saldo</Th>
                  <Th>Oleh</Th>
                </tr>
              </thead>
              <tbody>
                {movements.length === 0 ? (
                  <EmptyRow colSpan={6}>Belum ada mutasi stok.</EmptyRow>
                ) : (
                  movements.map((m) => {
                    const meta = MOVEMENT_LABELS[m.type] ?? { label: m.type, tone: "neutral" as const };
                    const change = dec(m.qtyChange);
                    return (
                      <tr key={m.id}>
                        <Td className="whitespace-nowrap text-xs text-ink-muted">{formatDateTimeID(m.createdAt)}</Td>
                        <Td>
                          <Badge tone={meta.tone}>{meta.label}</Badge>
                        </Td>
                        <Td className="text-ink-muted">{m.outlet.code}</Td>
                        <Td className={`text-right font-bold tabular-nums ${change >= 0 ? "text-success" : "text-danger"}`}>
                          {change >= 0 ? "+" : ""}
                          {formatNumber(change)}
                        </Td>
                        <Td className="text-right tabular-nums">{formatNumber(dec(m.qtyAfter))}</Td>
                        <Td className="text-xs text-ink-muted">{m.user.name}</Td>
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
