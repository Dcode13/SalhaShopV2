import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Printer } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireKasir } from "@/lib/auth";
import { dec } from "@/lib/serialize";
import { getSetting, SETTING_KEYS } from "@/lib/settings";
import { Receipt } from "@/components/receipt";
import { PrintOnLoad } from "@/components/print-on-load";
import { buttonClass } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function KasirStrukPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireKasir();
  const { id } = await params;
  const sp = await searchParams;

  const sale = await prisma.sale.findUnique({
    where: { id },
    include: {
      items: true,
      outlet: { select: { name: true, address: true } },
      user: { select: { name: true } },
    },
  });
  // kasir hanya boleh melihat transaksi miliknya sendiri
  if (!sale || sale.userId !== user.id) notFound();

  const footer = await getSetting(SETTING_KEYS.receiptFooter);

  return (
    <div className="mx-auto max-w-sm">
      {sp.print === "1" ? <PrintOnLoad /> : null}

      <div className="mb-4 flex items-center justify-between no-print">
        <Link href="/kasir/transaksi" className={buttonClass("ghost", "sm")}>
          <ArrowLeft className="size-4" /> Kembali
        </Link>
        <Link href={`/kasir/transaksi/${sale.id}?print=1`} className={buttonClass("primary", "sm")}>
          <Printer className="size-4" /> Cetak Struk
        </Link>
      </div>

      <Receipt
        data={{
          invoiceNo: sale.invoiceNo,
          outletName: sale.outlet.name,
          outletAddress: sale.outlet.address,
          kasirName: sale.user.name,
          saleDate: sale.saleDate,
          items: sale.items.map((i) => ({
            name: i.productName,
            qty: dec(i.qty),
            unitName: i.unitName,
            unitPrice: dec(i.unitPrice),
            discount: dec(i.discount),
            subtotal: dec(i.subtotal),
          })),
          subtotal: dec(sale.subtotal),
          discount: dec(sale.discount),
          total: dec(sale.total),
          paidAmount: dec(sale.paidAmount),
          changeAmount: dec(sale.changeAmount),
          paymentMethod: sale.paymentMethod,
          footer,
          isVoid: sale.status === "VOID",
        }}
      />
    </div>
  );
}
