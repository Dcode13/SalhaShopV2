"use client";

/**
 * Pembungkus lazy-load untuk grafik recharts (~100 kB JS).
 * Grafik dimuat setelah halaman tampil — konten utama tidak menunggu.
 */
import dynamic from "next/dynamic";

function ChartSkeleton() {
  return (
    <div className="flex h-72 w-full items-end gap-2 animate-pulse rounded-xl bg-page p-4">
      {[40, 65, 50, 80, 60, 90, 70].map((h, i) => (
        <div key={i} className="flex-1 rounded-t-md bg-line" style={{ height: `${h}%` }} />
      ))}
    </div>
  );
}

export const OmzetLabaChart = dynamic(() => import("./charts").then((m) => m.OmzetLabaChart), {
  ssr: false,
  loading: () => <ChartSkeleton />,
});

export const OutletBarChart = dynamic(() => import("./charts").then((m) => m.OutletBarChart), {
  ssr: false,
  loading: () => <ChartSkeleton />,
});

export const BiayaDonut = dynamic(() => import("./charts").then((m) => m.BiayaDonut), {
  ssr: false,
  loading: () => <ChartSkeleton />,
});

export const TopProdukBar = dynamic(() => import("./charts").then((m) => m.TopProdukBar), {
  ssr: false,
  loading: () => <ChartSkeleton />,
});
