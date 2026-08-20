"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { dec } from "@/lib/serialize";
import { round2, round4 } from "@/lib/utils";
import { witaDateKey, witaStartOfMonth, witaStartOfNextMonth } from "@/lib/dates";

export type PurchaseResult = { ok: true; purchaseId: string } | { ok: false; error: string };

const purchaseItemSchema = z.object({
  productId: z.string().min(1),
  unitName: z.string().min(1),
  qty: z.number().positive("Qty harus > 0"),
  unitCost: z.number().min(0),
  discount: z.number().min(0).default(0),
});

const purchaseSchema = z.object({
  outletId: z.string().min(1, "Outlet tujuan wajib dipilih"),
  supplierId: z.string().optional(),
  supplierInvoice: z.string().trim().optional(),
  purchaseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal tidak valid"),
  discount: z.number().min(0).default(0),
  shippingCost: z.number().min(0).default(0),
  otherCost: z.number().min(0).default(0),
  paymentMethod: z.enum(["CASH", "TRANSFER", "QRIS", "CREDIT"]),
  paidAmount: z.number().min(0).default(0),
  note: z.string().max(500).optional(),
  items: z.array(purchaseItemSchema).min(1, "Minimal satu item"),
});

export type PurchaseInput = z.infer<typeof purchaseSchema>;

/**
 * Simpan nota pembelian sebagai DRAFT. Stok & HPP BELUM berubah —
 * baru berubah saat "Terima Barang" (receivePurchase). (PRD §8.5)
 */
export async function createPurchase(input: PurchaseInput): Promise<PurchaseResult> {
  const user = await requireOwner();
  const parsed = purchaseSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Input tidak valid" };
  const data = parsed.data;

  try {
    const purchaseId = await prisma.$transaction(async (tx) => {
      const purchaseDate = new Date(new Date(`${data.purchaseDate}T00:00:00Z`).getTime() - 8 * 3600_000);
      const monthStart = witaStartOfMonth(purchaseDate);
      const monthEnd = witaStartOfNextMonth(purchaseDate);
      const seq = await tx.purchase.count({ where: { purchaseDate: { gte: monthStart, lt: monthEnd } } });
      const key = witaDateKey(purchaseDate);
      const invoiceNo = `PO/${key.slice(0, 4)}/${key.slice(5, 7)}/${String(seq + 1).padStart(4, "0")}`;

      let subtotal = 0;
      const itemRows: Prisma.PurchaseItemCreateWithoutPurchaseInput[] = [];

      for (const item of data.items) {
        const product = await tx.product.findUnique({
          where: { id: item.productId },
          include: { units: true },
        });
        if (!product) throw new Error("Produk tidak ditemukan.");

        let conversion = 1;
        if (item.unitName !== product.baseUnit) {
          const unit = product.units.find((u) => u.unitName === item.unitName);
          if (!unit) throw new Error(`Satuan "${item.unitName}" tidak dikenal untuk ${product.name}.`);
          conversion = dec(unit.conversion);
        }
        const qtyBase = round4(item.qty * conversion);
        const lineSubtotal = round2(item.qty * item.unitCost - item.discount);
        if (lineSubtotal < 0) throw new Error(`Diskon item ${product.name} melebihi subtotal.`);
        // HPP efektif per base unit setelah diskon item
        const costBase = qtyBase > 0 ? round2(lineSubtotal / qtyBase) : 0;

        subtotal += lineSubtotal;
        itemRows.push({
          product: { connect: { id: product.id } },
          unitName: item.unitName,
          qty: new Prisma.Decimal(item.qty),
          qtyBase: new Prisma.Decimal(qtyBase),
          unitCost: new Prisma.Decimal(item.unitCost),
          costBase: new Prisma.Decimal(costBase),
          discount: new Prisma.Decimal(item.discount),
          subtotal: new Prisma.Decimal(lineSubtotal),
        });
      }

      subtotal = round2(subtotal);
      const total = round2(subtotal - data.discount + data.shippingCost + data.otherCost);
      if (total < 0) throw new Error("Total pembelian tidak boleh negatif.");
      const paymentStatus = data.paidAmount >= total && total > 0 ? "PAID" : data.paidAmount > 0 ? "PARTIAL" : "UNPAID";

      const purchase = await tx.purchase.create({
        data: {
          invoiceNo,
          supplierInvoice: data.supplierInvoice || null,
          outletId: data.outletId,
          supplierId: data.supplierId || null,
          userId: user.id,
          purchaseDate,
          subtotal: new Prisma.Decimal(subtotal),
          discount: new Prisma.Decimal(data.discount),
          shippingCost: new Prisma.Decimal(data.shippingCost),
          otherCost: new Prisma.Decimal(data.otherCost),
          total: new Prisma.Decimal(total),
          paidAmount: new Prisma.Decimal(data.paidAmount),
          paymentStatus,
          paymentMethod: data.paymentMethod,
          status: "DRAFT",
          note: data.note || null,
          items: { create: itemRows },
        },
      });

      await logAudit(
        { userId: user.id, action: "CREATE", entityType: "Purchase", entityId: purchase.id, newValue: { invoiceNo, total } },
        tx
      );
      return purchase.id;
    });

    revalidatePath("/owner/pembelian");
    return { ok: true, purchaseId };
  } catch (e) {
    console.error("createPurchase gagal:", e);
    return { ok: false, error: e instanceof Error ? e.message : "Gagal menyimpan pembelian." };
  }
}

/**
 * "Terima Barang": DRAFT → RECEIVED. Baru di sinilah stok bertambah dan
 * HPP rata-rata dihitung ulang (weighted moving average, PRD §5.1):
 *   avg_baru = (stok_lama × avg_lama + qty_masuk × harga_beli) / (stok_lama + qty_masuk)
 */
export async function receivePurchase(purchaseId: string): Promise<PurchaseResult> {
  const user = await requireOwner();
  try {
    await prisma.$transaction(async (tx) => {
      const purchase = await tx.purchase.findUnique({
        where: { id: purchaseId },
        include: { items: { include: { product: { select: { name: true } } } } },
      });
      if (!purchase) throw new Error("Pembelian tidak ditemukan.");
      if (purchase.status !== "DRAFT") throw new Error("Hanya nota DRAFT yang bisa diterima.");

      for (const item of purchase.items) {
        const qtyIn = dec(item.qtyBase);
        const costIn = dec(item.costBase);

        const inv = await tx.inventory.findUnique({
          where: { productId_outletId: { productId: item.productId, outletId: purchase.outletId } },
        });

        const oldQty = inv ? Math.max(dec(inv.qty), 0) : 0; // stok minus tidak menyeret rata-rata
        const oldAvg = inv ? dec(inv.avgCost) : 0;
        const newQtyTotal = oldQty + qtyIn;
        const newAvg =
          newQtyTotal > 0 ? round2((oldQty * oldAvg + qtyIn * costIn) / newQtyTotal) : costIn;

        const updated = await tx.inventory.upsert({
          where: { productId_outletId: { productId: item.productId, outletId: purchase.outletId } },
          update: { qty: { increment: new Prisma.Decimal(qtyIn) }, avgCost: new Prisma.Decimal(newAvg) },
          create: {
            productId: item.productId,
            outletId: purchase.outletId,
            qty: new Prisma.Decimal(qtyIn),
            avgCost: new Prisma.Decimal(newAvg),
          },
        });

        const qtyAfter = dec(updated.qty);
        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            outletId: purchase.outletId,
            userId: user.id,
            type: "PURCHASE_IN",
            qtyChange: new Prisma.Decimal(qtyIn),
            qtyBefore: new Prisma.Decimal(round4(qtyAfter - qtyIn)),
            qtyAfter: new Prisma.Decimal(qtyAfter),
            costPerUnit: new Prisma.Decimal(costIn),
            avgCostAfter: new Prisma.Decimal(newAvg),
            referenceType: "PURCHASE",
            referenceId: purchase.id,
            note: purchase.invoiceNo,
          },
        });
      }

      await tx.purchase.update({ where: { id: purchase.id }, data: { status: "RECEIVED" } });
      await logAudit(
        { userId: user.id, action: "RECEIVE", entityType: "Purchase", entityId: purchase.id, newValue: { status: "RECEIVED" } },
        tx
      );
    });

    revalidatePath("/owner/pembelian");
    revalidatePath(`/owner/pembelian/${purchaseId}`);
    revalidatePath("/owner/stok");
    return { ok: true, purchaseId };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Gagal menerima barang." };
  }
}

export async function cancelPurchase(purchaseId: string): Promise<PurchaseResult> {
  const user = await requireOwner();
  const purchase = await prisma.purchase.findUnique({ where: { id: purchaseId } });
  if (!purchase) return { ok: false, error: "Pembelian tidak ditemukan." };
  if (purchase.status !== "DRAFT") return { ok: false, error: "Hanya nota DRAFT yang bisa dibatalkan." };

  await prisma.purchase.update({ where: { id: purchaseId }, data: { status: "CANCELLED" } });
  await logAudit({ userId: user.id, action: "UPDATE", entityType: "Purchase", entityId: purchaseId, newValue: { status: "CANCELLED" } });
  revalidatePath("/owner/pembelian");
  return { ok: true, purchaseId };
}

/** Update pembayaran hutang ke supplier. */
export async function updatePurchasePayment(purchaseId: string, paidAmount: number): Promise<PurchaseResult> {
  const user = await requireOwner();
  if (paidAmount < 0) return { ok: false, error: "Nominal tidak valid." };
  const purchase = await prisma.purchase.findUnique({ where: { id: purchaseId } });
  if (!purchase) return { ok: false, error: "Pembelian tidak ditemukan." };

  const total = dec(purchase.total);
  const paymentStatus = paidAmount >= total && total > 0 ? "PAID" : paidAmount > 0 ? "PARTIAL" : "UNPAID";
  await prisma.purchase.update({
    where: { id: purchaseId },
    data: { paidAmount: new Prisma.Decimal(paidAmount), paymentStatus },
  });
  await logAudit({ userId: user.id, action: "UPDATE", entityType: "Purchase", entityId: purchaseId, newValue: { paidAmount, paymentStatus } });
  revalidatePath(`/owner/pembelian/${purchaseId}`);
  revalidatePath("/owner/pembelian");
  return { ok: true, purchaseId };
}
