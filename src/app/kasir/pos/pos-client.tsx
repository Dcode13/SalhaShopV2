"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Banknote,
  CheckCircle2,
  ChevronUp,
  Minus,
  PackageSearch,
  Plus,
  Printer,
  Search,
  ShoppingCart,
  Trash2,
  X,
} from "lucide-react";
import { cn, round2, round4, thumbUrl } from "@/lib/utils";
import { formatNumber, formatRp } from "@/lib/format";
import { createSale, requestProduct, type CreateSaleResult } from "@/server/actions/sales";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";

export type PosProduct = {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  imageUrl: string | null;
  baseUnit: string;
  categoryId: string;
  categoryName: string;
  stock: number; // dalam base unit
  units: { unitName: string; conversion: number }[];
  prices: { unitName: string; minQty: number; price: number; priceType: string }[];
};

type CartItem = {
  product: PosProduct;
  unitName: string;
  qty: number;
  discount: number;
};

/** Logika harga tier — sama persis dengan server (server tetap otoritatif). */
function resolvePrice(p: PosProduct, unitName: string, qty: number): { price: number; priceType: string } | null {
  const conv = unitName === p.baseUnit ? 1 : (p.units.find((u) => u.unitName === unitName)?.conversion ?? 1);
  const direct = p.prices
    .filter((pr) => pr.unitName === unitName && pr.minQty <= qty)
    .sort((a, b) => b.minQty - a.minQty);
  if (direct.length > 0) return { price: direct[0].price, priceType: direct[0].priceType };
  const qtyBase = qty * conv;
  const base = p.prices
    .filter((pr) => pr.unitName === p.baseUnit && pr.minQty <= qtyBase)
    .sort((a, b) => b.minQty - a.minQty);
  if (base.length > 0) return { price: round2(base[0].price * conv), priceType: base[0].priceType };
  return null;
}

function convOf(p: PosProduct, unitName: string): number {
  return unitName === p.baseUnit ? 1 : (p.units.find((u) => u.unitName === unitName)?.conversion ?? 1);
}

const QUICK_CASH = [5000, 10000, 20000, 50000, 100000];

export function PosClient({
  products,
  categories,
  maxDiscount,
  isGrosir,
}: {
  products: PosProduct[];
  categories: { id: string; name: string }[];
  maxDiscount: number;
  isGrosir: boolean;
}) {
  const router = useRouter();
  const [search, setSearch] = React.useState("");
  const [categoryId, setCategoryId] = React.useState<string | null>(null);
  const [cart, setCart] = React.useState<CartItem[]>([]);
  const [txDiscount, setTxDiscount] = React.useState(0);
  const [payOpen, setPayOpen] = React.useState(false);
  const [sheetOpen, setSheetOpen] = React.useState(false); // keranjang mobile
  const [notFoundOpen, setNotFoundOpen] = React.useState(false);
  const [result, setResult] = React.useState<CreateSaleResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const searchRef = React.useRef<HTMLInputElement>(null);

  // pembayaran
  const [paymentMethod, setPaymentMethod] = React.useState<"CASH" | "TRANSFER" | "QRIS">("CASH");
  const [paidAmount, setPaidAmount] = React.useState<number>(0);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (categoryId && p.categoryId !== categoryId) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.barcode ?? "").toLowerCase() === q
      );
    });
  }, [products, search, categoryId]);

  const usedBase = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const item of cart) {
      const add = item.qty * convOf(item.product, item.unitName);
      map.set(item.product.id, (map.get(item.product.id) ?? 0) + add);
    }
    return map;
  }, [cart]);

  function addToCart(p: PosProduct) {
    setError(null);
    const already = usedBase.get(p.id) ?? 0;
    if (already >= p.stock) {
      setError(`Stok ${p.name} tinggal ${formatNumber(p.stock)} ${p.baseUnit}.`);
      return;
    }
    setCart((prev) => {
      const idx = prev.findIndex((c) => c.product.id === p.id && c.unitName === p.baseUnit);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], qty: next[idx].qty + 1 };
        return next;
      }
      return [...prev, { product: p, unitName: p.baseUnit, qty: 1, discount: 0 }];
    });
  }

  function updateItem(index: number, patch: Partial<Pick<CartItem, "unitName" | "qty" | "discount">>) {
    setCart((prev) => prev.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  }

  function removeItem(index: number) {
    setCart((prev) => prev.filter((_, i) => i !== index));
  }

  // total
  const lines = cart.map((item) => {
    const priceInfo = resolvePrice(item.product, item.unitName, item.qty);
    const price = priceInfo?.price ?? 0;
    const gross = round2(item.qty * price);
    const subtotal = round2(Math.max(gross - item.discount, 0));
    const qtyBase = round4(item.qty * convOf(item.product, item.unitName));
    const overStock = qtyBase > item.product.stock;
    return { item, price, priceType: priceInfo?.priceType ?? "RETAIL", gross, subtotal, qtyBase, overStock, noPrice: !priceInfo };
  });
  const subtotal = round2(lines.reduce((s, l) => s + l.subtotal, 0));
  const total = round2(Math.max(subtotal - txDiscount, 0));
  const totalDiscount = txDiscount + cart.reduce((s, c) => s + c.discount, 0);
  const hasProblem = lines.some((l) => l.overStock || l.noPrice) || cart.length === 0;
  const overDiscount = totalDiscount > maxDiscount;
  const change = paymentMethod === "CASH" ? round2(paidAmount - total) : 0;

  function openPayment() {
    setPaidAmount(0);
    setPaymentMethod("CASH");
    setSheetOpen(false);
    setPayOpen(true);
  }

  async function submit() {
    setSaving(true);
    setError(null);
    const res = await createSale({
      items: cart.map((c) => ({
        productId: c.product.id,
        unitName: c.unitName,
        qty: c.qty,
        discount: c.discount,
      })),
      discount: txDiscount,
      paymentMethod,
      paidAmount: paymentMethod === "CASH" ? paidAmount : total,
    });
    setSaving(false);
    if (res.ok) {
      setResult(res.data);
      setPayOpen(false);
      setSheetOpen(false);
      setCart([]);
      setTxDiscount(0);
      setPaidAmount(0);
      router.refresh();
    } else {
      setError(res.error);
    }
  }

  /* ── Panel keranjang (dipakai di aside desktop & bottom-sheet mobile) ── */
  const cartPanel = (
    <div className="flex h-full flex-col">
      <div className={cn("flex-1 overflow-y-auto thin-scroll", cart.length === 0 && "flex items-center")}>
        {cart.length === 0 ? (
          <div className="w-full px-4 py-12 text-center">
            <ShoppingCart className="mx-auto size-10 text-ink-faint/50" />
            <p className="mt-2 text-sm text-ink-faint">Keranjang kosong — ketuk produk untuk menambahkan.</p>
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {lines.map((line, i) => (
              <li key={`${line.item.product.id}-${line.item.unitName}-${i}`} className="px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-ink">{line.item.product.name}</p>
                    <p className="text-[11px] text-ink-faint">
                      {formatRp(line.price)}/{line.item.unitName}
                      {line.priceType !== "RETAIL" ? (
                        <Badge tone="info" className="ml-1.5">
                          GROSIR
                        </Badge>
                      ) : null}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeItem(i)}
                    className="rounded-md p-1 text-ink-faint hover:bg-danger-soft hover:text-danger"
                    aria-label="Hapus item"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {line.item.product.units.length > 1 && isGrosir ? (
                    <Select
                      value={line.item.unitName}
                      onChange={(e) => updateItem(i, { unitName: e.target.value })}
                      className="h-10 w-24 text-xs"
                    >
                      {line.item.product.units.map((u) => (
                        <option key={u.unitName} value={u.unitName}>
                          {u.unitName}
                        </option>
                      ))}
                    </Select>
                  ) : (
                    <span className="text-xs font-semibold text-ink-muted">{line.item.unitName}</span>
                  )}

                  <div className="flex items-center overflow-hidden rounded-xl border border-line">
                    <button
                      type="button"
                      className="flex size-10 items-center justify-center text-ink-muted transition-colors hover:bg-page hover:text-primary"
                      onClick={() => updateItem(i, { qty: Math.max(round4(line.item.qty - 1), 0.0001) })}
                      aria-label="Kurangi"
                    >
                      <Minus className="size-4" />
                    </button>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={line.item.qty}
                      onChange={(e) => updateItem(i, { qty: Math.max(Number(e.target.value) || 0, 0) })}
                      className="h-10 w-14 border-x border-line text-center text-sm font-bold text-ink outline-none"
                    />
                    <button
                      type="button"
                      className="flex size-10 items-center justify-center text-ink-muted transition-colors hover:bg-page hover:text-primary"
                      onClick={() => updateItem(i, { qty: round4(line.item.qty + 1) })}
                      aria-label="Tambah"
                    >
                      <Plus className="size-4" />
                    </button>
                  </div>

                  {maxDiscount > 0 ? (
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] font-semibold text-ink-faint">Disk.</span>
                      <input
                        type="number"
                        min={0}
                        value={line.item.discount || ""}
                        placeholder="0"
                        onChange={(e) => updateItem(i, { discount: Math.max(Number(e.target.value) || 0, 0) })}
                        className="h-10 w-20 rounded-xl border border-line px-2 text-right text-xs text-ink"
                      />
                    </div>
                  ) : null}

                  <p className="ml-auto text-sm font-extrabold text-ink tabular-nums">{formatRp(line.subtotal)}</p>
                </div>

                {line.overStock ? (
                  <p className="mt-1 text-[11px] font-bold text-danger">
                    Stok kurang! Tersedia {formatNumber(line.item.product.stock)} {line.item.product.baseUnit}, diminta{" "}
                    {formatNumber(line.qtyBase)}.
                  </p>
                ) : null}
                {line.noPrice ? (
                  <p className="mt-1 text-[11px] font-bold text-danger">Harga satuan ini belum di-set.</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-2 border-t border-line px-4 py-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-ink-muted">Subtotal</span>
          <span className="font-bold tabular-nums">{formatRp(subtotal)}</span>
        </div>
        {maxDiscount > 0 ? (
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="text-ink-muted">Diskon transaksi</span>
            <input
              type="number"
              min={0}
              value={txDiscount || ""}
              placeholder="0"
              onChange={(e) => setTxDiscount(Math.max(Number(e.target.value) || 0, 0))}
              className="h-10 w-28 rounded-xl border border-line px-2 text-right text-sm text-ink"
            />
          </div>
        ) : null}
        {overDiscount ? (
          <p className="text-[11px] font-bold text-danger">
            Total diskon melebihi batas kasir ({formatRp(maxDiscount)}).
          </p>
        ) : null}
        <div className="flex items-center justify-between border-t border-line pt-2">
          <span className="text-sm font-bold text-ink">TOTAL</span>
          <span className="text-2xl font-extrabold text-primary tabular-nums">{formatRp(total)}</span>
        </div>
        {error ? (
          <p className="rounded-lg bg-danger-soft px-3 py-2 text-xs font-semibold text-red-800">{error}</p>
        ) : null}
        <Button size="xl" className="w-full" disabled={hasProblem || overDiscount || total <= 0} onClick={openPayment}>
          <Banknote className="size-5" /> Bayar
        </Button>
      </div>
    </div>
  );

  return (
    <div className="grid gap-4 pb-20 xl:grid-cols-5 xl:pb-0">
      {/* ── Kiri: pencarian + grid produk ── */}
      <div className="xl:col-span-3">
        {/* baris pencarian — sticky di bawah navbar mobile */}
        <div className="sticky top-14 z-20 -mx-4 bg-page/95 px-4 pb-2 pt-1 backdrop-blur lg:static lg:mx-0 lg:bg-transparent lg:p-0 lg:pb-3 lg:backdrop-blur-none">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint" />
              <Input
                ref={searchRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && filtered.length === 1) {
                    addToCart(filtered[0]);
                    setSearch("");
                  }
                }}
                placeholder="Cari nama / SKU / scan barcode…"
                className="h-12 rounded-xl pl-9 text-base shadow-card"
                autoFocus
              />
              {search ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    searchRef.current?.focus();
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-ink-faint hover:bg-page hover:text-ink"
                  aria-label="Bersihkan pencarian"
                >
                  <X className="size-4" />
                </button>
              ) : null}
            </div>
            <Button variant="outline" size="lg" className="h-12 rounded-xl bg-surface" onClick={() => setNotFoundOpen(true)}>
              <PackageSearch className="size-4" />
              <span className="hidden sm:inline">Barang tidak ditemukan</span>
            </Button>
          </div>

          {/* chip kategori — bisa digeser di layar sempit */}
          <div className="mt-2 flex gap-1.5 overflow-x-auto no-scrollbar sm:flex-wrap">
            <button
              type="button"
              onClick={() => setCategoryId(null)}
              className={cn(
                "shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors",
                !categoryId
                  ? "bg-primary text-primary-fg shadow-sm"
                  : "border border-line bg-surface text-ink-muted hover:border-primary hover:text-primary"
              )}
            >
              Semua
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategoryId(categoryId === c.id ? null : c.id)}
                className={cn(
                  "shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors",
                  categoryId === c.id
                    ? "bg-primary text-primary-fg shadow-sm"
                    : "border border-line bg-surface text-ink-muted hover:border-primary hover:text-primary"
                )}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>

        {/* grid produk — ikut scroll halaman di mobile, panel scroll sendiri di desktop */}
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 thin-scroll xl:max-h-[68vh] xl:grid-cols-4 xl:overflow-y-auto xl:pr-1">
          {filtered.map((p) => {
            const retail = resolvePrice(p, p.baseUnit, 1);
            const out = p.stock <= 0;
            const low = !out && p.stock <= 5;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => addToCart(p)}
                disabled={out}
                className={cn(
                  "group flex min-h-28 flex-col items-start justify-between rounded-2xl border bg-surface p-3 text-left shadow-card transition-all",
                  out
                    ? "cursor-not-allowed border-line opacity-45"
                    : "border-line hover:-translate-y-0.5 hover:border-primary hover:shadow-pop active:scale-[0.98]"
                )}
              >
                <div className="flex w-full items-start gap-2">
                  {p.imageUrl ? (
                    <img
                      src={thumbUrl(p.imageUrl)}
                      alt=""
                      loading="lazy"
                      className="size-11 shrink-0 rounded-lg border border-line bg-page object-cover"
                    />
                  ) : null}
                  <div className="min-w-0">
                    <p className="line-clamp-2 text-sm font-bold leading-snug text-ink">{p.name}</p>
                    <p className="mt-0.5 text-[10px] font-medium text-ink-faint">{p.categoryName}</p>
                  </div>
                </div>
                <div className="mt-2 flex w-full items-end justify-between gap-1">
                  <p className="text-sm font-extrabold text-primary tabular-nums">
                    {retail ? formatRp(retail.price) : "—"}
                    <span className="text-[10px] font-semibold text-ink-faint">/{p.baseUnit}</span>
                  </p>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                      out ? "bg-danger-soft text-red-800" : low ? "bg-warn-soft text-amber-800" : "bg-page text-ink-faint"
                    )}
                  >
                    {out ? "Habis" : formatNumber(p.stock)}
                  </span>
                </div>
              </button>
            );
          })}
          {filtered.length === 0 ? (
            <div className="col-span-full py-16 text-center text-sm text-ink-faint">
              Tidak ada produk cocok. Coba kata kunci lain atau tombol “Barang tidak ditemukan”.
            </div>
          ) : null}
        </div>
      </div>

      {/* ── Kanan: keranjang (desktop) ── */}
      <div className="hidden xl:block xl:col-span-2">
        <div className="flex max-h-[calc(100dvh-7rem)] flex-col rounded-2xl border border-line bg-surface shadow-card">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <h2 className="inline-flex items-center gap-2 text-sm font-extrabold text-ink">
              <ShoppingCart className="size-4 text-primary" /> Keranjang
            </h2>
            <Badge tone="primary">{cart.length} item</Badge>
          </div>
          {cartPanel}
        </div>
      </div>

      {/* ── Bar keranjang melayang (mobile/tablet) ── */}
      <button
        type="button"
        onClick={() => setSheetOpen(true)}
        className={cn(
          "fixed inset-x-3 z-30 flex items-center justify-between rounded-2xl bg-gradient-to-r from-primary to-primary-strong px-4 py-3 text-white shadow-pop transition-transform active:scale-[0.99] xl:hidden",
          "bottom-[calc(4.75rem+env(safe-area-inset-bottom))]"
        )}
      >
        <span className="flex items-center gap-2.5">
          <span className="relative">
            <ShoppingCart className="size-5" />
            {cart.length > 0 ? (
              <span className="absolute -right-2 -top-2 flex size-4.5 items-center justify-center rounded-full bg-white text-[10px] font-extrabold text-primary-strong">
                {cart.length}
              </span>
            ) : null}
          </span>
          <span className="text-sm font-bold">{cart.length > 0 ? "Lihat Keranjang" : "Keranjang kosong"}</span>
        </span>
        <span className="flex items-center gap-1.5 text-base font-extrabold tabular-nums">
          {formatRp(total)} <ChevronUp className="size-4" />
        </span>
      </button>

      {/* ── Bottom-sheet keranjang (mobile/tablet) ── */}
      {sheetOpen ? (
        <div className="fixed inset-0 z-40 xl:hidden">
          <div className="absolute inset-0 bg-ink/50 animate-fade-in" onClick={() => setSheetOpen(false)} aria-hidden />
          <div className="absolute inset-x-0 bottom-0 flex max-h-[86vh] flex-col overflow-hidden rounded-t-2xl bg-surface shadow-pop animate-sheet-up pb-safe">
            <div className="flex justify-center pt-2">
              <span className="h-1 w-10 rounded-full bg-line" />
            </div>
            <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
              <h2 className="inline-flex items-center gap-2 text-sm font-extrabold text-ink">
                <ShoppingCart className="size-4 text-primary" /> Keranjang
                <Badge tone="primary">{cart.length} item</Badge>
              </h2>
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                className="rounded-md p-1.5 text-ink-muted hover:bg-page hover:text-ink"
                aria-label="Tutup keranjang"
              >
                <X className="size-4" />
              </button>
            </div>
            {cartPanel}
          </div>
        </div>
      ) : null}

      {/* ── Modal pembayaran ── */}
      <Modal open={payOpen} onClose={() => !saving && setPayOpen(false)} title={`Pembayaran — Total ${formatRp(total)}`}>
        <div className="space-y-4">
          <div>
            <Label>Metode Pembayaran</Label>
            <div className="grid grid-cols-3 gap-2">
              {(["CASH", "TRANSFER", "QRIS"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setPaymentMethod(m)}
                  className={cn(
                    "h-11 rounded-xl border text-sm font-bold transition-colors",
                    paymentMethod === m
                      ? "border-primary bg-primary text-primary-fg shadow-sm"
                      : "border-line bg-surface text-ink-muted hover:border-primary"
                  )}
                >
                  {m === "CASH" ? "Tunai" : m}
                </button>
              ))}
            </div>
          </div>

          {paymentMethod === "CASH" ? (
            <div>
              <Label htmlFor="paid">Uang Diterima</Label>
              <Input
                id="paid"
                type="number"
                min={0}
                value={paidAmount || ""}
                placeholder="0"
                onChange={(e) => setPaidAmount(Math.max(Number(e.target.value) || 0, 0))}
                className="h-12 rounded-xl text-right text-lg font-extrabold"
                autoFocus
              />
              <div className="mt-2 flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setPaidAmount(total)}
                  className="rounded-lg bg-primary-soft px-3 py-2 text-xs font-bold text-primary-strong transition-colors hover:bg-primary hover:text-primary-fg"
                >
                  Uang pas
                </button>
                {QUICK_CASH.filter((q) => q >= total).slice(0, 3).map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setPaidAmount(q)}
                    className="rounded-lg bg-page px-3 py-2 text-xs font-bold text-ink-muted transition-colors hover:bg-primary-soft hover:text-primary"
                  >
                    {formatRp(q)}
                  </button>
                ))}
              </div>
              <div className="mt-3 flex items-center justify-between rounded-xl bg-page px-3 py-2.5">
                <span className="text-sm font-semibold text-ink-muted">Kembalian</span>
                <span className={cn("text-xl font-extrabold tabular-nums", change < 0 ? "text-danger" : "text-success")}>
                  {formatRp(change)}
                </span>
              </div>
            </div>
          ) : (
            <p className="rounded-xl bg-info-soft px-3 py-2.5 text-xs font-semibold text-blue-800">
              Pastikan {paymentMethod === "TRANSFER" ? "transfer" : "pembayaran QRIS"} sebesar {formatRp(total)} sudah
              masuk sebelum menyimpan.
            </p>
          )}

          {error ? <p className="rounded-lg bg-danger-soft px-3 py-2 text-xs font-semibold text-red-800">{error}</p> : null}

          <Button
            size="xl"
            className="w-full"
            disabled={saving || (paymentMethod === "CASH" && paidAmount < total)}
            onClick={submit}
          >
            {saving ? "Menyimpan…" : "Simpan Transaksi"}
          </Button>
        </div>
      </Modal>

      {/* ── Modal sukses / struk ── */}
      <Modal open={!!result} onClose={() => setResult(null)} title="Transaksi Berhasil">
        {result ? (
          <div className="flex flex-col items-center gap-3 text-center">
            <span className="flex size-16 items-center justify-center rounded-full bg-success-soft">
              <CheckCircle2 className="size-9 text-success" />
            </span>
            <p className="text-lg font-extrabold text-ink">{result.invoiceNo}</p>
            {result.changeAmount > 0 ? (
              <p className="text-sm text-ink-muted">
                Kembalian: <span className="text-xl font-extrabold text-success">{formatRp(result.changeAmount)}</span>
              </p>
            ) : null}
            <div className="mt-2 flex w-full gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  window.open(`/kasir/transaksi/${result.saleId}?print=1`, "_blank");
                }}
              >
                <Printer className="size-4" /> Cetak Struk
              </Button>
              <Button
                className="flex-1"
                onClick={() => {
                  setResult(null);
                  searchRef.current?.focus();
                }}
              >
                Transaksi Baru
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* ── Modal barang tidak ditemukan ── */}
      <NotFoundModal open={notFoundOpen} onClose={() => setNotFoundOpen(false)} />
    </div>
  );
}

function NotFoundModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = React.useState("");
  const [price, setPrice] = React.useState<number>(0);
  const [note, setNote] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function submit() {
    setSending(true);
    setError(null);
    const res = await requestProduct({ name, suggestedPrice: price || undefined, note: note || undefined });
    setSending(false);
    if (res.ok) {
      setDone(true);
      setName("");
      setPrice(0);
      setNote("");
    } else {
      setError(res.error);
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        setDone(false);
        onClose();
      }}
      title="Barang Tidak Ditemukan"
    >
      {done ? (
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <CheckCircle2 className="size-12 text-success" />
          <p className="text-sm text-ink-muted">
            Permintaan terkirim ke owner. Barang akan muncul di sistem setelah owner melengkapi datanya.
          </p>
          <Button
            onClick={() => {
              setDone(false);
              onClose();
            }}
          >
            Tutup
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-ink-muted">
            Ajukan barang yang belum ada di sistem. Owner yang melengkapi harga modal & stok — kasir tidak bisa membuat
            produk sendiri.
          </p>
          <div>
            <Label htmlFor="req-name">Nama barang *</Label>
            <Input id="req-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="cth: Kecap ABC 135ml" />
          </div>
          <div>
            <Label htmlFor="req-price">Harga jual yang dipakai (opsional)</Label>
            <Input
              id="req-price"
              type="number"
              min={0}
              value={price || ""}
              placeholder="0"
              onChange={(e) => setPrice(Number(e.target.value) || 0)}
            />
          </div>
          <div>
            <Label htmlFor="req-note">Catatan</Label>
            <Textarea id="req-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="opsional" />
          </div>
          {error ? <p className="rounded-lg bg-danger-soft px-3 py-2 text-xs font-semibold text-red-800">{error}</p> : null}
          <Button className="w-full" disabled={sending || !name.trim()} onClick={submit}>
            {sending ? "Mengirim…" : "Kirim ke Owner"}
          </Button>
        </div>
      )}
    </Modal>
  );
}
