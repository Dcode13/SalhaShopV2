"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { SlidersHorizontal } from "lucide-react";
import { adjustStock } from "@/server/actions/products";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { formatNumber } from "@/lib/format";

export function AdjustStockButton({
  productId,
  outletId,
  productName,
  outletName,
  currentQty,
  baseUnit,
}: {
  productId: string;
  outletId: string;
  productName: string;
  outletName: string;
  currentQty: number;
  baseUnit: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [direction, setDirection] = React.useState<"IN" | "OUT">("OUT");
  const [qty, setQty] = React.useState<number>(0);
  const [reason, setReason] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    const res = await adjustStock({ productId, outletId, direction, qtyBase: qty, reason });
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? "Gagal");
      return;
    }
    setOpen(false);
    setQty(0);
    setReason("");
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 text-xs font-bold text-ink-muted hover:text-primary"
        title="Penyesuaian stok"
      >
        <SlidersHorizontal className="size-3.5" /> Sesuaikan
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title={`Penyesuaian Stok — ${productName}`}>
        <div className="space-y-3">
          <p className="text-xs text-ink-muted">
            {outletName} · stok sistem saat ini:{" "}
            <span className="font-bold text-ink">
              {formatNumber(currentQty)} {baseUnit}
            </span>
          </p>
          <div>
            <Label>Jenis koreksi</Label>
            <Select value={direction} onChange={(e) => setDirection(e.target.value as "IN" | "OUT")}>
              <option value="OUT">Kurangi stok (rusak / hilang / koreksi)</option>
              <option value="IN">Tambah stok (koreksi lebih)</option>
            </Select>
            {direction === "OUT" ? (
              <p className="mt-1 text-[11px] text-warn">
                Pengurangan otomatis dicatat sebagai biaya “Kerugian Stok” senilai qty × HPP.
              </p>
            ) : null}
          </div>
          <div>
            <Label>Qty ({baseUnit})</Label>
            <Input
              type="number"
              min={0}
              step="any"
              value={qty || ""}
              placeholder="0"
              onChange={(e) => setQty(Math.max(Number(e.target.value) || 0, 0))}
              className="text-right"
            />
          </div>
          <div>
            <Label>Alasan (wajib)</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="cth: 3 pcs pecah saat bongkar" />
          </div>
          {error ? <p className="rounded-lg bg-danger-soft px-3 py-2 text-xs font-semibold text-red-800">{error}</p> : null}
          <Button className="w-full" disabled={busy || qty <= 0 || reason.trim().length < 3} onClick={submit}>
            {busy ? "Menyimpan…" : "Simpan Penyesuaian"}
          </Button>
        </div>
      </Modal>
    </>
  );
}
