export const MOVEMENT_LABELS: Record<string, { label: string; tone: "success" | "danger" | "info" | "warn" | "neutral" }> = {
  PURCHASE_IN: { label: "Pembelian", tone: "success" },
  SALE_OUT: { label: "Penjualan", tone: "info" },
  RETURN_IN: { label: "Retur Masuk / Void", tone: "warn" },
  RETURN_OUT: { label: "Retur ke Supplier", tone: "warn" },
  ADJUSTMENT_IN: { label: "Koreksi Tambah", tone: "success" },
  ADJUSTMENT_OUT: { label: "Koreksi Kurang", tone: "danger" },
  TRANSFER_IN: { label: "Transfer Masuk", tone: "info" },
  TRANSFER_OUT: { label: "Transfer Keluar", tone: "info" },
  INITIAL: { label: "Stok Awal", tone: "neutral" },
};

export const PAYMENT_LABELS: Record<string, string> = {
  CASH: "Tunai",
  TRANSFER: "Transfer",
  QRIS: "QRIS",
  CREDIT: "Kredit/Hutang",
};

export const PURCHASE_STATUS: Record<string, { label: string; tone: "success" | "warn" | "danger" | "neutral" }> = {
  DRAFT: { label: "DRAFT", tone: "warn" },
  RECEIVED: { label: "DITERIMA", tone: "success" },
  CANCELLED: { label: "BATAL", tone: "danger" },
};

export const PAYMENT_STATUS: Record<string, { label: string; tone: "success" | "warn" | "danger" }> = {
  PAID: { label: "LUNAS", tone: "success" },
  PARTIAL: { label: "SEBAGIAN", tone: "warn" },
  UNPAID: { label: "BELUM BAYAR", tone: "danger" },
};
