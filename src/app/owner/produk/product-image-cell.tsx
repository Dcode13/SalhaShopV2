"use client";

import * as React from "react";
import Link from "next/link";
import { Image as ImageIcon, Maximize2 } from "lucide-react";
import { thumbUrl } from "@/lib/utils";
import { Modal } from "@/components/ui/modal";

/**
 * Thumbnail produk di daftar. Diklik → modal preview foto ukuran penuh.
 * Tabel memakai thumbnail 192px; preview memakai foto utama 1024px agar tajam.
 */
export function ProductImageCell({
  imageUrl,
  name,
  sku,
  productId,
}: {
  imageUrl: string | null;
  name: string;
  sku: string;
  productId: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [loaded, setLoaded] = React.useState(false);

  if (!imageUrl) {
    return (
      <span
        className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-dashed border-line text-ink-faint"
        title="Belum ada foto"
      >
        <ImageIcon className="size-4" />
      </span>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Lihat foto"
        aria-label={`Lihat foto ${name}`}
        className="group relative size-10 shrink-0 overflow-hidden rounded-lg border border-line bg-page transition-all hover:border-primary hover:shadow-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <img src={thumbUrl(imageUrl)} alt="" loading="lazy" className="size-full object-cover" />
        <span className="absolute inset-0 flex items-center justify-center bg-ink/55 opacity-0 transition-opacity group-hover:opacity-100">
          <Maximize2 className="size-4 text-white" />
        </span>
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title={name}>
        <div className="space-y-3">
          <div className="relative overflow-hidden rounded-xl border border-line bg-page">
            {/* thumbnail sbg placeholder buram sampai foto penuh selesai dimuat */}
            {!loaded ? (
              <img
                src={thumbUrl(imageUrl)}
                alt=""
                aria-hidden
                className="absolute inset-0 size-full scale-110 object-cover blur-md"
              />
            ) : null}
            <img
              src={imageUrl}
              alt={`Foto ${name}`}
              onLoad={() => setLoaded(true)}
              className={`relative mx-auto max-h-[55vh] w-full object-contain transition-opacity duration-200 ${
                loaded ? "opacity-100" : "opacity-0"
              }`}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-mono text-xs text-ink-muted">{sku}</p>
            <Link
              href={`/owner/produk/${productId}`}
              className="text-xs font-bold text-primary hover:underline"
              onClick={() => setOpen(false)}
            >
              Buka detail produk →
            </Link>
          </div>
        </div>
      </Modal>
    </>
  );
}
