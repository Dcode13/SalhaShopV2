/**
 * Helper tanggal untuk timezone WITA (Asia/Makassar, UTC+8, tanpa DST).
 * Semua timestamp disimpan UTC di database; batas "hari" dihitung menurut WITA
 * supaya rekap harian tidak bergeser 8 jam.
 */

const OFFSET_MS = 8 * 60 * 60 * 1000; // UTC+8

/** 'yyyy-MM-dd' menurut kalender WITA untuk sebuah instant. */
export function witaDateKey(d: Date): string {
  return new Date(d.getTime() + OFFSET_MS).toISOString().slice(0, 10);
}

/** Instant UTC dari pukul 00:00 WITA pada hari yang memuat `d`. */
export function witaStartOfDay(d: Date): Date {
  return keyToInstant(witaDateKey(d));
}

/** Instant UTC dari 00:00 WITA tanggal `key` ('yyyy-MM-dd'). */
export function keyToInstant(key: string): Date {
  return new Date(new Date(`${key}T00:00:00Z`).getTime() - OFFSET_MS);
}

/** Tanggal kalender (UTC midnight) untuk kolom @db.Date — dari key WITA. */
export function keyToDateColumn(key: string): Date {
  return new Date(`${key}T00:00:00Z`);
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86_400_000);
}

export function witaStartOfWeek(d: Date): Date {
  // Minggu dimulai Senin
  const shifted = new Date(d.getTime() + OFFSET_MS);
  const day = shifted.getUTCDay(); // 0 = Minggu
  const diff = day === 0 ? 6 : day - 1;
  return addDays(witaStartOfDay(d), -diff);
}

export function witaStartOfMonth(d: Date): Date {
  return keyToInstant(`${witaDateKey(d).slice(0, 7)}-01`);
}

export function witaStartOfNextMonth(d: Date): Date {
  const key = witaDateKey(d);
  const y = Number(key.slice(0, 4));
  const m = Number(key.slice(5, 7));
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  return keyToInstant(`${ny}-${String(nm).padStart(2, "0")}-01`);
}

export function witaStartOfYear(d: Date): Date {
  return keyToInstant(`${witaDateKey(d).slice(0, 4)}-01-01`);
}

export function witaMonthOfYear(year: number, month1to12: number): Date {
  return keyToInstant(`${year}-${String(month1to12).padStart(2, "0")}-01`);
}

/** Parse input <input type="date"> ('yyyy-MM-dd') sebagai 00:00 WITA. */
export function parseDateInput(s: string | null | undefined): Date | null {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return keyToInstant(s);
}

export type PeriodePreset = "hari-ini" | "7-hari" | "bulan-ini" | "tahun-ini" | "custom";

export type DateRange = { from: Date; to: Date }; // [from, to) — to eksklusif

/** Rentang periode preset, dihitung dari "sekarang" menurut WITA. */
export function rangeForPreset(preset: PeriodePreset, customFrom?: Date | null, customTo?: Date | null): DateRange {
  const now = new Date();
  const todayStart = witaStartOfDay(now);
  switch (preset) {
    case "hari-ini":
      return { from: todayStart, to: addDays(todayStart, 1) };
    case "7-hari":
      return { from: addDays(todayStart, -6), to: addDays(todayStart, 1) };
    case "bulan-ini":
      return { from: witaStartOfMonth(now), to: addDays(todayStart, 1) };
    case "tahun-ini":
      return { from: witaStartOfYear(now), to: addDays(todayStart, 1) };
    case "custom": {
      const from = customFrom ?? todayStart;
      const toInc = customTo ?? from;
      return { from, to: addDays(witaStartOfDay(toInc), 1) };
    }
  }
}

/** Rentang periode sebelumnya dengan durasi sama (untuk pembanding %). */
export function previousRange(range: DateRange): DateRange {
  const dur = range.to.getTime() - range.from.getTime();
  return { from: new Date(range.from.getTime() - dur), to: range.from };
}

/** Daftar key harian WITA dalam rentang [from, to). */
export function dayKeysInRange(range: DateRange): string[] {
  const keys: string[] = [];
  let cur = range.from;
  while (cur < range.to) {
    keys.push(witaDateKey(cur));
    cur = addDays(cur, 1);
  }
  return keys;
}
