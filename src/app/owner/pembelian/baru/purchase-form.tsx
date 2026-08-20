"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search, Trash2 } from "lucide-react";
import { round2, round4 } from "@/lib/utils";
import { formatNumber, formatRp } from "@/lib/format";
import { createPurchase } from "@/server/actions/purchases";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/field";
import { Card, CardBody, CardHeader } from "@/components/ui/card";

export type PurchaseProduct = {
  id: string;
  name: string;
  sku: string;
  baseUnit: string;
  units: { unitName: string; conversion: number }[];
  avgCostByOutlet: Record<string, number>;
};

type Row = {
  product: PurchaseProduct;
  unitName: string;
  qty: number;
  unitCost: number;
  discount: number;
};

export function PurchaseForm({
  outlets,
  suppliers,
  products,
  today,
}: {
  outlets: { id: string; name: string }[];
  suppliers: { id: string; name: string }[];
  products: PurchaseProduct[];
  today: string;
}) {
  const router = useRouter();
  const [outletId, setOutletId] = React.useState(outlets[0]?.id ?? "");
  const [supplierId, setSupplierId] = React.useState("");
  const [supplierInvoice, setSupplierInvoice] = React.useState("");
  const [purchaseDate, setPurchaseDate] = React.useState(today);
  const [rows, setRows] = React.useState<Row[]>([]);
  const [discount, setDiscount] = React.useState(0);
  const [shippingCost, setShippingCost] = React.useState(0);
  const [otherCost, setOtherCost] = React.useState(0);
  const [paymentMethod, setPaymentMethod] = React.useState<"CASH" | "TRANSFER" | "QRIS" | "CREDIT">("CASH");
  const [paidAmount, setPaidAmount] = React.useState(0);
  const [note, setNote] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return products.filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)).slice(0, 8);
  }, [products, search]);

  function addProduct(p: PurchaseProduct) {
    const hint = p.avgCostByOutlet[outletId] ?? 0;
    setRows((prev) => [...prev, { product: p, unitName: p.baseUnit, qty: 1, unitCost: hint, discount: 0 }]);
    setSearch("");
  }

  function setRow(i: number, patch: Partial<Omit<Row, "product">>) {
    setRows((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }

  const lines = rows.map((r) => {
    const conv = r.unitName === r.product.baseUnit ? 1 : (r.product.units.find((u) => u.unitName === r.unitName)?.conversion ?? 1);
    const qtyBase = round4(r.qty * conv);
    const subtotal = round2(r.qty * r.unitCost - r.discount);
    const costBase = qtyBase > 0 ? round2(subtotal / qtyBase) : 0;
    return { row: r, conv, qtyBase, subtotal, costBase };
  });
  const subtotal = round2(lines.reduce((s, l) => s + l.subtotal, 0));
  const total = round2(subtotal - discount + shippingCost + otherCost);

  async function submit() {
    setBusy(true);
    setError(null);
    const res = await createPurchase({
      outletId,
      supplierId: supplierId || undefined,
      supplierInvoice: supplierInvoice || undefined,
      purchaseDate,
      discount,
      shippingCost,
      otherCost,
      paymentMethod,
      paidAmount: paymentMethod === "CREDIT" ? paidAmount : paidAmount || total,
      note: note || undefined,
      items: rows.map((r) => ({
        productId: r.product.id,
        unitName: r.unitName,
        qty: r.qty,
        unitCost: r.unitCost,
        discount: r.discount,
      })),
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.push(`/owner/pembelian/${res.purchaseId}`);
  }

  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <div className="space-y-4 xl:col-span-2">
        <Card>
          <CardHeader title="Info Nota" />
          <CardBody className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Outlet tujuan *</Label>
              <Select value={outletId} onChange={(e) => setOutletId(e.target.value)}>
                {outlets.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Supplier</Label>
              <Select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                <option value="">— tanpa supplier —</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Tanggal kulakan</Label>
              <Input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
            </div>
            <div>
              <Label>No. nota supplier</Label>
              <Input value={supplierInvoice} onChange={(e) => setSupplierInvoice(e.target.value)} placeholder="opsional" />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Item Barang" description="Cari produk lalu klik untuk menambahkan ke nota" />
          <CardBody>
            <div className="relative mb-3">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari nama / SKU produk…"
                className="pl-9"
              />
              {filtered.length > 0 ? (
                <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-line bg-surface shadow-pop">
                  {filtered.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => addProduct(p)}
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-primary-soft"
                    >
                      <span className="font-semibold text-ink">{p.name}</span>
                      <span className="text-xs text-ink-faint">{p.sku}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            {rows.length === 0 ? (
              <p className="py-8 text-center text-sm text-ink-faint">Belum ada item.</p>
            ) : (
              <div className="space-y-3">
                {lines.map((l, i) => (
                  <div key={i} className="rounded-xl border border-line p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-bold text-ink">{l.row.product.name}</p>
                      <button
                        type="button"
                        onClick={() => setRows((prev) => prev.filter((_, j) => j !== i))}
                        className="rounded-md p-1 text-ink-faint hover:bg-danger-soft hover:text-danger"
                        aria-label="Hapus item"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
                      <div>
                        <Label>Satuan</Label>
                        <Select value={l.row.unitName} onChange={(e) => setRow(i, { unitName: e.target.value })}>
                          {l.row.product.units.map((u) => (
                            <option key={u.unitName} value={u.unitName}>
                              {u.unitName}
                            </option>
                          ))}
                        </Select>
                      </div>
                      <div>
                        <Label>Qty</Label>
                        <Input
                          type="number"
                          min={0}
                          step="any"
                          value={l.row.qty || ""}
                          onChange={(e) => setRow(i, { qty: Number(e.target.value) || 0 })}
                          className="text-right"
                        />
                      </div>
                      <div>
                        <Label>Harga beli / {l.row.unitName}</Label>
                        <Input
                          type="number"
                          min={0}
                          value={l.row.unitCost || ""}
                          onChange={(e) => setRow(i, { unitCost: Number(e.target.value) || 0 })}
                          className="text-right"
                        />
                      </div>
                      <div>
                        <Label>Diskon item</Label>
                        <Input
                          type="number"
                          min={0}
                          value={l.row.discount || ""}
                          placeholder="0"
                          onChange={(e) => setRow(i, { discount: Number(e.target.value) || 0 })}
                          className="text-right"
                        />
                      </div>
                      <div className="flex flex-col justify-end text-right">
                        <p className="text-[11px] text-ink-faint">
                          = {formatNumber(l.qtyBase)} {l.row.product.baseUnit} @ {formatRp(l.costBase)}
                        </p>
                        <p className="text-sm font-extrabold tabular-nums">{formatRp(l.subtotal)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      <div className="space-y-4 self-start">
        <Card>
          <CardHeader title="Ringkasan & Pembayaran" />
          <CardBody className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-ink-muted">Subtotal</span>
              <span className="font-bold tabular-nums">{formatRp(subtotal)}</span>
            </div>
            <div>
              <Label>Diskon nota</Label>
              <Input type="number" min={0} value={discount || ""} placeholder="0" onChange={(e) => setDiscount(Number(e.target.value) || 0)} className="text-right" />
            </div>
            <div>
              <Label>Ongkos kirim</Label>
              <Input type="number" min={0} value={shippingCost || ""} placeholder="0" onChange={(e) => setShippingCost(Number(e.target.value) || 0)} className="text-right" />
            </div>
            <div>
              <Label>Biaya lain</Label>
              <Input type="number" min={0} value={otherCost || ""} placeholder="0" onChange={(e) => setOtherCost(Number(e.target.value) || 0)} className="text-right" />
            </div>
            <div className="flex items-center justify-between border-t border-line pt-2">
              <span className="text-sm font-bold">TOTAL</span>
              <span className="text-xl font-extrabold text-primary tabular-nums">{formatRp(total)}</span>
            </div>
            <div>
              <Label>Metode bayar</Label>
              <Select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as typeof paymentMethod)}>
                <option value="CASH">Tunai</option>
                <option value="TRANSFER">Transfer</option>
                <option value="QRIS">QRIS</option>
                <option value="CREDIT">Kredit / bayar nanti</option>
              </Select>
            </div>
            <div>
              <Label>Dibayar sekarang</Label>
              <Input
                type="number"
                min={0}
                value={paidAmount || ""}
                placeholder={paymentMethod === "CREDIT" ? "0" : String(total)}
                onChange={(e) => setPaidAmount(Number(e.target.value) || 0)}
                className="text-right"
              />
            </div>
            <div>
              <Label>Catatan</Label>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="opsional" />
            </div>
            {error ? <p className="rounded-lg bg-danger-soft px-3 py-2 text-xs font-semibold text-red-800">{error}</p> : null}
            <Button size="lg" className="w-full" disabled={busy || rows.length === 0} onClick={submit}>
              {busy ? "Menyimpan…" : "Simpan sebagai DRAFT"}
            </Button>
            <p className="text-[11px] text-ink-faint">
              Stok & HPP belum berubah pada tahap ini. Setelah barang datang, buka nota lalu klik <b>Terima Barang</b>.
            </p>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
