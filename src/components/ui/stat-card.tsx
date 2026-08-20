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
        "rounded-xl border p-4 shadow-card",
        highlight
          ? "border-primary-strong bg-gradient-to-br from-primary to-primary-strong text-white"
          : "border-line bg-surface"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className={cn("text-xs font-semibold", highlight ? "text-white/80" : "text-ink-muted")}>{label}</p>
        {icon ? (
          <span className={cn(highlight ? "text-white/70" : "text-primary")}>{icon}</span>
        ) : null}
      </div>
      <p className={cn("mt-2 text-2xl font-extrabold tracking-tight tabular-nums", highlight ? "text-white" : "text-ink")}>
        {value}
      </p>
      <div className="mt-1.5 flex items-center gap-2">
        {deltaBadge}
        {sub ? (
          <span className={cn("text-xs", highlight ? "text-white/75" : "text-ink-muted")}>{sub}</span>
        ) : null}
      </div>
    </div>
  );
}
