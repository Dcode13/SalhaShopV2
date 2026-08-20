"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Copy, Plus, Trash2 } from "lucide-react";
import { cn, round2 } from "@/lib/utils";
import { formatRp } from "@/lib/format";
import { createProduct, updateProduct, type ProductInput } from "@/server/actions/products";
import { createCategory } from "@/server/actions/master";
import { Button } from "@/components/ui/button";
import { FieldHint, Input, Label, Select, Textarea } from "@/components/ui/field";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";

const BASE_UNITS = ["pcs", "kg", "liter", "sachet", "renceng", "bungkus", "botol", "sak", "meter"];

type UnitRow = { unitName: string; conversion: number };
type TierRow = { unitName: string; minQty: number; price: number };
type OutletBlock = {
  outletId: string;
  enabled: boolean;
  initialStock: number;
  initialStockUnit: string;
  initialCost: number;
  retailPrice: number;
  tiers: TierRow[];
  minStock: number;
};

export type ProductFormInitial = {
  name: string;
  categoryId: string;
  sku: string;
  barcode: string;
  baseUnit: string;
  description: string;
  units: UnitRow[];
  outletBlocks: Omit<OutletBlock, "outletId" | "enabled">[] | null;
  enabledOutletIds: string[];
  perOutlet: Record<string, Omit<OutletBlock, "outletId" | "enabled">>;
};

function emptyOutletBlock(baseUnit: string): Omit<OutletBlock, "outletId" | "enabled"> {
  return { initialStock: 0, initialStockUnit: baseUnit, initialCost: 0, retailPrice: 0, tiers: [], minStock: 0 };
}

export function ProductForm({
  categories,
  outlets,
  productId,
  initial,
}: {
  categories: { id: string; name: string }[];
  outlets: { id: string; name: string }[];
  productId?: string; // ada = mode edit
  initial?: ProductFormInitial;
}) {
  const router = useRouter();
  const isEdit = !!productId;

  const [catList, setCatList] = React.useState(categories);
  const [name, setName] = React.useState(initial?.name ?? "");
  const [categoryId, setCategoryId] = React.useState(initial?.categoryId ?? categories[0]?.id ?? "");
  const [sku, setSku] = React.useState(initial?.sku ?? "");
  const [barcode, setBarcode] = React.useState(initial?.barcode ?? "");
  const [baseUnit, setBaseUnit] = React.useState(initial?.baseUnit ?? "pcs");
  const [description, setDescription] = React.useState(initial?.description ?? "");
  const [units, setUnits] = React.useState<UnitRow[]>(initial?.units ?? []);
  const [blocks, setBlocks] = React.useState<Record<string, Omit<OutletBlock, "outletId" | "enabled">>>(() => {
    const map: Record<string, Omit<OutletBlock, "outletId" | "enabled">> = {};
    for (const o of outlets) map[o.id] = initial?.perOutlet[o.id] ?? emptyOutletBlock(initial?.baseUnit ?? "pcs");
    return map;
  });
  const [enabledOutlets, setEnabledOutlets] = React.useState<Set<string>>(
    () => new Set(initial?.enabledOutletIds ?? outlets.map((o) => o.id))
  );

  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [savedInfo, setSavedInfo] = React.useState<string | null>(null);
  const [dupConfirm, setDupConfirm] = React.useState<string | null>(null);
  const [newCatOpen, setNewCatOpen] = React.useState(false);
  const [newCatName, setNewCatName] = React.useState("");
  const [lastSaved, setLastSaved] = React.useState<(() => void) | null>(null);
  const nameRef = React.useRef<HTMLInputElement>(null);

  const allUnits = [{ unitName: baseUnit, conversion: 1 }, ...units];

  function setBlock(outletId: string, patch: Partial<Omit<OutletBlock, "outletId" | "enabled">>) {
    setBlocks((prev) => ({ ...prev, [outletId]: { ...prev[outletId], ...patch } }));
  }

  function buildPayload(confirmDuplicate: boolean): ProductInput {
    return {
      name: name.trim(),
      categoryId,
      sku: sku.trim() || undefined,
      barcode: barcode.trim() || undefined,
      baseUnit: baseUnit.trim(),
      description: description.trim() || undefined,
      units: units.filter((u) => u.unitName.trim() && u.conversion > 0),
      outlets: outlets
        .filter((o) => enabledOutlets.has(o.id))
        .map((o) => {
          const b = blocks[o.id];
          return {
            outletId: o.id,
            initialStock: b.initialStock,
            initialStockUnit: b.initialStockUnit,
            initialCost: b.initialCost,
            retailPrice: b.retailPrice,
            tiers: b.tiers.filter((t) => t.unitName && t.minQty > 0 && t.price > 0),
            minStock: b.minStock,
          };
        }),
      confirmDuplicate,
    };
  }

  // validasi client (server tetap memvalidasi ulang)
  const problems: string[] = [];
  if (!name.trim()) problems.push("Nama produk wajib diisi.");
  if (enabledOutlets.size === 0) problems.push("Pilih minimal satu outlet.");
  for (const o of outlets) {
    if (!enabledOutlets.has(o.id)) continue;
    const b = blocks[o.id];
    if (!isEdit && b.initialStock > 0 && b.initialCost <= 0) {
      problems.push(`${o.name}: stok awal > 0 wajib disertai harga modal (HPP).`);
    }
    if (b.retailPrice <= 0) problems.push(`${o.name}: harga jual eceran wajib diisi.`);
  }

  async function save(confirmDuplicate = false) {
    setBusy(true);
    setError(null);
    setDupConfirm(null);
    const payload = buildPayload(confirmDuplicate);
    const res = isEdit ? await updateProduct(productId!, payload) : await createProduct(payload);
    setBusy(false);

    if (!res.ok) {
      if (res.duplicateWarning) setDupConfirm(res.error);
      else setError(res.error);
      return;
    }

    if (isEdit) {
      router.push(`/owner/produk/${productId}`);
      router.refresh();
      return;
    }

    // ── MODE INPUT CEPAT: form tidak menutup ──
    const savedName = payload.name;
    const snapshot = { sku: "", name: savedName, barcode, baseUnit, unitsCopy: [...units], blocksCopy: JSON.parse(JSON.stringify(blocks)) as typeof blocks };
    setLastSaved(() => () => {
      setName(snapshot.name);
      setBaseUnit(snapshot.baseUnit);
      setUnits(snapshot.unitsCopy);
      setBlocks(snapshot.blocksCopy);
      setSku("");
      setBarcode("");
      nameRef.current?.focus();
      nameRef.current?.select();
    });
    setSavedInfo(`Tersimpan: ${savedName}`);
    // reset — kategori & pilihan outlet TETAP terpilih (PRD §8.6)
    setName("");
    setSku("");
    setBarcode("");
    setDescription("");
    setUnits([]);
    setBlocks(() => {
      const map: Record<string, Omit<OutletBlock, "outletId" | "enabled">> = {};
      for (const o of outlets) map[o.id] = emptyOutletBlock(baseUnit);
      return map;
    });
    router.refresh();
    nameRef.current?.focus();
  }

  async function addCategoryInline() {
    const res = await createCategory(newCatName);
    if (res.ok) {
      setCatList((prev) => [...prev, { id: res.id, name: newCatName.trim() }]);
      setCategoryId(res.id);
      setNewCatOpen(false);
      setNewCatName("");
    } else {
      setError(res.error);
      setNewCatOpen(false);
    }
  }

  return (
    <div className="space-y-4">
      {savedInfo ? (
        <div className="flex items-center justify-between rounded-xl border border-success/40 bg-success-soft px-4 py-3">
          <p className="inline-flex items-center gap-2 text-sm font-bold text-green-800">
            <CheckCircle2 className="size-4" /> {savedInfo} — lanjut produk berikutnya!
          </p>
          {lastSaved ? (
            <Button variant="outline" size="sm" onClick={() => lastSaved()}>
              <Copy className="size-3.5" /> Duplikat produk tadi
            </Button>
          ) : null}
        </div>
      ) : null}

      {/* ── Bagian A: Identitas ── */}
      <Card>
        <CardHeader title="A · Identitas Produk" />
        <CardBody className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label htmlFor="p-name">Nama produk *</Label>
            <Input
              id="p-name"
              ref={nameRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="cth: Gelas Plastik AQ 220ml"
              autoFocus
            />
          </div>
          <div>
            <Label htmlFor="p-cat">Kategori *</Label>
            <div className="flex gap-2">
              <Select id="p-cat" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="flex-1">
                {catList.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
              <Button variant="outline" onClick={() => setNewCatOpen(true)} title="Tambah kategori baru">
                <Plus className="size-4" />
              </Button>
            </div>
          </div>
          <div>
            <Label htmlFor="p-base">Satuan dasar *</Label>
            <Input id="p-base" list="base-units" value={baseUnit} onChange={(e) => setBaseUnit(e.target.value)} disabled={isEdit} />
            <datalist id="base-units">
              {BASE_UNITS.map((u) => (
                <option key={u} value={u} />
              ))}
            </datalist>
            {isEdit ? <FieldHint>Satuan dasar tidak bisa diubah (riwayat stok memakainya).</FieldHint> : null}
          </div>
          <div>
            <Label htmlFor="p-sku">SKU</Label>
            <Input id="p-sku" value={sku} onChange={(e) => setSku(e.target.value)} placeholder="kosongkan = auto (SEM-0001)" />
          </div>
          <div>
            <Label htmlFor="p-barcode">Barcode</Label>
            <Input id="p-barcode" value={barcode} onChange={(e) => setBarcode(e.target.value)} placeholder="opsional" />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="p-desc">Deskripsi</Label>
            <Textarea id="p-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="opsional" />
          </div>
        </CardBody>
      </Card>

      {/* ── Bagian B: Satuan tambahan ── */}
      <Card>
        <CardHeader
          title="B · Satuan Tambahan"
          description={`cth: lusin = 12 ${baseUnit || "pcs"}, dus = 144 ${baseUnit || "pcs"} — penting untuk lapak grosir`}
          action={
            <Button variant="soft" size="sm" onClick={() => setUnits((u) => [...u, { unitName: "", conversion: 0 }])}>
              <Plus className="size-3.5" /> Tambah satuan
            </Button>
          }
        />
        {units.length > 0 ? (
          <CardBody className="space-y-2">
            {units.map((u, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <Input
                  value={u.unitName}
                  onChange={(e) => setUnits((prev) => prev.map((x, j) => (j === i ? { ...x, unitName: e.target.value } : x)))}
                  placeholder="nama satuan (lusin)"
                  className="w-40"
                />
                <span className="text-xs font-semibold text-ink-muted">= </span>
                <Input
                  type="number"
                  min={0}
                  step="any"
                  value={u.conversion || ""}
                  onChange={(e) =>
                    setUnits((prev) => prev.map((x, j) => (j === i ? { ...x, conversion: Number(e.target.value) || 0 } : x)))
                  }
                  placeholder="12"
                  className="w-28 text-right"
                />
                <span className="text-xs font-semibold text-ink-muted">{baseUnit || "pcs"}</span>
                <button
                  type="button"
                  onClick={() => setUnits((prev) => prev.filter((_, j) => j !== i))}
                  className="rounded-md p-1.5 text-ink-faint hover:bg-danger-soft hover:text-danger"
                  aria-label="Hapus satuan"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
          </CardBody>
        ) : null}
      </Card>

      {/* ── Bagian C: Per outlet ── */}
      <Card>
        <CardHeader
          title="C · Stok & Harga per Outlet"
          description="Centang outlet tempat produk ini dijual"
          action={
            <div className="flex gap-3">
              {outlets.map((o) => (
                <label key={o.id} className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-bold text-ink">
                  <input
                    type="checkbox"
                    checked={enabledOutlets.has(o.id)}
                    onChange={(e) => {
                      setEnabledOutlets((prev) => {
                        const next = new Set(prev);
                        if (e.target.checked) next.add(o.id);
                        else next.delete(o.id);
                        return next;
                      });
                    }}
                    className="size-4 accent-[var(--primary)]"
                  />
                  {o.name}
                </label>
              ))}
            </div>
          }
        />
        <CardBody className="grid gap-4 lg:grid-cols-2">
          {outlets
            .filter((o) => enabledOutlets.has(o.id))
            .map((o) => {
              const b = blocks[o.id];
              const conv = allUnits.find((u) => u.unitName === b.initialStockUnit)?.conversion ?? 1;
              const costBase = conv > 0 && b.initialCost > 0 ? round2(b.initialCost / conv) : 0;
              const belowCost = b.retailPrice > 0 && costBase > 0 && b.retailPrice < costBase;
              return (
                <div key={o.id} className="rounded-xl border border-line p-4">
                  <p className="mb-3 text-sm font-extrabold text-primary">{o.name}</p>
                  <div className="grid grid-cols-2 gap-3">
                    {!isEdit ? (
                      <>
                        <div>
                          <Label>Stok awal</Label>
                          <div className="flex gap-1.5">
                            <Input
                              type="number"
                              min={0}
                              step="any"
                              value={b.initialStock || ""}
                              placeholder="0"
                              onChange={(e) => setBlock(o.id, { initialStock: Number(e.target.value) || 0 })}
                              className="text-right"
                            />
                            <Select
                              value={b.initialStockUnit}
                              onChange={(e) => setBlock(o.id, { initialStockUnit: e.target.value })}
                              className="w-28"
                            >
                              {allUnits.map((u) => (
                                <option key={u.unitName} value={u.unitName}>
                                  {u.unitName}
                                </option>
                              ))}
                            </Select>
                          </div>
                        </div>
                        <div>
                          <Label>
                            Harga modal / {b.initialStockUnit} {b.initialStock > 0 ? "*" : ""}
                          </Label>
                          <Input
                            type="number"
                            min={0}
                            value={b.initialCost || ""}
                            placeholder="0"
                            onChange={(e) => setBlock(o.id, { initialCost: Number(e.target.value) || 0 })}
                            className={cn("text-right", b.initialStock > 0 && b.initialCost <= 0 && "border-danger")}
                          />
                          {b.initialStock > 0 && b.initialCost <= 0 ? (
                            <FieldHint tone="danger">Wajib! Tanpa HPP, laporan laba jadi salah.</FieldHint>
                          ) : costBase > 0 && conv !== 1 ? (
                            <FieldHint>= {formatRp(costBase)}/{baseUnit}</FieldHint>
                          ) : null}
                        </div>
                      </>
                    ) : null}
                    <div>
                      <Label>Harga eceran / {baseUnit} *</Label>
                      <Input
                        type="number"
                        min={0}
                        value={b.retailPrice || ""}
                        placeholder="0"
                        onChange={(e) => setBlock(o.id, { retailPrice: Number(e.target.value) || 0 })}
                        className="text-right"
                      />
                      {belowCost ? (
                        <FieldHint tone="danger">⚠ Di bawah harga modal ({formatRp(costBase)}) — boleh, tapi pastikan disengaja.</FieldHint>
                      ) : null}
                    </div>
                    <div>
                      <Label>Stok minimum ({baseUnit})</Label>
                      <Input
                        type="number"
                        min={0}
                        step="any"
                        value={b.minStock || ""}
                        placeholder="0"
                        onChange={(e) => setBlock(o.id, { minStock: Number(e.target.value) || 0 })}
                        className="text-right"
                      />
                    </div>
                  </div>

                  {/* tier grosir */}
                  <div className="mt-3">
                    <div className="flex items-center justify-between">
                      <Label className="mb-0">Harga grosir (tier)</Label>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setBlock(o.id, { tiers: [...b.tiers, { unitName: baseUnit, minQty: 0, price: 0 }] })
                        }
                      >
                        <Plus className="size-3.5" /> tier
                      </Button>
                    </div>
                    {b.tiers.map((t, ti) => (
                      <div key={ti} className="mt-1.5 flex items-center gap-1.5 text-xs">
                        <span className="font-semibold text-ink-muted">≥</span>
                        <Input
                          type="number"
                          min={0}
                          step="any"
                          value={t.minQty || ""}
                          placeholder="12"
                          onChange={(e) =>
                            setBlock(o.id, {
                              tiers: b.tiers.map((x, j) => (j === ti ? { ...x, minQty: Number(e.target.value) || 0 } : x)),
                            })
                          }
                          className="h-9 w-20 text-right"
                        />
                        <Select
                          value={t.unitName}
                          onChange={(e) =>
                            setBlock(o.id, {
                              tiers: b.tiers.map((x, j) => (j === ti ? { ...x, unitName: e.target.value } : x)),
                            })
                          }
                          className="h-9 w-24"
                        >
                          {allUnits.map((u) => (
                            <option key={u.unitName} value={u.unitName}>
                              {u.unitName}
                            </option>
                          ))}
                        </Select>
                        <span className="font-semibold text-ink-muted">→ Rp</span>
                        <Input
                          type="number"
                          min={0}
                          value={t.price || ""}
                          placeholder="harga/satuan"
                          onChange={(e) =>
                            setBlock(o.id, {
                              tiers: b.tiers.map((x, j) => (j === ti ? { ...x, price: Number(e.target.value) || 0 } : x)),
                            })
                          }
                          className="h-9 flex-1 text-right"
                        />
                        <button
                          type="button"
                          onClick={() => setBlock(o.id, { tiers: b.tiers.filter((_, j) => j !== ti) })}
                          className="rounded-md p-1 text-ink-faint hover:bg-danger-soft hover:text-danger"
                          aria-label="Hapus tier"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
        </CardBody>
      </Card>

      {/* validasi & submit */}
      {problems.length > 0 ? (
        <ul className="space-y-1 rounded-xl border border-warn/40 bg-warn-soft px-4 py-3">
          {problems.map((p) => (
            <li key={p} className="text-xs font-semibold text-amber-800">
              • {p}
            </li>
          ))}
        </ul>
      ) : null}
      {error ? <p className="rounded-xl bg-danger-soft px-4 py-3 text-sm font-semibold text-red-800">{error}</p> : null}

      <div className="flex items-center gap-2">
        <Button size="lg" disabled={busy || problems.length > 0} onClick={() => save(false)}>
          {busy ? "Menyimpan…" : isEdit ? "Simpan Perubahan" : "Simpan & Lanjut Produk Berikutnya"}
        </Button>
        {!isEdit ? (
          <p className="text-xs text-ink-faint">Form tidak menutup setelah simpan — kategori & outlet tetap terpilih.</p>
        ) : null}
      </div>

      {/* modal konfirmasi duplikat nama */}
      <Modal open={!!dupConfirm} onClose={() => setDupConfirm(null)} title="Nama Mirip Terdeteksi">
        <p className="text-sm text-ink-muted">{dupConfirm}</p>
        <p className="mt-1 text-xs text-ink-faint">Bisa jadi memang beda merk/ukuran — simpan saja kalau yakin.</p>
        <div className="mt-4 flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => setDupConfirm(null)}>
            Batal
          </Button>
          <Button className="flex-1" disabled={busy} onClick={() => save(true)}>
            Ya, Simpan Juga
          </Button>
        </div>
      </Modal>

      {/* modal kategori baru inline */}
      <Modal open={newCatOpen} onClose={() => setNewCatOpen(false)} title="Kategori Baru">
        <Label htmlFor="new-cat">Nama kategori</Label>
        <Input
          id="new-cat"
          value={newCatName}
          onChange={(e) => setNewCatName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && newCatName.trim() && addCategoryInline()}
          autoFocus
        />
        <Button className="mt-3 w-full" disabled={!newCatName.trim()} onClick={addCategoryInline}>
          Tambah
        </Button>
      </Modal>
    </div>
  );
}
