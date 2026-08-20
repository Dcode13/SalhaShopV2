import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireKasir } from "@/lib/auth";
import { dec } from "@/lib/serialize";
import { getSettingNumber, SETTING_KEYS } from "@/lib/settings";
import { buttonClass } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { PosClient, type PosProduct } from "./pos-client";

export const dynamic = "force-dynamic";

export default async function PosPage() {
  const user = await requireKasir();

  const [session, outlet, maxDiscount] = await Promise.all([
    prisma.cashSession.findFirst({
      where: { userId: user.id, outletId: user.outletId, status: "OPEN" },
      select: { id: true },
    }),
    prisma.outlet.findUniqueOrThrow({ where: { id: user.outletId } }),
    getSettingNumber(SETTING_KEYS.maxDiscountKasir),
  ]);

  if (!session) {
    return (
      <div className="mx-auto max-w-md pt-16">
        <Card>
          <CardBody className="flex flex-col items-center gap-3 py-10 text-center">
            <span className="flex size-14 items-center justify-center rounded-2xl bg-warn-soft text-warn">
              <AlertTriangle className="size-7" />
            </span>
            <h2 className="text-lg font-extrabold text-ink">Shift belum dibuka</h2>
            <p className="text-sm text-ink-muted">
              Sebelum melayani transaksi, buka shift dulu dan catat kas awal laci.
            </p>
            <Link href="/kasir/shift" className={buttonClass("primary", "lg", "mt-2")}>
              Buka Shift Sekarang
            </Link>
          </CardBody>
        </Card>
      </div>
    );
  }

  const products = await prisma.product.findMany({
    where: {
      isActive: true,
      inventories: { some: { outletId: user.outletId } },
      prices: { some: { outletId: user.outletId, isActive: true } },
    },
    include: {
      category: { select: { id: true, name: true } },
      units: { orderBy: { conversion: "asc" } },
      prices: { where: { outletId: user.outletId, isActive: true } },
      inventories: { where: { outletId: user.outletId }, select: { qty: true } },
    },
    orderBy: { name: "asc" },
  });

  const posProducts: PosProduct[] = products.map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    barcode: p.barcode,
    baseUnit: p.baseUnit,
    categoryId: p.category.id,
    categoryName: p.category.name,
    stock: dec(p.inventories[0]?.qty),
    units: p.units.map((u) => ({ unitName: u.unitName, conversion: dec(u.conversion) })),
    prices: p.prices.map((pr) => ({
      unitName: pr.unitName,
      minQty: dec(pr.minQty),
      price: dec(pr.price),
      priceType: pr.priceType,
    })),
  }));

  const categories = [...new Map(posProducts.map((p) => [p.categoryId, p.categoryName])).entries()].map(
    ([id, name]) => ({ id, name })
  );

  return (
    <PosClient
      products={posProducts}
      categories={categories}
      maxDiscount={maxDiscount}
      isGrosir={outlet.type === "GROSIR"}
    />
  );
}
