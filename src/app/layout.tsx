import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Salha Shop — Sistem Manajemen",
    template: "%s · Salha Shop",
  },
  description: "Sistem manajemen Lapak Grosir & Kios Terminal Salha Shop",
  // favicon & apple icon otomatis dari src/app/icon.png + apple-icon.png (27 KB, bukan logo mentah 795 KB)
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover", // safe-area utk bottom nav di HP ber-notch
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className={`${jakarta.variable} antialiased`}>{children}</body>
    </html>
  );
}
