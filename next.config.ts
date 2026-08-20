import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prisma Client dijalankan di server runtime Node.js
  serverExternalPackages: ["@prisma/client", "prisma"],
};

export default nextConfig;
