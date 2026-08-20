"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteExpense } from "@/server/actions/expenses";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

export function DeleteExpenseButton({ expenseId, label }: { expenseId: string; label: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md p-1.5 text-ink-faint hover:bg-danger-soft hover:text-danger"
        aria-label="Hapus biaya"
      >
        <Trash2 className="size-4" />
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Hapus biaya ini?">
        <p className="text-sm text-ink-muted">{label}</p>
        <p className="mt-1 text-xs text-ink-faint">Penghapusan tercatat di audit log dan langsung mengubah laba bersih.</p>
        <div className="mt-4 flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>
            Batal
          </Button>
          <Button
            variant="danger"
            className="flex-1"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await deleteExpense(expenseId);
              setBusy(false);
              setOpen(false);
              router.refresh();
            }}
          >
            {busy ? "Menghapus…" : "Hapus"}
          </Button>
        </div>
      </Modal>
    </>
  );
}
