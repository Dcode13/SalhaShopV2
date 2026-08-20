import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prisma Client dijalankan di server runtime Node.js
  serverExternalPackages: ["@prisma/client", "prisma"],
  poweredByHeader: false,
  experimental: {
    // Cache router sisi client: halaman yang baru dikunjungi tampil instan
    // saat navigasi bolak-balik (data menyusul di background ≤30 dtk).
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
    // Upload foto produk (sudah terkompres ≤2 MB) lewat server action
    serverActions: {
      bodySizeLimit: "3mb",
    },
  },
};

export default nextConfig;
