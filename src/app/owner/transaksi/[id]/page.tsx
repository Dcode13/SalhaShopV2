import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/auth";
import { dec } from "@/lib/serialize";
import { formatDateTimeID, formatNumber, formatPercent, formatRp } from "@/lib/format";
import { PAYMENT_LABELS } from "@/lib/labels";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableWrap, Td, Th } from "@/components/ui/table";
import { buttonClass } from "@/components/ui/button";
import { VoidButton } from "./void-button";

export const dynamic = "force-dynamic";

export default async function OwnerTransaksiDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireOwner();
  const { id } = await params;

  const sale = await prisma.sale.findUnique({
    where: { id },
    include: {
      items: true,
      outlet: { select: { name: true } },
      user: { select: { name: true } },
    },
  });
  if (!sale) notFound();

  const voidedBy = sale.voidedById
    ? await prisma.user.findUnique({ where: { id: sale.voidedById }, select: { name: true } })
    : null;

  const total = dec(sale.total);
  const profit = dec(sale.grossProfit);
  const margin = total > 0 ? (profit / total) * 100 : 0;

  return (
    <>
      <PageHeader
        title={sale.invoiceNo}
        description={`${sale.outlet.name} · ${formatDateTimeID(sale.saleDate)} · kasir: ${sale.user.name}`}
        actions={
          <>
            <Link href="/owner/transaksi" className={buttonClass("ghost", "sm")}>
              <ArrowLeft className="size-4" /> Kembali
            </Link>
            {sale.status === "COMPLETED" ? <VoidButton saleId={sale.id} invoiceNo={sale.invoiceNo} /> : null}
          </>
        }
      />

      {sale.status === "VOID" ? (
        <div className="mb-4 rounded-xl border border-danger/40 bg-danger-soft px-4 py-3">
          <p className="text-sm font-bold text-red-800">
            Transaksi ini sudah DI-VOID{voidedBy ? ` oleh ${voidedBy.name}` : ""}
            {sale.voidedAt ? ` pada ${formatDateTimeID(sale.voidedAt)}` : ""}.
          </p>
          {sale.voidReason ? <p className="text-xs text-red-800/80">Alasan: {sale.voidReason}</p> : null}
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Item Terjual" description="Termasuk snapshot HPP saat transaksi (cost_at_sale)" />
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Produk</Th>
                  <Th className="text-right">Qty</Th>
                  <Th className="text-right">Harga</Th>
                  <Th className="text-right">Diskon</Th>
                  <Th className="text-right">Subtotal</Th>
                  <Th className="text-right">HPP saat jual</Th>
                  <Th className="text-right">Laba</Th>
                </tr>
              </thead>
              <tbody>
                {sale.items.map((item) => (
                  <tr key={item.id}>
                    <Td>
                      <p className="font-semibold">{item.productName}</p>
                      {item.priceType !== "RETAIL" ? <Badge tone="info">HARGA {item.priceType}</Badge> : null}
                    </Td>
                    <Td className="text-right tabular-nums">
                      {formatNumber(dec(item.qty))} {item.unitName}
                    </Td>
                    <Td className="text-right tabular-nums">{formatRp(dec(item.unitPrice))}</Td>
                    <Td className="text-right tabular-nums">{dec(item.discount) > 0 ? formatRp(dec(item.discount)) : "—"}</Td>
                    <Td className="text-right font-semibold tabular-nums">{formatRp(dec(item.subtotal))}</Td>
                    <Td className="text-right text-ink-muted tabular-nums">
                      {formatRp(dec(item.costAtSale))}/{"base"}
                    </Td>
                    <Td className="text-right font-semibold text-success tabular-nums">{formatRp(dec(item.grossProfit))}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        </Card>

        <Card className="self-start">
          <CardHeader title="Ringkasan" />
          <CardBody className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-ink-muted">Subtotal</span>
              <span className="tabular-nums">{formatRp(dec(sale.subtotal))}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-muted">Diskon transaksi</span>
              <span className="tabular-nums">− {formatRp(dec(sale.discount))}</span>
            </div>
            <div className="flex justify-between border-t border-line pt-2 text-base font-extrabold">
              <span>TOTAL</span>
              <span className="tabular-nums">{formatRp(total)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-muted">Dibayar ({PAYMENT_LABELS[sale.paymentMethod]})</span>
              <span className="tabular-nums">{formatRp(dec(sale.paidAmount))}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-muted">Kembalian</span>
              <span className="tabular-nums">{formatRp(dec(sale.changeAmount))}</span>
            </div>
            <div className="mt-2 rounded-lg bg-primary-softer p-3">
              <div className="flex justify-between">
                <span className="text-ink-muted">Total HPP</span>
                <span className="tabular-nums">{formatRp(dec(sale.totalCost))}</span>
              </div>
              <div className="flex justify-between font-extrabold text-primary-strong">
                <span>Laba Kotor</span>
                <span className="tabular-nums">
                  {formatRp(profit)} ({formatPercent(margin)})
                </span>
              </div>
            </div>
            {sale.note ? <p className="pt-1 text-xs text-ink-faint">Catatan: {sale.note}</p> : null}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
