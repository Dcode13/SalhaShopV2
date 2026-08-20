"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Wallet } from "lucide-react";
import { createKasirExpense } from "@/server/actions/expenses";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/field";
import { Card, CardBody, CardHeader } from "@/components/ui/card";

export function PengeluaranForm({ categories }: { categories: { id: string; name: string }[] }) {
  const router = useRouter();
  const [categoryId, setCategoryId] = React.useState(categories[0]?.id ?? "");
  const [amount, setAmount] = React.useState<number>(0);
  const [description, setDescription] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [ok, setOk] = React.useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    setOk(false);
    const res = await createKasirExpense({ categoryId, amount, description });
    setBusy(false);
    if (!res.ok) setError(res.error);
    else {
      setOk(true);
      setAmount(0);
      setDescription("");
      router.refresh();
    }
  }

  return (
    <Card>
      <CardHeader
        title={
          <span className="inline-flex items-center gap-2">
            <Wallet className="size-4 text-primary" /> Kas Keluar Baru
          </span>
        }
        description="Wajib shift dalam keadaan OPEN"
      />
      <CardBody className="space-y-4">
        <div>
          <Label htmlFor="cat">Kategori</Label>
          <Select id="cat" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="amount">Nominal</Label>
          <Input
            id="amount"
            type="number"
            min={0}
            value={amount || ""}
            placeholder="0"
            onChange={(e) => setAmount(Math.max(Number(e.target.value) || 0, 0))}
            className="h-12 text-right text-lg font-extrabold"
          />
        </div>
        <div>
          <Label htmlFor="desc">Keterangan</Label>
          <Input
            id="desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="cth: beli kresek 2 pak"
          />
        </div>
        {error ? <p className="rounded-lg bg-danger-soft px-3 py-2 text-xs font-semibold text-red-800">{error}</p> : null}
        {ok ? <p className="rounded-lg bg-success-soft px-3 py-2 text-xs font-semibold text-green-800">Tersimpan ✅</p> : null}
        <Button size="lg" className="w-full" disabled={busy || amount <= 0 || !description.trim()} onClick={submit}>
          {busy ? "Menyimpan…" : "Simpan Pengeluaran"}
        </Button>
      </CardBody>
    </Card>
  );
}
