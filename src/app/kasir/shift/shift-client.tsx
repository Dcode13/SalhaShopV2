"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Clock, LockKeyhole } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatRp, formatTimeID } from "@/lib/format";
import { closeShift, openShift, type CloseShiftSummary } from "@/server/actions/shifts";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/field";
import { Card, CardBody, CardHeader } from "@/components/ui/card";

type OpenSessionInfo = {
  openedAt: string;
  openingCash: number;
  cashSales: number;
  nonCashSales: number;
  cashExpenses: number;
  totalTx: number;
};

export function ShiftClient({ openSession }: { openSession: OpenSessionInfo | null }) {
  const router = useRouter();
  const [openingCash, setOpeningCash] = React.useState<number>(0);
  const [actualCash, setActualCash] = React.useState<number>(0);
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [summary, setSummary] = React.useState<CloseShiftSummary | null>(null);

  async function handleOpen() {
    setBusy(true);
    setError(null);
    const res = await openShift(openingCash);
    setBusy(false);
    if (!res.ok) setError(res.error);
    else router.refresh();
  }

  async function handleClose() {
    setBusy(true);
    setError(null);
    const res = await closeShift(actualCash, note);
    setBusy(false);
    if (!res.ok) setError(res.error);
    else {
      setSummary(res.data);
      router.refresh();
    }
  }

  if (summary) {
    const rows: [string, string][] = [
      ["Kas awal", formatRp(summary.openingCash)],
      ["Penjualan tunai", formatRp(summary.cashSales)],
      ["Penjualan non-tunai", formatRp(summary.nonCashSales)],
      ["Kas keluar", `− ${formatRp(summary.cashExpenses)}`],
      ["Kas seharusnya", formatRp(summary.expectedCash)],
      ["Kas fisik dihitung", formatRp(summary.actualCash)],
    ];
    return (
      <Card>
        <CardHeader title="Shift Ditutup ✅" description={`${summary.totalTx} transaksi tercatat`} />
        <CardBody>
          <div className="space-y-2">
            {rows.map(([k, v]) => (
              <div key={k} className="flex justify-between text-sm">
                <span className="text-ink-muted">{k}</span>
                <span className="font-semibold tabular-nums">{v}</span>
              </div>
            ))}
            <div className="flex items-center justify-between border-t border-line pt-3">
              <span className="text-sm font-bold">SELISIH</span>
              <span
                className={cn(
                  "text-2xl font-extrabold tabular-nums",
                  summary.difference === 0 ? "text-success" : summary.difference < 0 ? "text-danger" : "text-warn"
                )}
              >
                {summary.difference > 0 ? "+" : ""}
                {formatRp(summary.difference)}
              </span>
            </div>
            {summary.difference !== 0 ? (
              <p className="rounded-lg bg-warn-soft px-3 py-2 text-xs font-semibold text-amber-800">
                Ada selisih kas — owner akan melihat angka ini di dashboard.
              </p>
            ) : (
              <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-success">
                <CheckCircle2 className="size-4" /> Kas cocok sempurna. Kerja bagus!
              </p>
            )}
            <Button className="mt-2 w-full" onClick={() => setSummary(null)}>
              Selesai
            </Button>
          </div>
        </CardBody>
      </Card>
    );
  }

  if (!openSession) {
    return (
      <Card>
        <CardHeader
          title={
            <span className="inline-flex items-center gap-2">
              <Clock className="size-4 text-primary" /> Buka Shift
            </span>
          }
          description="Hitung uang modal di laci sebelum mulai melayani"
        />
        <CardBody className="space-y-4">
          <div>
            <Label htmlFor="opening">Kas Awal (modal laci)</Label>
            <Input
              id="opening"
              type="number"
              min={0}
              value={openingCash || ""}
              placeholder="0"
              onChange={(e) => setOpeningCash(Math.max(Number(e.target.value) || 0, 0))}
              className="h-12 text-right text-lg font-extrabold"
            />
          </div>
          {error ? <p className="rounded-lg bg-danger-soft px-3 py-2 text-xs font-semibold text-red-800">{error}</p> : null}
          <Button size="xl" className="w-full" disabled={busy} onClick={handleOpen}>
            {busy ? "Membuka…" : "Buka Shift"}
          </Button>
        </CardBody>
      </Card>
    );
  }

  const expected = openSession.openingCash + openSession.cashSales - openSession.cashExpenses;
  const diffPreview = actualCash - expected;

  return (
    <Card>
      <CardHeader
        title={
          <span className="inline-flex items-center gap-2">
            <LockKeyhole className="size-4 text-primary" /> Tutup Shift
          </span>
        }
        description={`Shift dibuka ${formatTimeID(new Date(openSession.openedAt))} · ${openSession.totalTx} transaksi`}
      />
      <CardBody className="space-y-4">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-lg bg-page px-3 py-2">
            <p className="text-[11px] font-semibold text-ink-muted">Kas awal</p>
            <p className="font-bold tabular-nums">{formatRp(openSession.openingCash)}</p>
          </div>
          <div className="rounded-lg bg-page px-3 py-2">
            <p className="text-[11px] font-semibold text-ink-muted">Penjualan tunai</p>
            <p className="font-bold tabular-nums">{formatRp(openSession.cashSales)}</p>
          </div>
          <div className="rounded-lg bg-page px-3 py-2">
            <p className="text-[11px] font-semibold text-ink-muted">Kas keluar</p>
            <p className="font-bold tabular-nums">− {formatRp(openSession.cashExpenses)}</p>
          </div>
          <div className="rounded-lg bg-primary-soft px-3 py-2">
            <p className="text-[11px] font-semibold text-primary-strong">Kas seharusnya</p>
            <p className="font-extrabold text-primary-strong tabular-nums">{formatRp(expected)}</p>
          </div>
        </div>

        <div>
          <Label htmlFor="actual">Hasil Hitung Kas Fisik</Label>
          <Input
            id="actual"
            type="number"
            min={0}
            value={actualCash || ""}
            placeholder="0"
            onChange={(e) => setActualCash(Math.max(Number(e.target.value) || 0, 0))}
            className="h-12 text-right text-lg font-extrabold"
          />
          {actualCash > 0 ? (
            <p
              className={cn(
                "mt-1.5 text-xs font-bold",
                diffPreview === 0 ? "text-success" : diffPreview < 0 ? "text-danger" : "text-warn"
              )}
            >
              Selisih: {diffPreview > 0 ? "+" : ""}
              {formatRp(diffPreview)}
            </p>
          ) : null}
        </div>

        <div>
          <Label htmlFor="note">Catatan (opsional)</Label>
          <Textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="cth: selisih karena uang sobek" />
        </div>

        {error ? <p className="rounded-lg bg-danger-soft px-3 py-2 text-xs font-semibold text-red-800">{error}</p> : null}
        <Button size="xl" variant="danger" className="w-full" disabled={busy || actualCash <= 0} onClick={handleClose}>
          {busy ? "Menutup…" : "Tutup Shift & Rekonsiliasi"}
        </Button>
      </CardBody>
    </Card>
  );
}
