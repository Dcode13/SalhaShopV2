import Link from "next/link";
import { cn } from "@/lib/utils";
import type { PeriodePreset } from "@/lib/dates";

export type PeriodParams = {
  periode: PeriodePreset;
  outlet?: string; // outletId | undefined = semua
  from?: string;
  to?: string;
};

const PRESETS: { key: PeriodePreset; label: string }[] = [
  { key: "hari-ini", label: "Hari Ini" },
  { key: "7-hari", label: "7 Hari" },
  { key: "bulan-ini", label: "Bulan Ini" },
  { key: "tahun-ini", label: "Tahun Ini" },
];

function buildQuery(params: Record<string, string | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) q.set(k, v);
  }
  const s = q.toString();
  return s ? `?${s}` : "";
}

/** Filter global: preset periode + rentang custom + pilihan outlet (owner). */
export function PeriodFilter({
  basePath,
  current,
  outlets,
}: {
  basePath: string;
  current: PeriodParams;
  outlets?: { id: string; name: string }[];
}) {
  return (
    <div className="mb-5 flex flex-wrap items-center gap-2">
      <div className="flex flex-wrap gap-1 rounded-lg border border-line bg-surface p-1">
        {PRESETS.map((p) => (
          <Link
            key={p.key}
            href={`${basePath}${buildQuery({ periode: p.key, outlet: current.outlet })}`}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-bold transition-colors",
              current.periode === p.key
                ? "bg-primary text-primary-fg"
                : "text-ink-muted hover:bg-primary-soft hover:text-primary"
            )}
          >
            {p.label}
          </Link>
        ))}
      </div>

      <form action={basePath} method="get" className="flex items-center gap-1.5">
        <input type="hidden" name="periode" value="custom" />
        {current.outlet ? <input type="hidden" name="outlet" value={current.outlet} /> : null}
        <input
          type="date"
          name="from"
          defaultValue={current.from}
          className="h-9 rounded-lg border border-line bg-surface px-2 text-xs text-ink"
          required
        />
        <span className="text-xs text-ink-faint">s/d</span>
        <input
          type="date"
          name="to"
          defaultValue={current.to}
          className="h-9 rounded-lg border border-line bg-surface px-2 text-xs text-ink"
          required
        />
        <button
          type="submit"
          className="h-9 rounded-lg border border-line bg-surface px-3 text-xs font-bold text-ink-muted hover:border-primary hover:text-primary"
        >
          Terapkan
        </button>
      </form>

      {outlets ? (
        <div className="flex flex-wrap gap-1 rounded-lg border border-line bg-surface p-1">
          <Link
            href={`${basePath}${buildQuery({ periode: current.periode, from: current.from, to: current.to })}`}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-bold transition-colors",
              !current.outlet ? "bg-primary text-primary-fg" : "text-ink-muted hover:bg-primary-soft hover:text-primary"
            )}
          >
            Semua Outlet
          </Link>
          {outlets.map((o) => (
            <Link
              key={o.id}
              href={`${basePath}${buildQuery({ periode: current.periode, outlet: o.id, from: current.from, to: current.to })}`}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-bold transition-colors",
                current.outlet === o.id
                  ? "bg-primary text-primary-fg"
                  : "text-ink-muted hover:bg-primary-soft hover:text-primary"
              )}
            >
              {o.name}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Parse searchParams halaman menjadi PeriodParams yang aman. */
export function parsePeriodParams(sp: Record<string, string | string[] | undefined>): PeriodParams {
  const raw = typeof sp.periode === "string" ? sp.periode : "hari-ini";
  const periode: PeriodePreset = (
    ["hari-ini", "7-hari", "bulan-ini", "tahun-ini", "custom"] as const
  ).includes(raw as PeriodePreset)
    ? (raw as PeriodePreset)
    : "hari-ini";
  return {
    periode,
    outlet: typeof sp.outlet === "string" && sp.outlet ? sp.outlet : undefined,
    from: typeof sp.from === "string" ? sp.from : undefined,
    to: typeof sp.to === "string" ? sp.to : undefined,
  };
}
