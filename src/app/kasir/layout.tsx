import { requireKasir } from "@/lib/auth";
import { AppShell } from "@/components/layout/app-shell";

export const dynamic = "force-dynamic";

export default async function KasirLayout({ children }: { children: React.ReactNode }) {
  const user = await requireKasir();
  return (
    <AppShell theme="kasir" userName={user.name} outletName={user.outletName}>
      {children}
    </AppShell>
  );
}
