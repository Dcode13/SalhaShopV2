"use client";

import * as React from "react";
import Image from "next/image";
import { useActionState } from "react";
import { Eye, EyeOff, Loader2, LogIn } from "lucide-react";
import { loginAction, type LoginState } from "@/server/actions/auth";
import { Input, Label } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(loginAction, {});
  const [showPw, setShowPw] = React.useState(false);

  return (
    <div className="theme-owner flex min-h-dvh items-center justify-center bg-gradient-to-br from-sidebar via-[#341d63] to-primary-strong p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="flex size-20 items-center justify-center rounded-2xl bg-white p-2 shadow-pop">
            <Image src="/salhashoplogo.png" alt="Logo Salha Shop" width={64} height={64} className="size-16 object-contain" priority />
          </span>
          <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-white">Salha Shop</h1>
          <p className="mt-1 text-sm text-white/70">Sistem Manajemen Lapak Grosir & Kios Terminal</p>
        </div>

        <form action={formAction} className="rounded-2xl bg-surface p-6 shadow-pop">
          <div className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                inputMode="email"
                autoComplete="username"
                placeholder="nama@salhashop.id"
                required
                autoFocus
              />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPw ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  required
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-ink-faint hover:text-ink"
                  aria-label={showPw ? "Sembunyikan password" : "Tampilkan password"}
                >
                  {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            {state.error ? (
              <p className="rounded-lg bg-danger-soft px-3 py-2 text-xs font-semibold text-red-800">{state.error}</p>
            ) : null}

            <Button type="submit" size="lg" className="w-full" disabled={pending}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : <LogIn className="size-4" />}
              Masuk
            </Button>
          </div>
        </form>

        <p className="mt-4 text-center text-[11px] text-white/50">
          Kasir masuk ke outlet masing-masing · Owner memantau semua outlet
        </p>
      </div>
    </div>
  );
}
