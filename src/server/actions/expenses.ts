"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireKasir, requireOwner } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { dec } from "@/lib/serialize";
import { parseDateInput } from "@/lib/dates";

export type ExpenseResult = { ok: true } | { ok: false; error: string };

const ownerExpenseSchema = z.object({
  outletId: z.string().nullable(), // null = biaya bersama (hanya muncul di laporan gabungan)
  categoryId: z.string().min(1, "Kategori wajib dipilih"),
  expenseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amount: z.number().positive("Nominal harus > 0"),
  description: z.string().trim().min(1, "Keterangan wajib diisi"),
  isRecurring: z.boolean().default(false),
});

/** Input biaya operasional oleh owner (sewa, listrik, gaji, dst). */
export async function createExpense(input: z.infer<typeof ownerExpenseSchema>): Promise<ExpenseResult> {
  const user = await requireOwner();
  const parsed = ownerExpenseSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Input tidak valid" };
  const data = parsed.data;

  const expense = await prisma.expense.create({
    data: {
      outletId: data.outletId,
      categoryId: data.categoryId,
      userId: user.id,
      expenseDate: parseDateInput(data.expenseDate) ?? new Date(),
      amount: new Prisma.Decimal(data.amount),
      description: data.description,
      isShared: data.outletId === null,
      isRecurring: data.isRecurring,
    },
  });
  await logAudit({
    userId: user.id,
    action: "CREATE",
    entityType: "Expense",
    entityId: expense.id,
    newValue: { amount: data.amount, description: data.description },
  });
  revalidatePath("/owner/biaya");
  revalidatePath("/owner/dashboard");
  return { ok: true };
}

export async function deleteExpense(expenseId: string): Promise<ExpenseResult> {
  const user = await requireOwner();
  const expense = await prisma.expense.findUnique({ where: { id: expenseId } });
  if (!expense) return { ok: false, error: "Biaya tidak ditemukan." };

  await prisma.expense.delete({ where: { id: expenseId } });
  await logAudit({
    userId: user.id,
    action: "DELETE",
    entityType: "Expense",
    entityId: expenseId,
    oldValue: { amount: dec(expense.amount), description: expense.description },
  });
  revalidatePath("/owner/biaya");
  return { ok: true };
}

const kasirExpenseSchema = z.object({
  categoryId: z.string().min(1, "Kategori wajib dipilih"),
  amount: z.number().positive("Nominal harus > 0"),
  description: z.string().trim().min(1, "Keterangan wajib diisi"),
});

/**
 * Kas keluar kecil oleh kasir (parkir, kresek, dll). Wajib ada shift OPEN —
 * nominal ikut mengurangi kas laci (cash_sessions.cashExpenses) untuk rekonsiliasi.
 */
export async function createKasirExpense(input: z.infer<typeof kasirExpenseSchema>): Promise<ExpenseResult> {
  const user = await requireKasir();
  const parsed = kasirExpenseSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Input tidak valid" };
  const data = parsed.data;

  try {
    await prisma.$transaction(async (tx) => {
      const session = await tx.cashSession.findFirst({
        where: { userId: user.id, outletId: user.outletId, status: "OPEN" },
      });
      if (!session) throw new Error("Shift belum dibuka. Buka shift dulu sebelum catat pengeluaran.");

      await tx.expense.create({
        data: {
          outletId: user.outletId,
          categoryId: data.categoryId,
          userId: user.id,
          expenseDate: new Date(),
          amount: new Prisma.Decimal(data.amount),
          description: data.description,
        },
      });
      await tx.cashSession.update({
        where: { id: session.id },
        data: { cashExpenses: { increment: new Prisma.Decimal(data.amount) } },
      });
    });
    revalidatePath("/kasir/pengeluaran");
    revalidatePath("/kasir/dashboard");
    revalidatePath("/owner/biaya");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Gagal mencatat pengeluaran." };
  }
}
