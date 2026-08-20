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
  Tags,
  Truck,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { logoutAction } from "@/server/actions/auth";

type NavItem = { href: string; label: string; icon: React.ElementType };
type NavGroup = { label: string; items: NavItem[] };

const OWNER_GROUPS: NavGroup[] = [
  {
    label: "Utama",
    items: [
      { href: "/owner/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/owner/transaksi", label: "Transaksi", icon: ReceiptText },
      { href: "/owner/rekap", label: "Rekap", icon: BarChart3 },
    ],
  },
  {
    label: "Inventori",
    items: [
      { href: "/owner/produk", label: "Produk", icon: Package },
      { href: "/owner/stok", label: "Stok", icon: Boxes },
      { href: "/owner/pembelian", label: "Pembelian", icon: ShoppingCart },
    ],
  },
  {
    label: "Keuangan",
    items: [
      { href: "/owner/biaya", label: "Biaya Operasional", icon: Wallet },
      { href: "/owner/kas", label: "Kas & Shift", icon: Clock },
    ],
  },
  {
    label: "Master & Sistem",
    items: [
      { href: "/owner/kategori", label: "Kategori", icon: Tags },
      { href: "/owner/supplier", label: "Supplier", icon: Truck },
      { href: "/owner/kelengkapan", label: "Kelengkapan Data", icon: ClipboardCheck },
      { href: "/owner/pengguna", label: "Pengguna", icon: Users },
      { href: "/owner/pengaturan", label: "Pengaturan", icon: Settings },
    ],
  },
];

const KASIR_GROUPS: NavGroup[] = [
  {
    label: "Utama",
    items: [
      { href: "/kasir/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/kasir/pos", label: "Kasir (POS)", icon: ShoppingCart },
    ],
  },
  {
    label: "Aktivitas",
    items: [
      { href: "/kasir/transaksi", label: "Riwayat Transaksi", icon: ReceiptText },
      { href: "/kasir/stok", label: "Stok Outlet", icon: Boxes },
      { href: "/kasir/pengeluaran", label: "Pengeluaran", icon: Wallet },
      { href: "/kasir/shift", label: "Shift Kasir", icon: Clock },
    ],
  },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

function Brand({ subtitle }: { subtitle: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-4">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-white/95 p-1 shadow-sm ring-2 ring-white/10">
        <Image
          src="/salhashoplogo.png"
          alt="Logo Salha Shop"
          width={38}
          height={38}
          className="size-8.5 object-contain"
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

function NavLinks({ groups, onNavigate }: { groups: NavGroup[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex-1 space-y-4 overflow-y-auto px-2 pb-4 thin-scroll">
      {groups.map((group) => (
        <div key={group.label}>
          <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-[0.12em] text-sidebar-muted/70">
            {group.label}
          </p>
          <div className="space-y-0.5">
            {group.items.map((item) => {
              const active = isActive(pathname, item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all",
                    active
                      ? "bg-sidebar-active text-white shadow-md shadow-black/20"
                      : "text-sidebar-muted hover:translate-x-0.5 hover:bg-sidebar-hover hover:text-sidebar-fg"
                  )}
                >
                  <Icon className="size-4.5 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

function UserBlock({ userName, roleLabel }: { userName: string; roleLabel: string }) {
  return (
    <div className="border-t border-sidebar-line p-3">
      <div className="flex items-center gap-3 rounded-xl bg-sidebar-hover/60 px-3 py-2.5">
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

/** Bottom tab bar (HP & tablet kecil). Kasir dapat tombol POS besar di tengah. */
function BottomNav({ theme, onMenu }: { theme: "owner" | "kasir"; onMenu: () => void }) {
  const pathname = usePathname();

  const Tab = ({ href, label, icon: Icon }: NavItem) => {
    const active = isActive(pathname, href);
    return (
      <Link
        href={href}
        className={cn(
          "flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-bold transition-colors",
          active ? "text-primary" : "text-ink-faint hover:text-ink-muted"
        )}
      >
        <span className={cn("rounded-xl px-3 py-1 transition-colors", active && "bg-primary-soft")}>
          <Icon className="size-5" />
        </span>
        {label}
      </Link>
    );
  };

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur pb-safe lg:hidden no-print">
      <div className="mx-auto flex max-w-lg items-stretch">
        {theme === "kasir" ? (
          <>
            <Tab href="/kasir/dashboard" label="Beranda" icon={LayoutDashboard} />
            <Tab href="/kasir/transaksi" label="Riwayat" icon={ReceiptText} />
            <div className="relative flex flex-1 justify-center">
              <Link
                href="/kasir/pos"
                aria-label="Buka kasir (POS)"
                className="absolute -top-6 flex size-14 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary-strong text-white shadow-pop ring-4 ring-surface transition-transform active:scale-95"
              >
                <ShoppingCart className="size-6" />
              </Link>
              <span className="mt-auto pb-1.5 pt-9 text-[10px] font-bold text-ink-faint">Kasir</span>
            </div>
            <Tab href="/kasir/shift" label="Shift" icon={Clock} />
          </>
        ) : (
          <>
            <Tab href="/owner/dashboard" label="Beranda" icon={LayoutDashboard} />
            <Tab href="/owner/transaksi" label="Transaksi" icon={ReceiptText} />
            <Tab href="/owner/rekap" label="Rekap" icon={BarChart3} />
            <Tab href="/owner/stok" label="Stok" icon={Boxes} />
          </>
        )}
        <button
          type="button"
          onClick={onMenu}
          className="flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-bold text-ink-faint transition-colors hover:text-ink-muted"
        >
          <span className="rounded-xl px-3 py-1">
            <Menu className="size-5" />
          </span>
          Menu
        </button>
      </div>
    </nav>
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
  const groups = theme === "owner" ? OWNER_GROUPS : KASIR_GROUPS;
  const roleLabel = theme === "owner" ? "Owner" : `Kasir · ${outletName ?? "-"}`;
  const subtitle = theme === "owner" ? "Panel Owner" : (outletName ?? "Kasir");

  return (
    <div className={cn(theme === "owner" ? "theme-owner" : "theme-kasir", "app-bg min-h-dvh")}>
      {/* Sidebar desktop */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-gradient-to-b from-sidebar via-sidebar to-sidebar-hover/80 lg:flex no-print">
        <Brand subtitle={subtitle} />
        <NavLinks groups={groups} />
        <UserBlock userName={userName} roleLabel={roleLabel} />
      </aside>

      {/* Navbar mobile */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between bg-sidebar pr-2 shadow-md shadow-black/10 lg:hidden no-print">
        <div className="flex items-center gap-2.5">
          <span className="ml-3 flex size-9 items-center justify-center rounded-xl bg-white/95 p-1">
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

      {/* Drawer mobile (menu lengkap) */}
      {drawerOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50 animate-fade-in" onClick={() => setDrawerOpen(false)} aria-hidden />
          <div className="absolute inset-y-0 left-0 flex w-72 flex-col bg-sidebar shadow-pop animate-slide-in-left">
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
            <NavLinks groups={groups} onNavigate={() => setDrawerOpen(false)} />
            <UserBlock userName={userName} roleLabel={roleLabel} />
          </div>
        </div>
      ) : null}

      {/* Konten */}
      <main className="min-h-dvh lg:pl-64">
        <div className="mx-auto max-w-7xl p-4 pb-28 lg:p-6 lg:pb-10">{children}</div>
      </main>

      {/* Bottom tab bar (mobile/tablet kecil) */}
      <BottomNav theme={theme} onMenu={() => setDrawerOpen(true)} />
    </div>
  );
}
