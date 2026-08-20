import "server-only";
import { prisma } from "@/lib/prisma";
import { dec } from "@/lib/serialize";
import type { ProductFormInitial } from "./product-form";

/** Susun nilai awal form dari produk yang sudah ada (untuk edit / duplikat). */
export async function buildProductInitial(productId: string, forDuplicate = false): Promise<ProductFormInitial | null> {
  const p = await prisma.product.findUnique({
    where: { id: productId },
    include: {
      units: true,
      prices: { where: { isActive: true } },
      inventories: true,
    },
  });
  if (!p) return null;

  const outletIds = new Set<string>([
    ...p.prices.map((pr) => pr.outletId),
    ...p.inventories.map((inv) => inv.outletId),
  ]);

  const perOutlet: ProductFormInitial["perOutlet"] = {};
  for (const outletId of outletIds) {
    const inv = p.inventories.find((i) => i.outletId === outletId);
    const retail = p.prices.find(
      (pr) => pr.outletId === outletId && pr.priceType === "RETAIL" && pr.unitName === p.baseUnit
    );
    const tiers = p.prices
      .filter((pr) => pr.outletId === outletId && !(pr.priceType === "RETAIL" && pr.unitName === p.baseUnit))
      .map((pr) => ({ unitName: pr.unitName, minQty: dec(pr.minQty), price: dec(pr.price) }));

    perOutlet[outletId] = {
      initialStock: 0, // stok tidak ikut diduplikat/diedit lewat form
      initialStockUnit: p.baseUnit,
      initialCost: 0,
      retailPrice: retail ? dec(retail.price) : 0,
      tiers,
      minStock: inv ? dec(inv.minStock) : 0,
    };
  }

  return {
    name: forDuplicate ? `${p.name} ` : p.name,
    categoryId: p.categoryId,
    sku: "", // SKU selalu auto/diisi baru
    barcode: forDuplicate ? "" : (p.barcode ?? ""),
    baseUnit: p.baseUnit,
    description: p.description ?? "",
    imageUrl: forDuplicate ? "" : (p.imageUrl ?? ""), // duplikat = produk beda → foto baru

    units: p.units.filter((u) => !u.isBase).map((u) => ({ unitName: u.unitName, conversion: dec(u.conversion) })),
    outletBlocks: null,
    enabledOutletIds: [...outletIds],
    perOutlet,
  };
}
