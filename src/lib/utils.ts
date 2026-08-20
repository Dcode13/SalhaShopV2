import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Pembulatan uang 2 desimal (menghindari artefak floating point). */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Pembulatan qty 4 desimal (base unit bisa pecahan, mis. kg). */
export function round4(n: number): number {
  return Math.round((n + Number.EPSILON) * 10000) / 10000;
}
