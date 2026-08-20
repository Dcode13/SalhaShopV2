/** Format angka & tanggal Indonesia. Timezone tampilan: Asia/Makassar (WITA). */

export const WITA_TZ = "Asia/Makassar";

const rp = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

const rp2 = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const num = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 });

export function formatRp(value: number): string {
  if (!Number.isFinite(value)) return "Rp 0";
  // HPP rata-rata bisa berkoma; nilai lain umumnya bulat
  return Number.isInteger(value) ? rp.format(value) : rp2.format(value);
}

export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return "0";
  return num.format(value);
}

export function formatPercent(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return "0%";
  return `${value.toFixed(digits).replace(".", ",")}%`;
}

export function formatDateID(d: Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: WITA_TZ,
  }).format(d);
}

export function formatDateLongID(d: Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: WITA_TZ,
  }).format(d);
}

export function formatTimeID(d: Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: WITA_TZ,
    hourCycle: "h23",
  }).format(d);
}

export function formatDateTimeID(d: Date): string {
  return `${formatDateID(d)} ${formatTimeID(d)}`;
}

export function formatMonthID(d: Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    month: "long",
    year: "numeric",
    timeZone: WITA_TZ,
  }).format(d);
}

/** Ringkas: Rp 1,2 jt / 850 rb — untuk label grafik. */
export function formatRpShort(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "−" : "";
  if (abs >= 1_000_000_000) return `${sign}${num.format(+(abs / 1_000_000_000).toFixed(1))} M`;
  if (abs >= 1_000_000) return `${sign}${num.format(+(abs / 1_000_000).toFixed(1))} jt`;
  if (abs >= 1_000) return `${sign}${num.format(Math.round(abs / 1_000))} rb`;
  return `${sign}${num.format(abs)}`;
}
