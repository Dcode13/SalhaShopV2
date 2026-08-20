"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { deleteByPublicUrl } from "@/lib/storage";
import { dec } from "@/lib/serialize";
import { round2, round4 } from "@/lib/utils";

export type ProductActionResult =
  | { ok: true; productId: string }
  | { ok: false; error: string; duplicateWarning?: boolean };

const unitSchema = z.object({
  unitName: z.string().trim().min(1, "Nama satuan wajib"),
  conversion: z.number().positive("Isi konversi harus > 0"),
});

const tierSchema = z.object({
  unitName: z.string().trim().min(1),
  minQty: z.number().positive(),
  price: z.number().positive("Harga tier harus > 0"),
});

const outletBlockSchema = z.object({
  outletId: z.string().min(1),
  initialStock: z.number().min(0),
  initialStockUnit: z.string().trim().min(1),
  initialCost: z.number().min(0), // HPP per satuan `initialStockUnit`
  retailPrice: z.number().positive("Harga eceran wajib > 0"),
  tiers: z.array(tierSchema).default([]),
  minStock: z.number().min(0).default(0),
});

const productSchema = z.object({
  name: z.string().trim().min(1, "Nama produk wajib diisi"),
  categoryId: z.string().min(1, "Kategori wajib dipilih"),
  sku: z.string().trim().optional(),
  barcode: z.string().trim().optional(),
  baseUnit: z.string().trim().min(1, "Satuan dasar wajib diisi"),
  description: z.string().trim().max(500).optional(),
  imageUrl: z.string().trim().url("URL foto tidak valid").optional(),
  units: z.array(unitSchema).default([]),
  outlets: z.array(outletBlockSchema).min(1, "Pilih minimal satu outlet tempat produk dijual"),
  confirmDuplicate: z.boolean().default(false),
});

export type ProductInput = z.infer<typeof productSchema>;

async function generateSku(tx: Prisma.TransactionClient, categoryName: string): Promise<string> {
  const prefix =
    categoryName
      .replace(/[^a-zA-Z]/g, "")
      .toUpperCase()
      .slice(0, 3)
      .padEnd(3, "X") || "PRD";
  const count = await tx.product.count({ where: { sku: { startsWith: `${prefix}-` } } });
  for (let i = count + 1; i < count + 1000; i++) {
    const sku = `${prefix}-${String(i).padStart(4, "0")}`;
    const exists = await tx.product.findUnique({ where: { sku }, select: { id: true } });
    if (!exists) return sku;
  }
  throw new Error("Gagal generate SKU");
}

function convFor(baseUnit: string, units: { unitName: string; conversion: number }[], unitName: string): number {
  if (unitName === baseUnit) return 1;
  const u = units.find((x) => x.unitName === unitName);
  if (!u) throw new Error(`Satuan "${unitName}" tidak terdaftar di produk ini.`);
  return u.conversion;
}

/**
 * Simpan produk baru — SATU transaksi atomik (PRD §8.6):
 * products + product_units + inventories + stock_movements INITIAL + product_prices.
 * Validasi keras: stok awal > 0 wajib disertai HPP > 0.
 */
export async function createProduct(input: ProductInput): Promise<ProductActionResult> {
  const user = await requireOwner();
  const parsed = productSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Input tidak valid" };
  const data = parsed.data;

  // satuan tambahan tidak boleh duplikat / sama dengan base
  const unitNames = new Set<string>([data.baseUnit]);
  for (const u of data.units) {
    if (unitNames.has(u.unitName)) return { ok: false, error: `Satuan "${u.unitName}" dobel.` };
    unitNames.add(u.unitName);
  }

  // ⚠️ Validasi paling penting: stok awal > 0 harus punya harga modal
  for (const o of data.outlets) {
    if (o.initialStock > 0 && o.initialCost <= 0) {
      return { ok: false, error: "Stok awal > 0 wajib disertai harga modal (HPP). Ini kunci laporan laba yang benar." };
    }
  }

  // peringatan duplikat nama dalam kategori yang sama (boleh lanjut dengan konfirmasi)
  if (!data.confirmDuplicate) {
    const dup = await prisma.product.findFirst({
      where: { categoryId: data.categoryId, name: { equals: data.name, mode: "insensitive" } },
      select: { name: true, sku: true },
    });
    if (dup) {
      return {
        ok: false,
        duplicateWarning: true,
        error: `Produk "${dup.name}" (${dup.sku}) sudah ada di kategori ini. Simpan juga?`,
      };
    }
  }

  try {
    const productId = await prisma.$transaction(async (tx) => {
      const category = await tx.category.findUniqueOrThrow({ where: { id: data.categoryId } });
      const sku = data.sku && data.sku.length > 0 ? data.sku : await generateSku(tx, category.name);

      const product = await tx.product.create({
        data: {
          sku,
          barcode: data.barcode || null,
          name: data.name,
          categoryId: data.categoryId,
          baseUnit: data.baseUnit,
          description: data.description || null,
          imageUrl: data.imageUrl || null,
          units: {
            create: [
              { unitName: data.baseUnit, conversion: new Prisma.Decimal(1), isBase: true },
              ...data.units.map((u) => ({
                unitName: u.unitName,
                conversion: new Prisma.Decimal(u.conversion),
              })),
            ],
          },
        },
      });

      for (const o of data.outlets) {
        const conv = convFor(data.baseUnit, data.units, o.initialStockUnit);
        const qtyBase = round4(o.initialStock * conv);
        const costBase = conv > 0 ? round2(o.initialCost / conv) : 0;

        await tx.inventory.create({
          data: {
            productId: product.id,
            outletId: o.outletId,
            qty: new Prisma.Decimal(qtyBase),
            avgCost: new Prisma.Decimal(qtyBase > 0 ? costBase : 0),
            minStock: new Prisma.Decimal(o.minStock),
          },
        });

        if (qtyBase > 0) {
          await tx.stockMovement.create({
            data: {
              productId: product.id,
              outletId: o.outletId,
              userId: user.id,
              type: "INITIAL",
              qtyChange: new Prisma.Decimal(qtyBase),
              qtyBefore: new Prisma.Decimal(0),
              qtyAfter: new Prisma.Decimal(qtyBase),
              costPerUnit: new Prisma.Decimal(costBase),
              avgCostAfter: new Prisma.Decimal(costBase),
              referenceType: "INITIAL",
              referenceId: product.id,
              note: "Stok awal input produk",
            },
          });
        }

        // harga eceran (per base unit) + tier grosir
        await tx.productPrice.create({
          data: {
            productId: product.id,
            outletId: o.outletId,
            priceType: "RETAIL",
            unitName: data.baseUnit,
            minQty: new Prisma.Decimal(1),
            price: new Prisma.Decimal(o.retailPrice),
          },
        });
        for (const tier of o.tiers) {
          convFor(data.baseUnit, data.units, tier.unitName); // validasi satuan tier
          await tx.productPrice.create({
            data: {
              productId: product.id,
              outletId: o.outletId,
              priceType: "WHOLESALE",
              unitName: tier.unitName,
              minQty: new Prisma.Decimal(tier.minQty),
              price: new Prisma.Decimal(tier.price),
            },
          });
        }
      }

      await logAudit(
        { userId: user.id, action: "CREATE", entityType: "Product", entityId: product.id, newValue: { sku, name: data.name } },
        tx
      );
      return product.id;
    });

    revalidatePath("/owner/produk");
    revalidatePath("/owner/stok");
    revalidatePath("/owner/kelengkapan");
    return { ok: true, productId };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, error: "SKU atau barcode sudah dipakai produk lain." };
    }
    console.error("createProduct gagal:", e);
    return { ok: false, error: e instanceof Error ? e.message : "Gagal menyimpan produk." };
  }
}

/** Update identitas + satuan + harga + stok minimum. Stok & HPP TIDAK diubah di sini. */
export async function updateProduct(productId: string, input: ProductInput): Promise<ProductActionResult> {
  const user = await requireOwner();
  const parsed = productSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Input tidak valid" };
  const data = parsed.data;

  let replacedImageUrl: string | null = null;
  try {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.product.findUniqueOrThrow({ where: { id: productId }, include: { units: true } });
      if (existing.imageUrl && existing.imageUrl !== (data.imageUrl || null)) {
        replacedImageUrl = existing.imageUrl; // foto lama dihapus dari storage setelah commit
      }

      await tx.product.update({
        where: { id: productId },
        data: {
          name: data.name,
          categoryId: data.categoryId,
          barcode: data.barcode || null,
          description: data.description || null,
          imageUrl: data.imageUrl || null,
          ...(data.sku ? { sku: data.sku } : {}),
        },
      });

      // ganti satuan tambahan (satuan dasar tidak boleh berubah — riwayat qtyBase tersimpan dlm satuan ini)
      await tx.productUnit.deleteMany({ where: { productId, isBase: false } });
      for (const u of data.units) {
        if (u.unitName === existing.baseUnit) continue;
        await tx.productUnit.create({
          data: { productId, unitName: u.unitName, conversion: new Prisma.Decimal(u.conversion) },
        });
      }

      // ganti seluruh harga per outlet yang dicentang
      await tx.productPrice.deleteMany({ where: { productId } });
      for (const o of data.outlets) {
        await tx.productPrice.create({
          data: {
            productId,
            outletId: o.outletId,
            priceType: "RETAIL",
            unitName: existing.baseUnit,
            minQty: new Prisma.Decimal(1),
            price: new Prisma.Decimal(o.retailPrice),
          },
        });
        for (const tier of o.tiers) {
          await tx.productPrice.create({
            data: {
              productId,
              outletId: o.outletId,
              priceType: "WHOLESALE",
              unitName: tier.unitName,
              minQty: new Prisma.Decimal(tier.minQty),
              price: new Prisma.Decimal(tier.price),
            },
          });
        }
        // pastikan record inventory ada + update ambang minimum
        await tx.inventory.upsert({
          where: { productId_outletId: { productId, outletId: o.outletId } },
          update: { minStock: new Prisma.Decimal(o.minStock) },
          create: {
            productId,
            outletId: o.outletId,
            qty: new Prisma.Decimal(0),
            avgCost: new Prisma.Decimal(0),
            minStock: new Prisma.Decimal(o.minStock),
          },
        });
      }

      await logAudit(
        { userId: user.id, action: "UPDATE", entityType: "Product", entityId: productId, newValue: { name: data.name } },
        tx
      );
    });

    if (replacedImageUrl) await deleteByPublicUrl(replacedImageUrl);

    revalidatePath("/owner/produk");
    revalidatePath(`/owner/produk/${productId}`);
    revalidatePath("/owner/stok");
    return { ok: true, productId };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, error: "SKU atau barcode sudah dipakai produk lain." };
    }
    console.error("updateProduct gagal:", e);
    return { ok: false, error: "Gagal menyimpan perubahan produk." };
  }
}

export type DeleteProductResult =
  | { ok: true }
  | { ok: false; error: string; canDeactivate?: boolean };

class DeleteBlocked extends Error {
  constructor(
    public canDeactivate: boolean,
    message: string
  ) {
    super(message);
  }
}

/**
 * Hapus produk PERMANEN — hanya untuk produk yang belum pernah dipakai
 * transaksi apa pun (penjualan/pembelian/opname/transfer/koreksi stok).
 * Produk ber-riwayat harus dinonaktifkan saja (soft delete, PRD §6.2d)
 * supaya laporan laba historis & kartu stok tetap utuh.
 * Catatan stok awal (movement INITIAL) ikut terhapus — dianggap pembatalan
 * salah input, dan penghapusan tercatat di audit log.
 */
export async function deleteProduct(productId: string): Promise<DeleteProductResult> {
  const user = await requireOwner();
  let imageToDelete: string | null = null;
  try {
    await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({
        where: { id: productId },
        include: {
          _count: {
            select: { saleItems: true, purchaseItems: true, opnameItems: true, transferItems: true },
          },
        },
      });
      if (!product) throw new DeleteBlocked(false, "Produk tidak ditemukan.");
      imageToDelete = product.imageUrl;

      const c = product._count;
      const hasTx = c.saleItems > 0 || c.purchaseItems > 0 || c.opnameItems > 0 || c.transferItems > 0;
      const nonInitialMoves = hasTx
        ? 1
        : await tx.stockMovement.count({ where: { productId, type: { not: "INITIAL" } } });
      if (hasTx || nonInitialMoves > 0) {
        throw new DeleteBlocked(
          true,
          `"${product.name}" sudah punya riwayat transaksi/mutasi stok — tidak bisa dihapus permanen agar laporan laba dan kartu stok tetap utuh. Nonaktifkan saja.`
        );
      }

      await tx.stockMovement.deleteMany({ where: { productId } }); // hanya catatan INITIAL stok awal
      await tx.inventory.deleteMany({ where: { productId } });
      await tx.product.delete({ where: { id: productId } }); // product_units & product_prices ikut terhapus (cascade)

      await logAudit(
        {
          userId: user.id,
          action: "DELETE",
          entityType: "Product",
          entityId: productId,
          oldValue: { sku: product.sku, name: product.name, categoryId: product.categoryId },
        },
        tx
      );
    });

    if (imageToDelete) await deleteByPublicUrl(imageToDelete);

    revalidatePath("/owner/produk");
    revalidatePath("/owner/stok");
    revalidatePath("/owner/kelengkapan");
    return { ok: true };
  } catch (e) {
    if (e instanceof DeleteBlocked) {
      return { ok: false, error: e.message, canDeactivate: e.canDeactivate };
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2003") {
      // jaring pengaman FK RESTRICT bila ada relasi yang lolos pre-check
      return {
        ok: false,
        canDeactivate: true,
        error: "Produk masih terhubung ke data lain sehingga tidak bisa dihapus permanen. Nonaktifkan saja.",
      };
    }
    console.error("deleteProduct gagal:", e);
    return { ok: false, error: "Gagal menghapus produk." };
  }
}

export async function toggleProductActive(productId: string): Promise<void> {
  const user = await requireOwner();
  const product = await prisma.product.findUniqueOrThrow({ where: { id: productId } });
  await prisma.product.update({ where: { id: productId }, data: { isActive: !product.isActive } });
  await logAudit({
    userId: user.id,
    action: "UPDATE",
    entityType: "Product",
    entityId: productId,
    oldValue: { isActive: product.isActive },
    newValue: { isActive: !product.isActive },
  });
  revalidatePath("/owner/produk");
}

/**
 * Penyesuaian stok manual oleh owner (barang rusak/hilang/koreksi).
 * ADJUSTMENT_OUT otomatis dicatat sebagai biaya "Kerugian Stok" (PRD §8.5).
 */
export async function adjustStock(input: {
  productId: string;
  outletId: string;
  direction: "IN" | "OUT";
  qtyBase: number;
  reason: string;
}): Promise<{ ok: boolean; error?: string }> {
  const user = await requireOwner();
  const { productId, outletId, direction } = input;
  const qtyBase = round4(input.qtyBase);
  const reason = input.reason?.trim();
  if (!(qtyBase > 0)) return { ok: false, error: "Qty harus > 0" };
  if (!reason || reason.length < 3) return { ok: false, error: "Alasan penyesuaian wajib diisi." };

  try {
    await prisma.$transaction(async (tx) => {
      const inv = await tx.inventory.findUnique({
        where: { productId_outletId: { productId, outletId } },
        include: { product: { select: { name: true } } },
      });
      if (!inv) throw new Error("Produk belum punya record stok di outlet ini.");

      if (direction === "OUT") {
        const updated = await tx.inventory.updateMany({
          where: { productId, outletId, qty: { gte: new Prisma.Decimal(qtyBase) } },
          data: { qty: { decrement: new Prisma.Decimal(qtyBase) } },
        });
        if (updated.count === 0) throw new Error("Stok tidak cukup untuk dikurangi.");
      } else {
        await tx.inventory.update({
          where: { productId_outletId: { productId, outletId } },
          data: { qty: { increment: new Prisma.Decimal(qtyBase) } },
        });
      }

      const after = await tx.inventory.findUniqueOrThrow({
        where: { productId_outletId: { productId, outletId } },
        select: { qty: true, avgCost: true },
      });
      const qtyAfter = dec(after.qty);
      const avgCost = dec(after.avgCost);
      const signed = direction === "IN" ? qtyBase : -qtyBase;

      const movement = await tx.stockMovement.create({
        data: {
          productId,
          outletId,
          userId: user.id,
          type: direction === "IN" ? "ADJUSTMENT_IN" : "ADJUSTMENT_OUT",
          qtyChange: new Prisma.Decimal(signed),
          qtyBefore: new Prisma.Decimal(round4(qtyAfter - signed)),
          qtyAfter: new Prisma.Decimal(qtyAfter),
          costPerUnit: new Prisma.Decimal(avgCost),
          avgCostAfter: after.avgCost,
          referenceType: "ADJUSTMENT",
          note: reason,
        },
      });

      // kerugian stok → biaya operasional kategori "Kerugian Stok"
      if (direction === "OUT" && avgCost > 0) {
        const lossCat = await tx.expenseCategory.upsert({
          where: { name: "Kerugian Stok" },
          update: {},
          create: { name: "Kerugian Stok" },
        });
        await tx.expense.create({
          data: {
            outletId,
            categoryId: lossCat.id,
            userId: user.id,
            expenseDate: new Date(),
            amount: new Prisma.Decimal(round2(qtyBase * avgCost)),
            description: `Penyesuaian stok ${inv.product.name}: ${reason}`,
          },
        });
      }

      await logAudit(
        {
          userId: user.id,
          action: "UPDATE",
          entityType: "Inventory",
          entityId: movement.id,
          newValue: { productId, outletId, direction, qtyBase, reason },
        },
        tx
      );
    });

    revalidatePath("/owner/stok");
    revalidatePath("/owner/biaya");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Gagal menyesuaikan stok." };
  }
}

/** Tandai permintaan produk dari kasir sebagai selesai/ditolak. */
export async function resolveProductRequest(requestId: string, status: "APPROVED" | "REJECTED"): Promise<void> {
  await requireOwner();
  await prisma.productRequest.update({
    where: { id: requestId },
    data: { status, resolvedAt: new Date() },
  });
  revalidatePath("/owner/kelengkapan");
}
