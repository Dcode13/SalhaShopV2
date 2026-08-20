"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Boxes,
  ClipboardCheck,
  Clock,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  ReceiptText,
  Settings,
  ShoppingCart,
  Store,
  Tags,
  Truck,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { logoutAction } from "@/server/actions/auth";

type NavItem = { href: string; label: string; icon: React.ElementType };

const OWNER_NAV: NavItem[] = [
  { href: "/owner/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/owner/transaksi", label: "Transaksi", icon: ReceiptText },
  { href: "/owner/rekap", label: "Rekap", icon: BarChart3 },
  { href: "/owner/produk", label: "Produk", icon: Package },
  { href: "/owner/stok", label: "Stok", icon: Boxes },
  { href: "/owner/pembelian", label: "Pembelian", icon: ShoppingCart },
  { href: "/owner/biaya", label: "Biaya Operasional", icon: Wallet },
  { href: "/owner/kas", label: "Kas & Shift", icon: Clock },
  { href: "/owner/kategori", label: "Kategori", icon: Tags },
  { href: "/owner/supplier", label: "Supplier", icon: Truck },
  { href: "/owner/kelengkapan", label: "Kelengkapan Data", icon: ClipboardCheck },
  { href: "/owner/pengguna", label: "Pengguna", icon: Users },
  { href: "/owner/pengaturan", label: "Pengaturan", icon: Settings },
];

const KASIR_NAV: NavItem[] = [
  { href: "/kasir/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/kasir/pos", label: "Kasir (POS)", icon: ShoppingCart },
  { href: "/kasir/transaksi", label: "Riwayat Transaksi", icon: ReceiptText },
  { href: "/kasir/stok", label: "Stok Outlet", icon: Boxes },
  { href: "/kasir/pengeluaran", label: "Pengeluaran", icon: Wallet },
  { href: "/kasir/shift", label: "Shift Kasir", icon: Clock },
];

function Brand({ subtitle }: { subtitle: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-4">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/95 p-1 shadow-sm">
        <Image
          src="/salhashoplogo.png"
          alt="Logo Salha Shop"
          width={36}
          height={36}
          className="size-8 object-contain"
          priority
        />
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-extrabold tracking-tight text-sidebar-fg">Salha Shop</p>
        <p className="truncate text-[11px] font-medium text-sidebar-muted">{subtitle}</p>
      </div>
    </div>
  );
}

function NavLinks({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-4 thin-scroll">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + "/");
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors",
              active
                ? "bg-sidebar-active text-white shadow-sm"
                : "text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-fg"
            )}
          >
            <Icon className="size-4.5 shrink-0" />
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function UserBlock({ userName, roleLabel }: { userName: string; roleLabel: string }) {
  return (
    <div className="border-t border-sidebar-line p-3">
      <div className="flex items-center gap-3 rounded-lg bg-sidebar-hover/60 px-3 py-2.5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sidebar-active text-xs font-extrabold text-white">
          {userName.slice(0, 1).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-bold text-sidebar-fg">{userName}</p>
          <p className="truncate text-[11px] text-sidebar-muted">{roleLabel}</p>
        </div>
        <form action={logoutAction}>
          <button
            type="submit"
            title="Keluar"
            className="rounded-md p-1.5 text-sidebar-muted transition-colors hover:bg-sidebar-hover hover:text-white"
          >
            <LogOut className="size-4" />
          </button>
        </form>
      </div>
    </div>
  );
}

export function AppShell({
  theme,
  userName,
  outletName,
  children,
}: {
  theme: "owner" | "kasir";
  userName: string;
  outletName: string | null;
  children: React.ReactNode;
}) {
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const items = theme === "owner" ? OWNER_NAV : KASIR_NAV;
  const roleLabel = theme === "owner" ? "Owner" : `Kasir · ${outletName ?? "-"}`;
  const subtitle = theme === "owner" ? "Panel Owner" : (outletName ?? "Kasir");

  return (
    <div className={cn(theme === "owner" ? "theme-owner" : "theme-kasir", "min-h-dvh bg-page")}>
      {/* Sidebar desktop */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-sidebar lg:flex no-print">
        <Brand subtitle={subtitle} />
        <NavLinks items={items} />
        <UserBlock userName={userName} roleLabel={roleLabel} />
      </aside>

      {/* Navbar mobile */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between bg-sidebar pr-2 lg:hidden no-print">
        <div className="flex items-center gap-2">
          <span className="ml-3 flex size-9 items-center justify-center rounded-lg bg-white/95 p-1">
            <Image src="/salhashoplogo.png" alt="Logo Salha Shop" width={30} height={30} className="size-7 object-contain" />
          </span>
          <div className="leading-tight">
            <p className="text-sm font-extrabold text-sidebar-fg">Salha Shop</p>
            <p className="text-[10px] font-medium text-sidebar-muted">{subtitle}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="rounded-lg p-2 text-sidebar-fg hover:bg-sidebar-hover"
          aria-label="Buka menu"
        >
          <Menu className="size-6" />
        </button>
      </header>

      {/* Drawer mobile */}
      {drawerOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDrawerOpen(false)} aria-hidden />
          <div className="absolute inset-y-0 left-0 flex w-72 flex-col bg-sidebar shadow-pop">
            <div className="flex items-center justify-between pr-2">
              <Brand subtitle={subtitle} />
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="rounded-lg p-2 text-sidebar-muted hover:bg-sidebar-hover hover:text-white"
                aria-label="Tutup menu"
              >
                <X className="size-5" />
              </button>
            </div>
            <NavLinks items={items} onNavigate={() => setDrawerOpen(false)} />
            <UserBlock userName={userName} roleLabel={roleLabel} />
          </div>
        </div>
      ) : null}

      {/* Konten */}
      <main className="min-h-dvh lg:pl-64">
        <div className="mx-auto max-w-7xl p-4 lg:p-6">{children}</div>
      </main>

      {/* Penanda outlet di pojok (kasir) */}
      {theme === "kasir" && outletName ? (
        <div className="pointer-events-none fixed bottom-3 right-3 z-20 no-print">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-sidebar px-3 py-1.5 text-[11px] font-bold text-sidebar-fg shadow-pop">
            <Store className="size-3.5" /> {outletName}
          </span>
        </div>
      ) : null}
    </div>
  );
}
