"use client";

/** Komponen grafik dashboard/rekap (recharts). Warna mengikuti token tema aktif. */

import * as React from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatRp, formatRpShort } from "@/lib/format";

const CHART_VARS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

const axisStyle = { fontSize: 11, fill: "var(--ink-faint)" };

function RpTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name?: string; value?: number | string; color?: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-pop">
      <p className="mb-1 font-bold text-ink">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="flex items-center gap-1.5 text-ink-muted">
          <span className="inline-block size-2 rounded-full" style={{ background: p.color }} />
          {p.name}: <span className="font-semibold text-ink">{formatRp(Number(p.value ?? 0))}</span>
        </p>
      ))}
    </div>
  );
}

/** Line/area: Omzet vs Laba Bersih per hari. */
export function OmzetLabaChart({ data }: { data: { label: string; Omzet: number; "Laba Bersih": number }[] }) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="gradOmzet" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.25} />
              <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gradLaba" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.25} />
              <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
          <XAxis dataKey="label" tick={axisStyle} tickLine={false} axisLine={{ stroke: "var(--line)" }} minTickGap={24} />
          <YAxis tick={axisStyle} tickLine={false} axisLine={false} tickFormatter={(v: number) => formatRpShort(v)} width={52} />
          <Tooltip content={<RpTooltip />} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Area type="monotone" dataKey="Omzet" stroke="var(--chart-1)" strokeWidth={2.5} fill="url(#gradOmzet)" dot={false} />
          <Area type="monotone" dataKey="Laba Bersih" stroke="var(--chart-2)" strokeWidth={2.5} fill="url(#gradLaba)" dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Bar bertumpuk: perbandingan omzet antar outlet per hari/bulan. */
export function OutletBarChart({ data, keys }: { data: Record<string, number | string>[]; keys: string[] }) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
          <XAxis dataKey="label" tick={axisStyle} tickLine={false} axisLine={{ stroke: "var(--line)" }} minTickGap={24} />
          <YAxis tick={axisStyle} tickLine={false} axisLine={false} tickFormatter={(v: number) => formatRpShort(v)} width={52} />
          <Tooltip content={<RpTooltip />} cursor={{ fill: "var(--primary-softer)" }} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {keys.map((k, i) => (
            <Bar key={k} dataKey={k} stackId="outlet" fill={CHART_VARS[i % CHART_VARS.length]} radius={i === keys.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} maxBarSize={40} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Donut komposisi biaya per kategori. */
export function BiayaDonut({ data }: { data: { name: string; value: number }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="80%" paddingAngle={2} strokeWidth={0}>
            {data.map((_, i) => (
              <Cell key={i} fill={CHART_VARS[i % CHART_VARS.length]} />
            ))}
          </Pie>
          <Tooltip content={<RpTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: 12 }}
            formatter={(value: string, entry) => {
              const v = (entry?.payload as { value?: number } | undefined)?.value ?? 0;
              const pct = total > 0 ? Math.round((v / total) * 100) : 0;
              return `${value} (${pct}%)`;
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Bar horizontal: produk terlaris / paling untung. */
export function TopProdukBar({ data, unit = "rp" }: { data: { name: string; value: number }[]; unit?: "rp" | "qty" }) {
  const height = Math.max(220, data.length * 34 + 30);
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" horizontal={false} />
          <XAxis
            type="number"
            tick={axisStyle}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => (unit === "rp" ? formatRpShort(v) : String(v))}
          />
          <YAxis type="category" dataKey="name" tick={{ ...axisStyle, fill: "var(--ink-muted)" }} tickLine={false} axisLine={false} width={140} />
          <Tooltip
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <div className="rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-pop">
                  <p className="font-bold text-ink">{label}</p>
                  <p className="text-ink-muted">
                    {unit === "rp" ? formatRp(Number(payload[0].value ?? 0)) : `${payload[0].value} terjual`}
                  </p>
                </div>
              ) : null
            }
            cursor={{ fill: "var(--primary-softer)" }}
          />
          <Bar dataKey="value" fill="var(--chart-1)" radius={[0, 4, 4, 0]} maxBarSize={20} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
