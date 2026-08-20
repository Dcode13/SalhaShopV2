import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import {
  SESSION_COOKIE,
  sessionMaxAgeSeconds,
  signSessionToken,
  verifySessionToken,
  type SessionPayload,
} from "@/lib/session";

export type CurrentUser = {
  id: string;
  email: string;
  name: string;
  role: "OWNER" | "KASIR";
  outletId: string | null;
  outletName: string | null;
  outletCode: string | null;
};

export async function createSession(payload: SessionPayload) {
  const token = await signSessionToken(payload);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: sessionMaxAgeSeconds(payload.role),
  });
}

export async function destroySession() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/**
 * Ambil user aktif dari cookie session + verifikasi ke database.
 * Di-cache per-request (React cache) supaya tidak query berulang.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const payload = await verifySessionToken(token);
  if (!payload) return null;

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    include: { outlet: { select: { name: true, code: true } } },
  });
  if (!user || !user.isActive) return null;

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    outletId: user.outletId,
    outletName: user.outlet?.name ?? null,
    outletCode: user.outlet?.code ?? null,
  };
});

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireOwner(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role !== "OWNER") redirect("/kasir/dashboard");
  return user;
}

/** Kasir wajib terikat ke satu outlet. */
export async function requireKasir(): Promise<CurrentUser & { outletId: string }> {
  const user = await requireUser();
  if (user.role !== "KASIR") redirect("/owner/dashboard");
  if (!user.outletId) redirect("/login");
  return user as CurrentUser & { outletId: string };
}

/**
 * Scoping outlet — JANGAN pernah percaya outletId dari client.
 * Owner boleh memilih outlet (atau semua), kasir dipaksa ke outletnya sendiri.
 */
export async function getScopedOutletId(requestedOutletId?: string | null): Promise<string | undefined> {
  const user = await requireUser();
  if (user.role === "OWNER") return requestedOutletId ?? undefined;
  return user.outletId ?? undefined;
}
