"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Archive, Trash2, TriangleAlert } from "lucide-react";
import { deleteProduct, toggleProductActive } from "@/server/actions/products";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

/**
 * Tombol hapus produk. Produk TANPA riwayat → konfirmasi hapus permanen.
 * Produk ber-riwayat (pernah terjual/dibeli/dimutasi) → penghapusan diblokir,
 * ditawarkan "Nonaktifkan" (soft delete) supaya laporan historis tetap utuh.
 */
export function DeleteProductButton({
  productId,
  productName,
  sku,
  hasHistory,
  isActive,
  stockNote,
  redirectTo,
  iconOnly = false,
}: {
  productId: string;
  productName: string;
  sku: string;
  hasHistory: boolean; // petunjuk dari server (server action tetap memvalidasi ulang)
  isActive: boolean;
  stockNote?: string | null; // ringkasan stok tercatat yang ikut terhapus
  redirectTo?: string; // diisi bila dipakai dari halaman detail
  iconOnly?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [blocked, setBlocked] = React.useState(hasHistory);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function close() {
    if (busy) return;
    setOpen(false);
    setError(null);
    setBlocked(hasHistory);
  }

  async function handleDelete() {
    setBusy(true);
    setError(null);
    const res = await deleteProduct(productId);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      if (res.canDeactivate) setBlocked(true);
      return;
    }
    setOpen(false);
    if (redirectTo) router.push(redirectTo);
    router.refresh();
  }

  async function handleDeactivate() {
    setBusy(true);
    await toggleProductActive(productId);
    setBusy(false);
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      {iconOnly ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-md p-1.5 text-ink-faint hover:bg-danger-soft hover:text-danger"
          title="Hapus produk"
          aria-label={`Hapus ${productName}`}
        >
          <Trash2 className="size-4" />
        </button>
      ) : (
        <Button variant="danger" size="sm" onClick={() => setOpen(true)}>
          <Trash2 className="size-4" /> Hapus Produk
        </Button>
      )}

      <Modal open={open} onClose={close} title={blocked ? "Tidak Bisa Dihapus Permanen" : `Hapus ${productName}?`}>
        {blocked ? (
          <div className="space-y-3">
            <div className="flex items-start gap-2 rounded-lg bg-warn-soft px-3 py-2.5">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warn" />
              <p className="text-xs font-semibold text-amber-800">
                {error ??
                  `"${productName}" (${sku}) sudah punya riwayat transaksi/mutasi stok. Menghapusnya akan merusak laporan laba dan kartu stok historis.`}
              </p>
            </div>
            <p className="text-sm text-ink-muted">
              Solusinya: <b>nonaktifkan</b>. Produk hilang dari POS &amp; daftar aktif, tapi seluruh riwayatnya tetap
              utuh — dan bisa diaktifkan lagi kapan saja.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={close}>
                Batal
              </Button>
              {isActive ? (
                <Button className="flex-1" disabled={busy} onClick={handleDeactivate}>
                  <Archive className="size-4" /> {busy ? "Memproses…" : "Nonaktifkan Produk"}
                </Button>
              ) : (
                <span className="flex flex-1 items-center justify-center rounded-lg bg-page px-3 text-xs font-bold text-ink-muted">
                  Produk sudah nonaktif
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-ink-muted">
              Produk <b>{productName}</b> ({sku}) belum pernah dipakai transaksi, jadi boleh dihapus permanen. Yang ikut
              terhapus:
            </p>
            <ul className="space-y-1 rounded-lg bg-page px-3 py-2.5 text-xs text-ink-muted">
              <li>• Semua harga jual &amp; satuan produk ini</li>
              <li>• Catatan stok awal (movement INITIAL){stockNote ? ` — stok tercatat: ${stockNote}` : ""}</li>
              <li>• Tindakan ini tercatat di audit log dan tidak bisa dibatalkan</li>
            </ul>
            {error ? <p className="rounded-lg bg-danger-soft px-3 py-2 text-xs font-semibold text-red-800">{error}</p> : null}
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={close}>
                Batal
              </Button>
              <Button variant="danger" className="flex-1" disabled={busy} onClick={handleDelete}>
                {busy ? "Menghapus…" : "Hapus Permanen"}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
