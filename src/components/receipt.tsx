import Image from "next/image";
import { formatDateTimeID, formatNumber, formatRp } from "@/lib/format";

export type ReceiptData = {
  invoiceNo: string;
  outletName: string;
  outletAddress: string | null;
  kasirName: string;
  saleDate: Date;
  items: {
    name: string;
    qty: number;
    unitName: string;
    unitPrice: number;
    discount: number;
    subtotal: number;
  }[];
  subtotal: number;
  discount: number;
  total: number;
  paidAmount: number;
  changeAmount: number;
  paymentMethod: string;
  footer: string;
  isVoid?: boolean;
};

/** Struk 58mm — dipakai layar detail transaksi kasir & mode cetak. */
export function Receipt({ data }: { data: ReceiptData }) {
  return (
    <div className="print-area relative mx-auto w-full max-w-[300px] rounded-xl border border-line bg-white p-4 font-mono text-[11px] leading-relaxed text-black shadow-card">
      {data.isVoid ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="rotate-[-20deg] rounded border-4 border-red-500 px-4 py-1 text-2xl font-extrabold text-red-500 opacity-60">
            VOID
          </span>
        </div>
      ) : null}

      <div className="mb-2 flex flex-col items-center text-center">
        <Image src="/salhashoplogo.png" alt="Salha Shop" width={40} height={40} className="size-10 object-contain" />
        <p className="mt-1 text-sm font-extrabold tracking-wide">SALHA SHOP</p>
        <p>{data.outletName}</p>
        {data.outletAddress ? <p>{data.outletAddress}</p> : null}
      </div>

      <div className="border-y border-dashed border-black/40 py-1">
        <p>No : {data.invoiceNo}</p>
        <p>Tgl : {formatDateTimeID(data.saleDate)}</p>
        <p>Ksr : {data.kasirName}</p>
      </div>

      <div className="py-1">
        {data.items.map((item, i) => (
          <div key={i} className="mb-1">
            <p className="font-bold">{item.name}</p>
            <div className="flex justify-between">
              <span>
                {formatNumber(item.qty)} {item.unitName} × {formatRp(item.unitPrice)}
                {item.discount > 0 ? ` (disk ${formatRp(item.discount)})` : ""}
              </span>
              <span className="tabular-nums">{formatRp(item.subtotal)}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-dashed border-black/40 pt-1">
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span className="tabular-nums">{formatRp(data.subtotal)}</span>
        </div>
        {data.discount > 0 ? (
          <div className="flex justify-between">
            <span>Diskon</span>
            <span className="tabular-nums">− {formatRp(data.discount)}</span>
          </div>
        ) : null}
        <div className="flex justify-between text-sm font-extrabold">
          <span>TOTAL</span>
          <span className="tabular-nums">{formatRp(data.total)}</span>
        </div>
        <div className="flex justify-between">
          <span>{data.paymentMethod === "CASH" ? "Tunai" : data.paymentMethod}</span>
          <span className="tabular-nums">{formatRp(data.paidAmount)}</span>
        </div>
        {data.changeAmount > 0 ? (
          <div className="flex justify-between">
            <span>Kembali</span>
            <span className="tabular-nums">{formatRp(data.changeAmount)}</span>
          </div>
        ) : null}
      </div>

      <p className="mt-2 border-t border-dashed border-black/40 pt-2 text-center">{data.footer}</p>
    </div>
  );
}
