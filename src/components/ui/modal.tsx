"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Dialog responsif: di layar ≥sm tampil sebagai modal di tengah,
 * di HP tampil sebagai bottom-sheet yang naik dari bawah (lebih mudah dijangkau ibu jari).
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  children: React.ReactNode;
  wide?: boolean;
}) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-ink/50 animate-fade-in" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "relative flex max-h-[88vh] w-full flex-col overflow-hidden rounded-t-2xl bg-surface shadow-pop animate-sheet-up sm:max-h-[90vh] sm:rounded-2xl sm:animate-slide-up",
          wide ? "sm:max-w-2xl" : "sm:max-w-md"
        )}
      >
        {/* pegangan sheet (mobile) */}
        <div className="flex justify-center pt-2 sm:hidden">
          <span className="h-1 w-10 rounded-full bg-line" />
        </div>
        <div className="flex items-center justify-between border-b border-line bg-surface px-5 py-3">
          <h3 className="text-sm font-bold text-ink">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-ink-muted hover:bg-page hover:text-ink"
            aria-label="Tutup"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="overflow-y-auto p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:pb-5">{children}</div>
      </div>
    </div>
  );
}
