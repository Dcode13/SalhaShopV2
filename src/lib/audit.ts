import "server-only";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

type AuditInput = {
  userId: string;
  action: "CREATE" | "UPDATE" | "DELETE" | "VOID" | "LOGIN" | "RECEIVE";
  entityType: string;
  entityId: string;
  oldValue?: Prisma.InputJsonValue;
  newValue?: Prisma.InputJsonValue;
};

/** Tulis audit log. Kegagalan audit tidak boleh menggagalkan transaksi utama. */
export async function logAudit(input: AuditInput, tx?: Prisma.TransactionClient) {
  try {
    await (tx ?? prisma).auditLog.create({
      data: {
        userId: input.userId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        oldValue: input.oldValue,
        newValue: input.newValue,
      },
    });
  } catch (e) {
    console.error("Gagal menulis audit log:", e);
  }
}
