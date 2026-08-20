import "server-only";
import { prisma } from "@/lib/prisma";

export const SETTING_KEYS = {
  storeName: "store_name",
  maxDiscountKasir: "max_discount_kasir",
  receiptFooter: "receipt_footer",
  lowStockDefault: "low_stock_default",
} as const;

const DEFAULTS: Record<string, string> = {
  [SETTING_KEYS.storeName]: "Salha Shop",
  [SETTING_KEYS.maxDiscountKasir]: "0",
  [SETTING_KEYS.receiptFooter]: "Terima kasih telah berbelanja",
  [SETTING_KEYS.lowStockDefault]: "5",
};

export async function getSettings(): Promise<Record<string, string>> {
  const rows = await prisma.setting.findMany();
  const map = { ...DEFAULTS };
  for (const row of rows) map[row.key] = row.value;
  return map;
}

export async function getSetting(key: string): Promise<string> {
  const row = await prisma.setting.findUnique({ where: { key } });
  return row?.value ?? DEFAULTS[key] ?? "";
}

export async function getSettingNumber(key: string): Promise<number> {
  const v = Number(await getSetting(key));
  return Number.isFinite(v) ? v : 0;
}
