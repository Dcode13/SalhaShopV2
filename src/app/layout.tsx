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
  icons: { icon: "/salhashoplogo.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className={`${jakarta.variable} antialiased`}>{children}</body>
    </html>
  );
}
