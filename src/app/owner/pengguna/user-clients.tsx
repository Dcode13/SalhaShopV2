"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { KeyRound, UserPlus } from "lucide-react";
import { createKasir, resetPassword, toggleUserActive } from "@/server/actions/users";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/field";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";

export function CreateKasirForm({ outlets }: { outlets: { id: string; name: string }[] }) {
  const router = useRouter();
  const [form, setForm] = React.useState({ name: "", email: "", password: "", outletId: outlets[0]?.id ?? "", phone: "" });
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [ok, setOk] = React.useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    setOk(false);
    const res = await createKasir(form);
    setBusy(false);
    if (!res.ok) setError(res.error);
    else {
      setOk(true);
      setForm({ name: "", email: "", password: "", outletId: form.outletId, phone: "" });
      router.refresh();
    }
  }

  return (
    <Card className="self-start">
      <CardHeader
        title={
          <span className="inline-flex items-center gap-2">
            <UserPlus className="size-4 text-primary" /> Akun Kasir Baru
          </span>
        }
        description="Kasir otomatis terikat ke satu outlet"
      />
      <CardBody className="space-y-3">
        <div>
          <Label>Nama</Label>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nama kasir" />
        </div>
        <div>
          <Label>Email (untuk login)</Label>
          <Input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="kasir@salhashop.id"
          />
        </div>
        <div>
          <Label>Password awal (min. 6 karakter)</Label>
          <Input
            type="text"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder="beritahu langsung ke kasir"
          />
        </div>
        <div>
          <Label>Outlet</Label>
          <Select value={form.outletId} onChange={(e) => setForm({ ...form, outletId: e.target.value })}>
            {outlets.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>No. HP (opsional)</Label>
          <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="08xx…" />
        </div>
        {error ? <p className="rounded-lg bg-danger-soft px-3 py-2 text-xs font-semibold text-red-800">{error}</p> : null}
        {ok ? <p className="rounded-lg bg-success-soft px-3 py-2 text-xs font-semibold text-green-800">Akun kasir dibuat ✅</p> : null}
        <Button className="w-full" disabled={busy || !form.name || !form.email || form.password.length < 6} onClick={submit}>
          {busy ? "Membuat…" : "Buat Akun Kasir"}
        </Button>
      </CardBody>
    </Card>
  );
}

export function UserRowActions({ userId, isActive, isSelf }: { userId: string; isActive: boolean; isSelf: boolean }) {
  const router = useRouter();
  const [pwOpen, setPwOpen] = React.useState(false);
  const [newPw, setNewPw] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  return (
    <div className="flex items-center justify-end gap-2">
      <button
        type="button"
        onClick={() => setPwOpen(true)}
        className="inline-flex items-center gap-1 text-xs font-bold text-ink-muted hover:text-primary"
      >
        <KeyRound className="size-3.5" /> Reset PW
      </button>
      {!isSelf ? (
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await toggleUserActive(userId);
            setBusy(false);
            router.refresh();
          }}
          className="text-xs font-bold text-ink-muted hover:text-danger"
        >
          {isActive ? "Nonaktifkan" : "Aktifkan"}
        </button>
      ) : null}

      <Modal open={pwOpen} onClose={() => setPwOpen(false)} title="Reset Password">
        <div className="space-y-3">
          <div>
            <Label>Password baru (min. 6 karakter)</Label>
            <Input value={newPw} onChange={(e) => setNewPw(e.target.value)} autoFocus />
          </div>
          {error ? <p className="rounded-lg bg-danger-soft px-3 py-2 text-xs font-semibold text-red-800">{error}</p> : null}
          <Button
            className="w-full"
            disabled={busy || newPw.length < 6}
            onClick={async () => {
              setBusy(true);
              setError(null);
              const res = await resetPassword(userId, newPw);
              setBusy(false);
              if (!res.ok) setError(res.error);
              else {
                setPwOpen(false);
                setNewPw("");
              }
            }}
          >
            {busy ? "Menyimpan…" : "Simpan Password Baru"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
