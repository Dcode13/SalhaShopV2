"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export type UserResult = { ok: true } | { ok: false; error: string };

const kasirSchema = z.object({
  name: z.string().trim().min(1, "Nama wajib diisi"),
  email: z.string().trim().toLowerCase().email("Format email tidak valid"),
  password: z.string().min(6, "Password minimal 6 karakter"),
  outletId: z.string().min(1, "Outlet wajib dipilih"),
  phone: z.string().trim().optional(),
});

/** Owner membuat akun kasir baru, terikat ke satu outlet. */
export async function createKasir(input: z.infer<typeof kasirSchema>): Promise<UserResult> {
  const owner = await requireOwner();
  const parsed = kasirSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Input tidak valid" };
  const data = parsed.data;

  const exists = await prisma.user.findUnique({ where: { email: data.email } });
  if (exists) return { ok: false, error: "Email sudah terdaftar." };

  const user = await prisma.user.create({
    data: {
      email: data.email,
      passwordHash: bcrypt.hashSync(data.password, 10),
      name: data.name,
      role: "KASIR",
      outletId: data.outletId,
      phone: data.phone || null,
    },
  });
  await logAudit({
    userId: owner.id,
    action: "CREATE",
    entityType: "User",
    entityId: user.id,
    newValue: { email: data.email, name: data.name, outletId: data.outletId },
  });
  revalidatePath("/owner/pengguna");
  return { ok: true };
}

/** Aktif/nonaktifkan akun (tidak pernah hapus fisik). */
export async function toggleUserActive(userId: string): Promise<UserResult> {
  const owner = await requireOwner();
  if (userId === owner.id) return { ok: false, error: "Tidak bisa menonaktifkan akun sendiri." };

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { ok: false, error: "User tidak ditemukan." };

  await prisma.user.update({ where: { id: userId }, data: { isActive: !user.isActive } });
  await logAudit({
    userId: owner.id,
    action: "UPDATE",
    entityType: "User",
    entityId: userId,
    oldValue: { isActive: user.isActive },
    newValue: { isActive: !user.isActive },
  });
  revalidatePath("/owner/pengguna");
  return { ok: true };
}

/** Reset password kasir/owner oleh owner. */
export async function resetPassword(userId: string, newPassword: string): Promise<UserResult> {
  const owner = await requireOwner();
  if (!newPassword || newPassword.length < 6) {
    return { ok: false, error: "Password baru minimal 6 karakter." };
  }
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: bcrypt.hashSync(newPassword, 10) },
  });
  await logAudit({
    userId: owner.id,
    action: "UPDATE",
    entityType: "User",
    entityId: userId,
    newValue: { event: "RESET_PASSWORD" },
  });
  revalidatePath("/owner/pengguna");
  return { ok: true };
}

/** Pindahkan kasir ke outlet lain. */
export async function assignOutlet(userId: string, outletId: string): Promise<UserResult> {
  const owner = await requireOwner();
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.role !== "KASIR") return { ok: false, error: "Hanya akun kasir yang bisa dipindah outlet." };

  await prisma.user.update({ where: { id: userId }, data: { outletId } });
  await logAudit({
    userId: owner.id,
    action: "UPDATE",
    entityType: "User",
    entityId: userId,
    oldValue: { outletId: user.outletId },
    newValue: { outletId },
  });
  revalidatePath("/owner/pengguna");
  return { ok: true };
}
