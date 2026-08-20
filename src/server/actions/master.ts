"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export type MasterResult = { ok: true; id: string } | { ok: false; error: string };

// ── Kategori produk ─────────────────────────────────────────

/** Dipakai juga oleh tombol "+ kategori baru" inline di form produk. */
export async function createCategory(name: string): Promise<MasterResult> {
  await requireOwner();
  const trimmed = name?.trim();
  if (!trimmed) return { ok: false, error: "Nama kategori wajib diisi." };
  try {
    const max = await prisma.category.aggregate({ _max: { sortOrder: true } });
    const cat = await prisma.category.create({
      data: { name: trimmed, sortOrder: (max._max.sortOrder ?? 0) + 1 },
    });
    revalidatePath("/owner/kategori");
    revalidatePath("/owner/produk");
    return { ok: true, id: cat.id };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, error: "Kategori dengan nama itu sudah ada." };
    }
    return { ok: false, error: "Gagal membuat kategori." };
  }
}

export async function renameCategory(id: string, name: string): Promise<MasterResult> {
  await requireOwner();
  const trimmed = name?.trim();
  if (!trimmed) return { ok: false, error: "Nama kategori wajib diisi." };
  try {
    await prisma.category.update({ where: { id }, data: { name: trimmed } });
    revalidatePath("/owner/kategori");
    return { ok: true, id };
  } catch {
    return { ok: false, error: "Gagal mengubah kategori (nama mungkin sudah dipakai)." };
  }
}

export async function toggleCategory(id: string): Promise<void> {
  await requireOwner();
  const cat = await prisma.category.findUniqueOrThrow({ where: { id } });
  await prisma.category.update({ where: { id }, data: { isActive: !cat.isActive } });
  revalidatePath("/owner/kategori");
}

// ── Supplier ────────────────────────────────────────────────

export async function saveSupplier(input: {
  id?: string;
  name: string;
  phone?: string;
  address?: string;
  note?: string;
}): Promise<MasterResult> {
  const user = await requireOwner();
  const name = input.name?.trim();
  if (!name) return { ok: false, error: "Nama supplier wajib diisi." };

  const data = {
    name,
    phone: input.phone?.trim() || null,
    address: input.address?.trim() || null,
    note: input.note?.trim() || null,
  };

  const supplier = input.id
    ? await prisma.supplier.update({ where: { id: input.id }, data })
    : await prisma.supplier.create({ data });

  await logAudit({
    userId: user.id,
    action: input.id ? "UPDATE" : "CREATE",
    entityType: "Supplier",
    entityId: supplier.id,
    newValue: data,
  });
  revalidatePath("/owner/supplier");
  return { ok: true, id: supplier.id };
}

export async function toggleSupplier(id: string): Promise<void> {
  await requireOwner();
  const s = await prisma.supplier.findUniqueOrThrow({ where: { id } });
  await prisma.supplier.update({ where: { id }, data: { isActive: !s.isActive } });
  revalidatePath("/owner/supplier");
}

// ── Kategori biaya ──────────────────────────────────────────

export async function createExpenseCategory(name: string): Promise<MasterResult> {
  await requireOwner();
  const trimmed = name?.trim();
  if (!trimmed) return { ok: false, error: "Nama kategori biaya wajib diisi." };
  try {
    const cat = await prisma.expenseCategory.create({ data: { name: trimmed } });
    revalidatePath("/owner/biaya");
    return { ok: true, id: cat.id };
  } catch {
    return { ok: false, error: "Kategori biaya itu sudah ada." };
  }
}

// ── Pengaturan ──────────────────────────────────────────────

export async function saveSettings(entries: { key: string; value: string }[]): Promise<{ ok: boolean }> {
  const user = await requireOwner();
  for (const { key, value } of entries) {
    await prisma.setting.upsert({ where: { key }, update: { value }, create: { key, value } });
  }
  await logAudit({
    userId: user.id,
    action: "UPDATE",
    entityType: "Setting",
    entityId: "settings",
    newValue: Object.fromEntries(entries.map((e) => [e.key, e.value])),
  });
  revalidatePath("/owner/pengaturan");
  return { ok: true };
}
