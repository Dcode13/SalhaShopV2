/**
 * Helper token session — edge-safe (dipakai juga oleh middleware).
 * Tidak boleh mengimpor Prisma di file ini.
 */
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "salha_session";

export type SessionPayload = {
  sub: string; // user id
  role: "OWNER" | "KASIR";
  outletId: string | null;
  name: string;
};

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("AUTH_SECRET belum di-set di .env (minimal 32 karakter acak).");
  }
  return new TextEncoder().encode(secret);
}

/** Masa berlaku session: kasir 12 jam (1 shift), owner 7 hari. */
export function sessionMaxAgeSeconds(role: "OWNER" | "KASIR"): number {
  return role === "OWNER" ? 7 * 24 * 60 * 60 : 12 * 60 * 60;
}

export async function signSessionToken(payload: SessionPayload): Promise<string> {
  const maxAge = sessionMaxAgeSeconds(payload.role);
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + maxAge)
    .sign(getSecret());
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (typeof payload.sub !== "string") return null;
    const role = payload.role;
    if (role !== "OWNER" && role !== "KASIR") return null;
    return {
      sub: payload.sub,
      role,
      outletId: (payload.outletId as string | null) ?? null,
      name: (payload.name as string) ?? "",
    };
  } catch {
    return null;
  }
}
