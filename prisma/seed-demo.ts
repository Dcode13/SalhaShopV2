/**
 * Seed DEMO (opsional): beberapa produk contoh + stok awal, supaya aplikasi
 * bisa langsung dicoba. Jalankan SETELAH `npm run db:seed`:
 *
 *   npm run db:seed:demo
 *
 * ⚠️ Jangan jalankan di data produksi yang sudah berisi produk sungguhan.
 */
import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

type DemoUnit = { unitName: string; conversion: number };
type DemoOutletData = {
  stock: number; // dalam base unit
  cost: number; // HPP per base unit
  retail: number; // harga eceran per base unit
  tiers?: { unitName: string; minQty: number; price: number }[];
  minStock?: number;
};
type DemoProduct = {
  sku: string;
  name: string;
  category: string;
  baseUnit: string;
  units?: DemoUnit[];
  grosir?: DemoOutletData;
  kios?: DemoOutletData;
};

const products: DemoProduct[] = [
  {
    sku: "SEM-0001",
    name: "Beras Premium 5kg",
    category: "Sembako",
    baseUnit: "sak",
    kios: { stock: 20, cost: 62000, retail: 68000, minStock: 5 },
    grosir: { stock: 40, cost: 61000, retail: 67000, minStock: 10 },
  },
  {
    sku: "SEM-0002",
    name: "Minyak Goreng 1L",
    category: "Sembako",
    baseUnit: "pcs",
    units: [{ unitName: "dus", conversion: 12 }],
    kios: { stock: 36, cost: 15500, retail: 18000, minStock: 12 },
    grosir: {
      stock: 120,
      cost: 15200,
      retail: 17500,
      tiers: [{ unitName: "dus", minQty: 1, price: 198000 }],
      minStock: 24,
    },
  },
  {
    sku: "SEM-0003",
    name: "Gula Pasir 1kg",
    category: "Sembako",
    baseUnit: "pcs",
    kios: { stock: 25, cost: 16000, retail: 18000, minStock: 10 },
  },
  {
    sku: "MIN-0001",
    name: "Air Mineral 600ml",
    category: "Minuman",
    baseUnit: "botol",
    units: [{ unitName: "dus", conversion: 24 }],
    kios: {
      stock: 96,
      cost: 2500,
      retail: 4000,
      tiers: [{ unitName: "dus", minQty: 1, price: 75000 }],
      minStock: 24,
    },
  },
  {
    sku: "ROK-0001",
    name: "Rokok Surya 16",
    category: "Rokok",
    baseUnit: "bungkus",
    units: [{ unitName: "slop", conversion: 10 }],
    kios: {
      stock: 50,
      cost: 30500,
      retail: 33000,
      tiers: [{ unitName: "slop", minQty: 1, price: 320000 }],
      minStock: 10,
    },
  },
  {
    sku: "PLS-0001",
    name: "Gelas Plastik AQ",
    category: "Plastik & Kemasan",
    baseUnit: "pcs",
    units: [
      { unitName: "lusin", conversion: 12 },
      { unitName: "dus", conversion: 144 },
    ],
    grosir: {
      stock: 720,
      cost: 900,
      retail: 1500,
      tiers: [
        { unitName: "lusin", minQty: 1, price: 15000 },
        { unitName: "dus", minQty: 1, price: 155000 },
      ],
      minStock: 144,
    },
  },
  {
    sku: "DAP-0001",
    name: "Wajan Aluminium 30cm",
    category: "Alat Dapur",
    baseUnit: "pcs",
    grosir: {
      stock: 15,
      cost: 42000,
      retail: 60000,
      tiers: [{ unitName: "pcs", minQty: 6, price: 52000 }],
      minStock: 3,
    },
  },
  {
    sku: "KEB-0001",
    name: "Sunlight 400ml",
    category: "Kebersihan",
    baseUnit: "pcs",
    units: [{ unitName: "dus", conversion: 24 }],
    kios: { stock: 24, cost: 9500, retail: 12000, minStock: 6 },
    grosir: {
      stock: 72,
      cost: 9200,
      retail: 11500,
      tiers: [{ unitName: "dus", minQty: 1, price: 250000 }],
      minStock: 24,
    },
  },
];

async function seedOutletData(
  productId: string,
  baseUnit: string,
  outletId: string,
  userId: string,
  data: DemoOutletData
) {
  await prisma.inventory.upsert({
    where: { productId_outletId: { productId, outletId } },
    update: {},
    create: {
      productId,
      outletId,
      qty: new Prisma.Decimal(data.stock),
      avgCost: new Prisma.Decimal(data.cost),
      minStock: new Prisma.Decimal(data.minStock ?? 0),
    },
  });

  if (data.stock > 0) {
    await prisma.stockMovement.create({
      data: {
        productId,
        outletId,
        userId,
        type: "INITIAL",
        qtyChange: new Prisma.Decimal(data.stock),
        qtyBefore: new Prisma.Decimal(0),
        qtyAfter: new Prisma.Decimal(data.stock),
        costPerUnit: new Prisma.Decimal(data.cost),
        avgCostAfter: new Prisma.Decimal(data.cost),
        referenceType: "SEED",
        note: "Stok awal (seed demo)",
      },
    });
  }

  await prisma.productPrice.upsert({
    where: {
      productId_outletId_priceType_unitName_minQty: {
        productId,
        outletId,
        priceType: "RETAIL",
        unitName: baseUnit,
        minQty: new Prisma.Decimal(1),
      },
    },
    update: { price: new Prisma.Decimal(data.retail) },
    create: {
      productId,
      outletId,
      priceType: "RETAIL",
      unitName: baseUnit,
      minQty: new Prisma.Decimal(1),
      price: new Prisma.Decimal(data.retail),
    },
  });

  for (const tier of data.tiers ?? []) {
    await prisma.productPrice.upsert({
      where: {
        productId_outletId_priceType_unitName_minQty: {
          productId,
          outletId,
          priceType: "WHOLESALE",
          unitName: tier.unitName,
          minQty: new Prisma.Decimal(tier.minQty),
        },
      },
      update: { price: new Prisma.Decimal(tier.price) },
      create: {
        productId,
        outletId,
        priceType: "WHOLESALE",
        unitName: tier.unitName,
        minQty: new Prisma.Decimal(tier.minQty),
        price: new Prisma.Decimal(tier.price),
      },
    });
  }
}

async function main() {
  const owner = await prisma.user.findFirst({ where: { role: "OWNER" } });
  const grosir = await prisma.outlet.findUnique({ where: { code: "GROSIR" } });
  const kios = await prisma.outlet.findUnique({ where: { code: "KIOS" } });
  if (!owner || !grosir || !kios) {
    throw new Error("Jalankan `npm run db:seed` dulu (outlet & user belum ada).");
  }

  for (const p of products) {
    const category = await prisma.category.upsert({
      where: { name: p.category },
      update: {},
      create: { name: p.category },
    });

    const product = await prisma.product.upsert({
      where: { sku: p.sku },
      update: {},
      create: {
        sku: p.sku,
        name: p.name,
        categoryId: category.id,
        baseUnit: p.baseUnit,
      },
    });

    await prisma.productUnit.upsert({
      where: { productId_unitName: { productId: product.id, unitName: p.baseUnit } },
      update: {},
      create: {
        productId: product.id,
        unitName: p.baseUnit,
        conversion: new Prisma.Decimal(1),
        isBase: true,
      },
    });
    for (const u of p.units ?? []) {
      await prisma.productUnit.upsert({
        where: { productId_unitName: { productId: product.id, unitName: u.unitName } },
        update: {},
        create: {
          productId: product.id,
          unitName: u.unitName,
          conversion: new Prisma.Decimal(u.conversion),
        },
      });
    }

    if (p.grosir) await seedOutletData(product.id, p.baseUnit, grosir.id, owner.id, p.grosir);
    if (p.kios) await seedOutletData(product.id, p.baseUnit, kios.id, owner.id, p.kios);

    console.log(`  + ${p.sku} ${p.name}`);
  }

  console.log("✅ Seed demo selesai (8 produk contoh).");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
