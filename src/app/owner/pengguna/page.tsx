import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/auth";
import { formatDateTimeID } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyRow, Table, TableWrap, Td, Th } from "@/components/ui/table";
import { CreateKasirForm, UserRowActions } from "./user-clients";

export const dynamic = "force-dynamic";

export default async function PenggunaPage() {
  const owner = await requireOwner();

  const [outlets, users] = await Promise.all([
    prisma.outlet.findMany({ where: { isActive: true }, orderBy: { code: "asc" } }),
    prisma.user.findMany({
      orderBy: [{ role: "asc" }, { name: "asc" }],
      include: { outlet: { select: { name: true } } },
    }),
  ]);

  return (
    <>
      <PageHeader title="Pengguna" description="Kelola akun owner & kasir. Akun tidak pernah dihapus, hanya dinonaktifkan." />

      <div className="grid gap-4 lg:grid-cols-3">
        <CreateKasirForm outlets={outlets.map((o) => ({ id: o.id, name: o.name }))} />

        <Card className="lg:col-span-2">
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Nama</Th>
                  <Th>Email</Th>
                  <Th>Peran</Th>
                  <Th>Login Terakhir</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Aksi</Th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <EmptyRow colSpan={6} />
                ) : (
                  users.map((u) => (
                    <tr key={u.id} className={u.isActive ? "" : "opacity-50"}>
                      <Td className="font-semibold">{u.name}</Td>
                      <Td className="text-ink-muted">{u.email}</Td>
                      <Td>
                        {u.role === "OWNER" ? (
                          <Badge tone="primary">OWNER</Badge>
                        ) : (
                          <Badge tone="info">KASIR · {u.outlet?.name ?? "belum di-set"}</Badge>
                        )}
                      </Td>
                      <Td className="whitespace-nowrap text-xs text-ink-muted">
                        {u.lastLoginAt ? formatDateTimeID(u.lastLoginAt) : "belum pernah"}
                      </Td>
                      <Td>{u.isActive ? <Badge tone="success">AKTIF</Badge> : <Badge tone="neutral">NONAKTIF</Badge>}</Td>
                      <Td>
                        <UserRowActions userId={u.id} isActive={u.isActive} isSelf={u.id === owner.id} />
                      </Td>
                    </tr>
                  ))
                )}
              </tbody>
            </Table>
          </TableWrap>
        </Card>
      </div>
    </>
  );
}
