"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireKasir } from "@/lib/auth";
import { dec } from "@/lib/serialize";
import { round2 } from "@/lib/utils";

export type ShiftResult = { ok: true } | { ok: false; error: string };

/** Buka shift: catat modal awal laci. Satu kasir hanya boleh punya satu shift OPEN. */
export async function openShift(openingCash: number): Promise<ShiftResult> {
  const user = await requireKasir();
  if (!(openingCash >= 0)) return { ok: false, error: "Kas awal tidak valid." };

  const existing = await prisma.cashSession.findFirst({
    where: { userId: user.id, status: "OPEN" },
  });
  if (existing) return { ok: false, error: "Masih ada shift yang belum ditutup." };

  await prisma.cashSession.create({
    data: {
      outletId: user.outletId,
      userId: user.id,
      openingCash: new Prisma.Decimal(round2(openingCash)),
    },
  });
  revalidatePath("/kasir/shift");
  revalidatePath("/kasir/dashboard");
  return { ok: true };
}

export type CloseShiftSummary = {
  openingCash: number;
  cashSales: number;
  nonCashSales: number;
  cashExpenses: number;
  expectedCash: number;
  actualCash: number;
  difference: number;
  totalTx: number;
};

/**
 * Tutup shift & rekonsiliasi kas:
 * expected = kas awal + penjualan tunai − kas keluar; selisih = fisik − expected.
 */
export async function closeShift(
  actualCash: number,
  note?: string
): Promise<{ ok: true; data: CloseShiftSummary } | { ok: false; error: string }> {
  const user = await requireKasir();
  if (!(actualCash >= 0)) return { ok: false, error: "Hasil hitung kas fisik tidak valid." };

  const session = await prisma.cashSession.findFirst({
    where: { userId: user.id, outletId: user.outletId, status: "OPEN" },
  });
  if (!session) return { ok: false, error: "Tidak ada shift yang sedang berjalan." };

  const openingCash = dec(session.openingCash);
  const cashSales = dec(session.cashSales);
  const nonCashSales = dec(session.nonCashSales);
  const cashExpenses = dec(session.cashExpenses);
  const expectedCash = round2(openingCash + cashSales - cashExpenses);
  const difference = round2(actualCash - expectedCash);

  await prisma.cashSession.update({
    where: { id: session.id },
    data: {
      status: "CLOSED",
      closedAt: new Date(),
      expectedCash: new Prisma.Decimal(expectedCash),
      actualCash: new Prisma.Decimal(round2(actualCash)),
      difference: new Prisma.Decimal(difference),
      note: note?.trim() || null,
    },
  });

  revalidatePath("/kasir/shift");
  revalidatePath("/kasir/dashboard");
  revalidatePath("/owner/kas");
  return {
    ok: true,
    data: {
      openingCash,
      cashSales,
      nonCashSales,
      cashExpenses,
      expectedCash,
      actualCash: round2(actualCash),
      difference,
      totalTx: session.totalTx,
    },
  };
}
