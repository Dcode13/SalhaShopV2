import Link from "next/link";
import { PackagePlus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/auth";
import { dec } from "@/lib/serialize";
import { formatDateID, formatRp } from "@/lib/format";
import { PAYMENT_STATUS, PURCHASE_STATUS } from "@/lib/labels";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyRow, Table, TableWrap, Td, Th } from "@/components/ui/table";
import { buttonClass } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function PembelianListPage() {
  await requireOwner();

  const purchases = await prisma.purchase.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      outlet: { select: { name: true, code: true } },
      supplier: { select: { name: true } },
      _count: { select: { items: true } },
    },
  });

  return (
    <>
      <PageHeader
        title="Pembelian / Restock"
        description="Simpan nota sebagai DRAFT → klik Terima Barang → stok bertambah & HPP dihitung ulang"
        actions={
          <Link href="/owner/pembelian/baru" className={buttonClass("primary", "md")}>
            <PackagePlus className="size-4" /> Nota Pembelian Baru
          </Link>
        }
      />

      <Card>
        <TableWrap>
          <Table>
            <thead>
              <tr>
                <Th>No. PO</Th>
                <Th>Tanggal</Th>
                <Th>Outlet</Th>
                <Th>Supplier</Th>
                <Th className="text-right">Item</Th>
                <Th className="text-right">Total</Th>
                <Th>Pembayaran</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {purchases.length === 0 ? (
                <EmptyRow colSpan={8}>Belum ada pembelian.</EmptyRow>
              ) : (
                purchases.map((p) => {
                  const st = PURCHASE_STATUS[p.status];
                  const ps = PAYMENT_STATUS[p.paymentStatus];
                  return (
                    <tr key={p.id}>
                      <Td>
                        <Link href={`/owner/pembelian/${p.id}`} className="font-semibold text-primary hover:underline">
                          {p.invoiceNo}
                        </Link>
                      </Td>
                      <Td className="text-ink-muted">{formatDateID(p.purchaseDate)}</Td>
                      <Td className="text-ink-muted">{p.outlet.code}</Td>
                      <Td>{p.supplier?.name ?? "—"}</Td>
                      <Td className="text-right tabular-nums">{p._count.items}</Td>
                      <Td className="text-right font-semibold tabular-nums">{formatRp(dec(p.total))}</Td>
                      <Td>
                        <Badge tone={ps.tone}>{ps.label}</Badge>
                      </Td>
                      <Td>
                        <Badge tone={st.tone}>{st.label}</Badge>
                      </Td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </Table>
        </TableWrap>
      </Card>
    </>
  );
}
