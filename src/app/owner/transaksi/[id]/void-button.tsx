"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Ban } from "lucide-react";
import { voidSale } from "@/server/actions/sales";
import { Button } from "@/components/ui/button";
import { Label, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";

export function VoidButton({ saleId, invoiceNo }: { saleId: string; invoiceNo: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    const res = await voidSale(saleId, reason);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <Button variant="danger" size="sm" onClick={() => setOpen(true)}>
        <Ban className="size-4" /> Void Transaksi
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={`Void ${invoiceNo}?`}>
        <div className="space-y-3">
          <p className="text-sm text-ink-muted">
            Barang akan dikembalikan ke stok, transaksi ditandai VOID (tidak dihapus), dan aksi ini tercatat di audit
            log.
          </p>
          <div>
            <Label htmlFor="void-reason">Alasan void (wajib)</Label>
            <Textarea
              id="void-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="cth: salah input qty, pelanggan batal"
              autoFocus
            />
          </div>
          {error ? <p className="rounded-lg bg-danger-soft px-3 py-2 text-xs font-semibold text-red-800">{error}</p> : null}
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button variant="danger" className="flex-1" disabled={busy || reason.trim().length < 3} onClick={submit}>
              {busy ? "Memproses…" : "Ya, Void"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
