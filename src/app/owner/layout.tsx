import { requireOwner } from "@/lib/auth";
import { AppShell } from "@/components/layout/app-shell";

export const dynamic = "force-dynamic";

export default async function OwnerLayout({ children }: { children: React.ReactNode }) {
  const user = await requireOwner();
  return (
    <AppShell theme="owner" userName={user.name} outletName={null}>
      {children}
    </AppShell>
  );
}
