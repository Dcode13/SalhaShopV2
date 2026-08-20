"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createSession, destroySession, getCurrentUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Format email tidak valid"),
  password: z.string().min(1, "Password wajib diisi"),
});

/** Rate limit sederhana per email: maks 5 percobaan gagal / 15 menit. */
const attempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

function isRateLimited(email: string): boolean {
  const now = Date.now();
  const rec = attempts.get(email);
  if (!rec || rec.resetAt < now) return false;
  return rec.count >= MAX_ATTEMPTS;
}

function recordFailure(email: string) {
  const now = Date.now();
  const rec = attempts.get(email);
  if (!rec || rec.resetAt < now) {
    attempts.set(email, { count: 1, resetAt: now + WINDOW_MS });
  } else {
    rec.count += 1;
  }
}

export type LoginState = { error?: string };

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Input tidak valid" };
  }
  const { email, password } = parsed.data;

  if (isRateLimited(email)) {
    return { error: "Terlalu banyak percobaan gagal. Coba lagi 15 menit lagi." };
  }

  const user = await prisma.user.findUnique({ where: { email } });
  const invalid = { error: "Email atau password salah." };

  if (!user || !user.passwordHash) {
    recordFailure(email);
    return invalid;
  }
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    recordFailure(email);
    return invalid;
  }
  if (!user.isActive) {
    return { error: "Akun dinonaktifkan. Hubungi owner." };
  }
  if (user.role === "KASIR" && !user.outletId) {
    return { error: "Akun kasir belum terikat ke outlet. Hubungi owner." };
  }

  attempts.delete(email);
  await createSession({
    sub: user.id,
    role: user.role,
    outletId: user.outletId,
    name: user.name,
  });
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await logAudit({ userId: user.id, action: "LOGIN", entityType: "User", entityId: user.id });

  redirect(user.role === "OWNER" ? "/owner/dashboard" : "/kasir/dashboard");
}

export async function logoutAction(): Promise<void> {
  const user = await getCurrentUser();
  await destroySession();
  if (user) {
    await logAudit({ userId: user.id, action: "UPDATE", entityType: "Session", entityId: user.id, newValue: { event: "LOGOUT" } });
  }
  redirect("/login");
}
