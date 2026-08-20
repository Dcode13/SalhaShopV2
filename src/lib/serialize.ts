import type { Prisma } from "@prisma/client";

/**
 * Konversi Prisma.Decimal → number untuk dikirim ke Client Component.
 * (Decimal tidak bisa diserialisasi lintas boundary server→client.)
 */
export function dec(v: Prisma.Decimal | number | string | null | undefined): number {
  if (v === null || v === undefined) return 0;
  return typeof v === "number" ? v : Number(v);
}
