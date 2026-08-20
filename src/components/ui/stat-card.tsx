import * as React from "react";
import { cn } from "@/lib/utils";
import { formatPercent } from "@/lib/format";

/**
 * Kartu KPI dashboard. `delta` = perubahan % vs periode sebelumnya (opsional).
 * `highlight` membuat kartu memakai warna primary penuh (untuk Laba Bersih).
 */
export function StatCard({
  label,
  value,
  sub,
  delta,
  icon,
  highlight = false,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  delta?: number | null;
  icon?: React.ReactNode;
  highlight?: boolean;
}) {
  const deltaBadge =
    delta === null || delta === undefined ? null : (
      <span
        className={cn(
          "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold",
          highlight
            ? "bg-white/20 text-white"
            : delta >= 0
              ? "bg-success-soft text-green-800"
              : "bg-danger-soft text-red-800"
        )}
      >
        {delta >= 0 ? "▲" : "▼"} {formatPercent(Math.abs(delta))}
      </span>
    );

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border p-4 shadow-card transition-shadow hover:shadow-pop",
        highlight
          ? "border-primary-strong bg-gradient-to-br from-primary to-primary-strong text-white"
          : "border-line bg-surface"
      )}
    >
      {highlight ? (
        <>
          <span className="pointer-events-none absolute -right-8 -top-12 size-32 rounded-full bg-white/10" />
          <span className="pointer-events-none absolute -bottom-14 -left-6 size-24 rounded-full bg-white/5" />
        </>
      ) : null}

      <div className="flex items-start justify-between gap-2">
        <p className={cn("text-xs font-semibold", highlight ? "text-white/80" : "text-ink-muted")}>{label}</p>
        {icon ? (
          <span
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-xl",
              highlight ? "bg-white/15 text-white" : "bg-primary-soft text-primary"
            )}
          >
            {icon}
          </span>
        ) : null}
      </div>
      <p
        className={cn(
          "mt-1 text-[22px] font-extrabold leading-8 tracking-tight tabular-nums md:text-2xl",
          highlight ? "text-white" : "text-ink"
        )}
      >
        {value}
      </p>
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        {deltaBadge}
        {sub ? (
          <span className={cn("text-xs", highlight ? "text-white/75" : "text-ink-muted")}>{sub}</span>
        ) : null}
      </div>
    </div>
  );
}
