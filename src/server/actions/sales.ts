"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireKasir, requireOwner } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { dec } from "@/lib/serialize";
import { round2, round4 } from "@/lib/utils";
import { witaDateKey, witaStartOfMonth, witaStartOfNextMonth } from "@/lib/dates";
import { getSettingNumber, SETTING_KEYS } from "@/lib/settings";

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

class SaleError extends Error {}

const saleItemSchema = z.object({
  productId: z.string().min(1),
  unitName: z.string().min(1),
  qty: z.number().positive("Qty harus > 0"),
  discount: z.number().min(0).default(0),
});

const createSaleSchema = z.object({
  items: z.array(saleItemSchema).min(1, "Keranjang masih kosong"),
  discount: z.number().min(0).default(0),
  paymentMethod: z.enum(["CASH", "TRANSFER", "QRIS"]),
  paidAmount: z.number().min(0),
  note: z.string().max(500).optional(),
});

export type CreateSaleInput = z.infer<typeof createSaleSchema>;
export type CreateSaleResult = { saleId: string; invoiceNo: string; changeAmount: number };

function buildInvoiceNo(prefix: string, date: Date, seq: number) {
  const key = witaDateKey(date);
  return `${prefix}/${key.slice(0, 4)}/${key.slice(5, 7)}/${String(seq).padStart(4, "0")}`;
}

/**
 * Transaksi penjualan POS — SATU transaksi database atomik (PRD §8.3):
 *  1. Harga & HPP di-resolve ulang DI SERVER (input client tidak dipercaya)
 *  2. Insert sales + sale_items (cost_at_sale = snapshot inventories.avgCost)
 *  3. Insert stock_movements SALE_OUT per item
 *  4. Kurangi inventories.qty dengan guard `qty >= n` (anti race condition)
 *  5. Akumulasi omzet ke cash_sessions shift yang sedang OPEN
 * Kalau salah satu gagal → semua rollback.
 */
export async function createSale(input: CreateSaleInput): Promise<ActionResult<CreateSaleResult>> {
  const user = await requireKasir();

  const parsed = createSaleSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Input tidak valid" };
  }
  const data = parsed.data;
  const outletId = user.outletId;

  const maxDiscount = await getSettingNumber(SETTING_KEYS.maxDiscountKasir);
  const totalDiscount = data.discount + data.items.reduce((s, i) => s + i.discount, 0);
  if (totalDiscount > 0 && totalDiscount > maxDiscount) {
    return {
      ok: false,
      error: `Total diskon melebihi batas kasir (maks Rp ${maxDiscount.toLocaleString("id-ID")}).`,
    };
  }

  // Retry untuk tabrakan nomor invoice (unique) saat dua kasir simpan bersamaan
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const result = await prisma.$transaction(async (tx) => {
        const session = await tx.cashSession.findFirst({
          where: { userId: user.id, outletId, status: "OPEN" },
        });
        if (!session) throw new SaleError("Shift belum dibuka. Buka shift dulu di menu Shift Kasir.");

        const outlet = await tx.outlet.findUniqueOrThrow({ where: { id: outletId } });

        const now = new Date();
        const monthStart = witaStartOfMonth(now);
        const monthEnd = witaStartOfNextMonth(now);
        const seq = await tx.sale.count({
          where: { outletId, saleDate: { gte: monthStart, lt: monthEnd } },
        });
        const invoiceNo = buildInvoiceNo(outlet.code, now, seq + 1);

        let subtotal = 0;
        let totalCost = 0;
        const itemRows: Prisma.SaleItemCreateWithoutSaleInput[] = [];
        const stockOps: { productId: string; qtyBase: number; costAtSale: number; name: string }[] = [];

        for (const item of data.items) {
          const product = await tx.product.findUnique({
            where: { id: item.productId },
            include: {
              units: true,
              prices: { where: { outletId, isActive: true } },
              inventories: { where: { outletId } },
            },
          });
          if (!product || !product.isActive) throw new SaleError("Produk tidak ditemukan / nonaktif.");

          // konversi satuan → base unit
          let conversion = 1;
          if (item.unitName !== product.baseUnit) {
            const unit = product.units.find((u) => u.unitName === item.unitName);
            if (!unit) throw new SaleError(`Satuan "${item.unitName}" tidak dikenal untuk ${product.name}.`);
            conversion = dec(unit.conversion);
          }
          const qtyBase = round4(item.qty * conversion);
          if (qtyBase <= 0) throw new SaleError(`Qty tidak valid untuk ${product.name}.`);

          const inventory = product.inventories[0];
          if (!inventory) throw new SaleError(`${product.name} belum punya stok di outlet ini.`);

          // resolve harga di server: tier dengan minQty terpenuhi tertinggi
          const unitPrices = product.prices
            .filter((p) => p.unitName === item.unitName && dec(p.minQty) <= item.qty)
            .sort((a, b) => dec(b.minQty) - dec(a.minQty));

          let unitPrice: number;
          let priceType: "RETAIL" | "WHOLESALE" | "MEMBER";
          if (unitPrices.length > 0) {
            unitPrice = dec(unitPrices[0].price);
            priceType = unitPrices[0].priceType;
          } else {
            // fallback: harga per base unit × konversi (tier dihitung dari qtyBase)
            const basePrices = product.prices
              .filter((p) => p.unitName === product.baseUnit && dec(p.minQty) <= qtyBase)
              .sort((a, b) => dec(b.minQty) - dec(a.minQty));
            if (basePrices.length === 0) {
              throw new SaleError(`${product.name} belum punya harga jual di outlet ini.`);
            }
            unitPrice = round2(dec(basePrices[0].price) * conversion);
            priceType = basePrices[0].priceType;
          }

          const lineGross = round2(item.qty * unitPrice);
          if (item.discount > lineGross) throw new SaleError(`Diskon melebihi subtotal ${product.name}.`);
          const lineSubtotal = round2(lineGross - item.discount);

          const costAtSale = dec(inventory.avgCost); // ⚠️ snapshot HPP saat transaksi
          const lineCost = round2(qtyBase * costAtSale);

          subtotal += lineSubtotal;
          totalCost += lineCost;

          itemRows.push({
            product: { connect: { id: product.id } },
            productName: product.name,
            unitName: item.unitName,
            qty: new Prisma.Decimal(item.qty),
            qtyBase: new Prisma.Decimal(qtyBase),
            unitPrice: new Prisma.Decimal(unitPrice),
            priceType,
            discount: new Prisma.Decimal(item.discount),
            subtotal: new Prisma.Decimal(lineSubtotal),
            costAtSale: new Prisma.Decimal(costAtSale),
            totalCost: new Prisma.Decimal(lineCost),
            grossProfit: new Prisma.Decimal(round2(lineSubtotal - lineCost)),
          });
          stockOps.push({ productId: product.id, qtyBase, costAtSale, name: product.name });
        }

        subtotal = round2(subtotal);
        totalCost = round2(totalCost);
        if (data.discount > subtotal) throw new SaleError("Diskon transaksi melebihi subtotal.");
        const total = round2(subtotal - data.discount);

        const isCash = data.paymentMethod === "CASH";
        const paidAmount = isCash ? data.paidAmount : total;
        if (isCash && paidAmount < total) throw new SaleError("Uang diterima kurang dari total.");
        const changeAmount = round2(paidAmount - total);

        const sale = await tx.sale.create({
          data: {
            invoiceNo,
            outletId,
            userId: user.id,
            cashSessionId: session.id,
            saleDate: now,
            subtotal: new Prisma.Decimal(subtotal),
            discount: new Prisma.Decimal(data.discount),
            total: new Prisma.Decimal(total),
            totalCost: new Prisma.Decimal(totalCost),
            grossProfit: new Prisma.Decimal(round2(total - totalCost)),
            paidAmount: new Prisma.Decimal(paidAmount),
            changeAmount: new Prisma.Decimal(changeAmount),
            paymentMethod: data.paymentMethod,
            status: "COMPLETED",
            note: data.note,
            items: { create: itemRows },
          },
        });

        // kurangi stok dengan guard qty >= n (mencegah dua transaksi menjual stok yang sama)
        for (const op of stockOps) {
          const updated = await tx.inventory.updateMany({
            where: {
              productId: op.productId,
              outletId,
              qty: { gte: new Prisma.Decimal(op.qtyBase) },
            },
            data: { qty: { decrement: new Prisma.Decimal(op.qtyBase) } },
          });
          if (updated.count === 0) throw new SaleError(`Stok ${op.name} tidak cukup.`);

          const after = await tx.inventory.findUniqueOrThrow({
            where: { productId_outletId: { productId: op.productId, outletId } },
            select: { qty: true, avgCost: true },
          });
          const qtyAfter = dec(after.qty);

          await tx.stockMovement.create({
            data: {
              productId: op.productId,
              outletId,
              userId: user.id,
              type: "SALE_OUT",
              qtyChange: new Prisma.Decimal(-op.qtyBase),
              qtyBefore: new Prisma.Decimal(round4(qtyAfter + op.qtyBase)),
              qtyAfter: new Prisma.Decimal(qtyAfter),
              costPerUnit: new Prisma.Decimal(op.costAtSale),
              avgCostAfter: after.avgCost,
              referenceType: "SALE",
              referenceId: sale.id,
              note: invoiceNo,
            },
          });
        }

        await tx.cashSession.update({
          where: { id: session.id },
          data: {
            cashSales: { increment: new Prisma.Decimal(isCash ? total : 0) },
            nonCashSales: { increment: new Prisma.Decimal(isCash ? 0 : total) },
            totalTx: { increment: 1 },
          },
        });

        return { saleId: sale.id, invoiceNo, changeAmount };
      });

      revalidatePath("/kasir/dashboard");
      revalidatePath("/kasir/transaksi");
      revalidatePath("/kasir/stok");
      revalidatePath("/owner/dashboard");
      return { ok: true, data: result };
    } catch (e) {
      if (e instanceof SaleError) return { ok: false, error: e.message };
      // tabrakan nomor invoice → coba lagi
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002" && attempt < 2) {
        continue;
      }
      console.error("createSale gagal:", e);
      return { ok: false, error: "Transaksi gagal disimpan. Coba lagi." };
    }
  }
  return { ok: false, error: "Transaksi gagal (nomor invoice bentrok). Coba lagi." };
}

/**
 * Void transaksi — hanya OWNER (PRD §3.1). Barang dikembalikan ke stok
 * (movement RETURN_IN), sale ditandai VOID (soft delete), tercatat di audit log.
 */
export async function voidSale(saleId: string, reason: string): Promise<ActionResult> {
  const user = await requireOwner();
  if (!reason || reason.trim().length < 3) {
    return { ok: false, error: "Alasan void wajib diisi (min. 3 karakter)." };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const sale = await tx.sale.findUnique({
        where: { id: saleId },
        include: { items: true, cashSession: { select: { id: true, status: true } } },
      });
      if (!sale) throw new SaleError("Transaksi tidak ditemukan.");
      if (sale.status === "VOID") throw new SaleError("Transaksi sudah di-void.");

      await tx.sale.update({
        where: { id: sale.id },
        data: {
          status: "VOID",
          voidReason: reason.trim(),
          voidedById: user.id,
          voidedAt: new Date(),
        },
      });

      for (const item of sale.items) {
        const inv = await tx.inventory.upsert({
          where: { productId_outletId: { productId: item.productId, outletId: sale.outletId } },
          update: { qty: { increment: item.qtyBase } },
          create: {
            productId: item.productId,
            outletId: sale.outletId,
            qty: item.qtyBase,
            avgCost: item.costAtSale,
          },
        });
        const qtyAfter = dec(inv.qty);
        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            outletId: sale.outletId,
            userId: user.id,
            type: "RETURN_IN",
            qtyChange: item.qtyBase,
            qtyBefore: new Prisma.Decimal(round4(qtyAfter - dec(item.qtyBase))),
            qtyAfter: new Prisma.Decimal(qtyAfter),
            costPerUnit: item.costAtSale,
            avgCostAfter: inv.avgCost,
            referenceType: "SALE_VOID",
            referenceId: sale.id,
            note: `VOID ${sale.invoiceNo}: ${reason.trim()}`,
          },
        });
      }

      // koreksi akumulasi kas hanya jika shift masih berjalan
      if (sale.cashSession && sale.cashSession.status === "OPEN") {
        const isCash = sale.paymentMethod === "CASH";
        await tx.cashSession.update({
          where: { id: sale.cashSession.id },
          data: {
            cashSales: { decrement: isCash ? sale.total : new Prisma.Decimal(0) },
            nonCashSales: { decrement: isCash ? new Prisma.Decimal(0) : sale.total },
            totalTx: { decrement: 1 },
          },
        });
      }

      await logAudit(
        {
          userId: user.id,
          action: "VOID",
          entityType: "Sale",
          entityId: sale.id,
          oldValue: { status: "COMPLETED", total: dec(sale.total) },
          newValue: { status: "VOID", reason: reason.trim() },
        },
        tx
      );
    });

    revalidatePath("/owner/transaksi");
    revalidatePath("/owner/dashboard");
    revalidatePath("/owner/stok");
    return { ok: true, data: undefined };
  } catch (e) {
    if (e instanceof SaleError) return { ok: false, error: e.message };
    console.error("voidSale gagal:", e);
    return { ok: false, error: "Gagal void transaksi." };
  }
}

/** Kasir: ajukan produk yang belum ada di sistem (PRD §8.6 — product_requests). */
export async function requestProduct(input: {
  name: string;
  suggestedPrice?: number;
  note?: string;
}): Promise<ActionResult> {
  const user = await requireKasir();
  const name = input.name?.trim();
  if (!name) return { ok: false, error: "Nama barang wajib diisi." };

  await prisma.productRequest.create({
    data: {
      outletId: user.outletId,
      requestedById: user.id,
      name,
      suggestedPrice: input.suggestedPrice ? new Prisma.Decimal(input.suggestedPrice) : null,
      note: input.note?.trim() || null,
    },
  });
  revalidatePath("/owner/kelengkapan");
  return { ok: true, data: undefined };
}
