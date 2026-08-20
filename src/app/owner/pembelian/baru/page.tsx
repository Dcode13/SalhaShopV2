import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/auth";
import { dec } from "@/lib/serialize";
import { witaDateKey } from "@/lib/dates";
import { PageHeader } from "@/components/ui/page-header";
import { PurchaseForm, type PurchaseProduct } from "./purchase-form";

export const dynamic = "force-dynamic";

export default async function PembelianBaruPage() {
  await requireOwner();

  const [outlets, suppliers, products] = await Promise.all([
    prisma.outlet.findMany({ where: { isActive: true }, orderBy: { code: "asc" } }),
    prisma.supplier.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.product.findMany({
      where: { isActive: true },
      include: { units: { orderBy: { conversion: "asc" } }, inventories: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const formProducts: PurchaseProduct[] = products.map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    baseUnit: p.baseUnit,
    units: p.units.map((u) => ({ unitName: u.unitName, conversion: dec(u.conversion) })),
    avgCostByOutlet: Object.fromEntries(p.inventories.map((inv) => [inv.outletId, dec(inv.avgCost)])),
  }));

  return (
    <>
      <PageHeader
        title="Nota Pembelian Baru"
        description="Nota disimpan sebagai DRAFT dulu — stok baru bertambah saat tombol Terima Barang ditekan"
      />
      <PurchaseForm
        outlets={outlets.map((o) => ({ id: o.id, name: o.name }))}
        suppliers={suppliers.map((s) => ({ id: s.id, name: s.name }))}
        products={formProducts}
        today={witaDateKey(new Date())}
      />
    </>
  );
}
