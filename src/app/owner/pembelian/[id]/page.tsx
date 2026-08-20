import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, PackageCheck, XCircle } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/auth";
import { dec } from "@/lib/serialize";
import { formatDateID, formatNumber, formatRp } from "@/lib/format";
import { PAYMENT_LABELS, PAYMENT_STATUS, PURCHASE_STATUS } from "@/lib/labels";
import { cancelPurchase, receivePurchase, updatePurchasePayment } from "@/server/actions/purchases";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableWrap, Td, Th } from "@/components/ui/table";
import { buttonClass } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function PembelianDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireOwner();
  const { id } = await params;

  const purchase = await prisma.purchase.findUnique({
    where: { id },
    include: {
      outlet: { select: { name: true } },
      supplier: { select: { name: true } },
      user: { select: { name: true } },
      items: { include: { product: { select: { name: true, baseUnit: true } } } },
    },
  });
  if (!purchase) notFound();

  const st = PURCHASE_STATUS[purchase.status];
  const ps = PAYMENT_STATUS[purchase.paymentStatus];
  const sisa = dec(purchase.total) - dec(purchase.paidAmount);

  return (
    <>
      <PageHeader
        title={purchase.invoiceNo}
        description={`${purchase.outlet.name} · ${formatDateID(purchase.purchaseDate)} · diinput oleh ${purchase.user.name}`}
        actions={
          <Link href="/owner/pembelian" className={buttonClass("ghost", "sm")}>
            <ArrowLeft className="size-4" /> Daftar Pembelian
          </Link>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge tone={st.tone}>{st.label}</Badge>
        <Badge tone={ps.tone}>{ps.label}</Badge>
        <span className="text-xs text-ink-muted">
          Metode: {PAYMENT_LABELS[purchase.paymentMethod]}
          {purchase.supplier ? ` · Supplier: ${purchase.supplier.name}` : ""}
          {purchase.supplierInvoice ? ` · Nota supplier: ${purchase.supplierInvoice}` : ""}
        </span>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Item" />
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Produk</Th>
                  <Th className="text-right">Qty</Th>
                  <Th className="text-right">Konversi</Th>
                  <Th className="text-right">Harga Beli</Th>
                  <Th className="text-right">HPP/base</Th>
                  <Th className="text-right">Subtotal</Th>
                </tr>
              </thead>
              <tbody>
                {purchase.items.map((item) => (
                  <tr key={item.id}>
                    <Td className="font-semibold">{item.product.name}</Td>
                    <Td className="text-right tabular-nums">
                      {formatNumber(dec(item.qty))} {item.unitName}
                    </Td>
                    <Td className="text-right text-ink-muted tabular-nums">
                      {formatNumber(dec(item.qtyBase))} {item.product.baseUnit}
                    </Td>
                    <Td className="text-right tabular-nums">{formatRp(dec(item.unitCost))}</Td>
                    <Td className="text-right tabular-nums">{formatRp(dec(item.costBase))}</Td>
                    <Td className="text-right font-semibold tabular-nums">{formatRp(dec(item.subtotal))}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        </Card>

        <div className="space-y-4 self-start">
          <Card>
            <CardHeader title="Ringkasan" />
            <CardBody className="space-y-1.5 text-sm">
              {(
                [
                  ["Subtotal", dec(purchase.subtotal)],
                  ["Diskon", -dec(purchase.discount)],
                  ["Ongkir", dec(purchase.shippingCost)],
                  ["Biaya lain", dec(purchase.otherCost)],
                ] as const
              ).map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <span className="text-ink-muted">{k}</span>
                  <span className="tabular-nums">{formatRp(v)}</span>
                </div>
              ))}
              <div className="flex justify-between border-t border-line pt-2 text-base font-extrabold">
                <span>TOTAL</span>
                <span className="tabular-nums">{formatRp(dec(purchase.total))}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-muted">Sudah dibayar</span>
                <span className="tabular-nums">{formatRp(dec(purchase.paidAmount))}</span>
              </div>
              {sisa > 0 ? (
                <div className="flex justify-between font-bold text-danger">
                  <span>Sisa hutang</span>
                  <span className="tabular-nums">{formatRp(sisa)}</span>
                </div>
              ) : null}
            </CardBody>
          </Card>

          {purchase.status === "DRAFT" ? (
            <Card>
              <CardBody className="space-y-2">
                <form
                  action={async () => {
                    "use server";
                    await receivePurchase(purchase.id);
                    redirect(`/owner/pembelian/${purchase.id}`);
                  }}
                >
                  <button type="submit" className={buttonClass("success", "lg", "w-full")}>
                    <PackageCheck className="size-4" /> Terima Barang (stok masuk)
                  </button>
                </form>
                <form
                  action={async () => {
                    "use server";
                    await cancelPurchase(purchase.id);
                    redirect("/owner/pembelian");
                  }}
                >
                  <button type="submit" className={buttonClass("outline", "md", "w-full text-danger")}>
                    <XCircle className="size-4" /> Batalkan Nota
                  </button>
                </form>
                <p className="text-[11px] text-ink-faint">
                  “Terima Barang” menambah stok & menghitung ulang HPP rata-rata — tidak bisa dibatalkan dari sini.
                </p>
              </CardBody>
            </Card>
          ) : null}

          {purchase.status !== "CANCELLED" && sisa > 0 ? (
            <Card>
              <CardHeader title="Update Pembayaran" />
              <CardBody>
                <form
                  action={async (fd: FormData) => {
                    "use server";
                    await updatePurchasePayment(purchase.id, Number(fd.get("paid") ?? 0));
                    redirect(`/owner/pembelian/${purchase.id}`);
                  }}
                  className="flex gap-2"
                >
                  <input
                    type="number"
                    name="paid"
                    min={0}
                    defaultValue={dec(purchase.paidAmount)}
                    className="h-10 flex-1 rounded-lg border border-line bg-surface px-3 text-right text-sm text-ink"
                  />
                  <button type="submit" className={buttonClass("primary", "md")}>
                    Simpan
                  </button>
                </form>
                <p className="mt-1.5 text-[11px] text-ink-faint">Isi total yang SUDAH dibayar (bukan tambahan).</p>
              </CardBody>
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}
