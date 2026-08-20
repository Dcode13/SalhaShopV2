import Link from "next/link";
import { AlertTriangle, CheckCircle2, ClipboardCheck } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/auth";
import { dec } from "@/lib/serialize";
import { formatDateTimeID, formatNumber, formatRp } from "@/lib/format";
import { resolveProductRequest } from "@/server/actions/products";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyRow, Table, TableWrap, Td, Th } from "@/components/ui/table";
import { buttonClass } from "@/components/ui/button";

export const dynamic = "force-dynamic";

/**
 * Halaman "Kelengkapan Data" (PRD §8.6): checklist sebelum go-live.
 * Dua baris bertanda ⚠ HARUS nol — sistem laba tidak bisa dipercaya selama belum nol.
 */
export default async function KelengkapanPage() {
  await requireOwner();

  const [categoryCount, productCount, outlets, inventories, requests] = await Promise.all([
    prisma.category.count({ where: { isActive: true } }),
    prisma.product.count({ where: { isActive: true } }),
    prisma.outlet.findMany({ where: { isActive: true }, orderBy: { code: "asc" } }),
    prisma.inventory.findMany({
      where: { product: { isActive: true } },
      include: {
        product: { select: { id: true, name: true, sku: true, prices: { where: { isActive: true }, select: { outletId: true } } } },
        outlet: { select: { code: true, name: true } },
      },
    }),
    prisma.productRequest.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "desc" },
      include: { outlet: { select: { name: true } }, requestedBy: { select: { name: true } } },
    }),
  ]);

  const perOutletCount = outlets.map((o) => ({
    outlet: o,
    count: new Set(inventories.filter((i) => i.outletId === o.id).map((i) => i.productId)).size,
  }));

  // ⚠ 1: punya stok tapi HPP kosong
  const noHpp = inventories.filter((i) => dec(i.qty) > 0 && dec(i.avgCost) <= 0);
  // ⚠ 2: punya stok/inventory tapi tidak punya harga jual di outlet tsb
  const noPrice = inventories.filter((i) => !i.product.prices.some((p) => p.outletId === i.outletId));
  // info: belum set stok minimum
  const noMin = inventories.filter((i) => dec(i.minStock) <= 0).length;

  const ready = noHpp.length === 0 && noPrice.length === 0 && productCount > 0;

  return (
    <>
      <PageHeader
        title="Kelengkapan Data"
        description="Checklist sebelum go-live — dua baris ⚠ wajib nol"
        actions={
          <Link href="/owner/produk/baru" className={buttonClass("primary", "md")}>
            + Input Produk
          </Link>
        }
      />

      <div
        className={`mb-5 flex items-center gap-3 rounded-xl border p-4 ${
          ready ? "border-success/40 bg-success-soft" : "border-warn/40 bg-warn-soft"
        }`}
      >
        {ready ? <CheckCircle2 className="size-8 text-success" /> : <AlertTriangle className="size-8 text-warn" />}
        <div>
          <p className={`text-sm font-extrabold ${ready ? "text-green-900" : "text-amber-900"}`}>
            {ready ? "Data siap go-live 🎉" : "Belum siap go-live"}
          </p>
          <p className={`text-xs ${ready ? "text-green-800" : "text-amber-800"}`}>
            {ready
              ? "Lakukan stok opname fisik tepat sebelum mulai dipakai, agar angka sistem = kenyataan."
              : "Selesaikan dua daftar ⚠ di bawah ini dulu. Tanpa itu, laporan laba akan ngawur."}
          </p>
        </div>
      </div>

      <Card className="mb-4">
        <CardHeader
          title={
            <span className="inline-flex items-center gap-2">
              <ClipboardCheck className="size-4 text-primary" /> Progres Input
            </span>
          }
        />
        <CardBody>
          <div className="grid gap-2 text-sm">
            <div className="flex justify-between border-b border-line pb-2">
              <span className="text-ink-muted">Kategori dibuat</span>
              <span className="font-bold tabular-nums">{categoryCount}</span>
            </div>
            <div className="flex justify-between border-b border-line pb-2">
              <span className="text-ink-muted">Produk terinput</span>
              <span className="font-bold tabular-nums">
                {productCount}{" "}
                <span className="text-xs font-semibold text-ink-faint">
                  ({perOutletCount.map((p) => `${p.outlet.code} ${p.count}`).join(" · ")})
                </span>
              </span>
            </div>
            <div className="flex justify-between border-b border-line pb-2">
              <span className={noHpp.length > 0 ? "font-bold text-danger" : "text-ink-muted"}>
                ⚠ Punya stok tapi HPP kosong
              </span>
              <Badge tone={noHpp.length > 0 ? "danger" : "success"}>{noHpp.length}</Badge>
            </div>
            <div className="flex justify-between border-b border-line pb-2">
              <span className={noPrice.length > 0 ? "font-bold text-danger" : "text-ink-muted"}>
                ⚠ Belum punya harga jual
              </span>
              <Badge tone={noPrice.length > 0 ? "danger" : "success"}>{noPrice.length}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-muted">Belum di-set stok minimum (tidak wajib)</span>
              <Badge tone="neutral">{noMin}</Badge>
            </div>
          </div>
        </CardBody>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader title="⚠ Stok ada, HPP kosong" description="Perbaiki lewat Pembelian (Terima Barang) atau input ulang stok awal" />
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Produk</Th>
                  <Th>Outlet</Th>
                  <Th className="text-right">Stok</Th>
                </tr>
              </thead>
              <tbody>
                {noHpp.length === 0 ? (
                  <EmptyRow colSpan={3}>Beres — semua stok punya HPP ✅</EmptyRow>
                ) : (
                  noHpp.map((i) => (
                    <tr key={i.id}>
                      <Td>
                        <Link href={`/owner/produk/${i.product.id}`} className="font-semibold text-primary hover:underline">
                          {i.product.name}
                        </Link>
                        <p className="text-[11px] text-ink-faint">{i.product.sku}</p>
                      </Td>
                      <Td className="text-ink-muted">{i.outlet.code}</Td>
                      <Td className="text-right tabular-nums">{formatNumber(dec(i.qty))}</Td>
                    </tr>
                  ))
                )}
              </tbody>
            </Table>
          </TableWrap>
        </Card>

        <Card>
          <CardHeader title="⚠ Belum punya harga jual" description="Buka produk → isi harga eceran outlet terkait" />
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Produk</Th>
                  <Th>Outlet</Th>
                </tr>
              </thead>
              <tbody>
                {noPrice.length === 0 ? (
                  <EmptyRow colSpan={2}>Beres — semua produk punya harga ✅</EmptyRow>
                ) : (
                  noPrice.map((i) => (
                    <tr key={i.id}>
                      <Td>
                        <Link href={`/owner/produk/${i.product.id}`} className="font-semibold text-primary hover:underline">
                          {i.product.name}
                        </Link>
                        <p className="text-[11px] text-ink-faint">{i.product.sku}</p>
                      </Td>
                      <Td className="text-ink-muted">{i.outlet.code}</Td>
                    </tr>
                  ))
                )}
              </tbody>
            </Table>
          </TableWrap>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader
          title="Permintaan Produk dari Kasir"
          description="Barang yang kasir temui tapi belum ada di sistem — lengkapi lalu tandai selesai"
        />
        <TableWrap>
          <Table>
            <thead>
              <tr>
                <Th>Diminta</Th>
                <Th>Nama Barang</Th>
                <Th>Outlet</Th>
                <Th className="text-right">Harga Jual Dipakai</Th>
                <Th>Catatan</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {requests.length === 0 ? (
                <EmptyRow colSpan={6}>Tidak ada antrean permintaan produk.</EmptyRow>
              ) : (
                requests.map((r) => (
                  <tr key={r.id}>
                    <Td className="whitespace-nowrap text-xs text-ink-muted">
                      {formatDateTimeID(r.createdAt)}
                      <p className="text-[11px] text-ink-faint">oleh {r.requestedBy.name}</p>
                    </Td>
                    <Td className="font-semibold">{r.name}</Td>
                    <Td className="text-ink-muted">{r.outlet.name}</Td>
                    <Td className="text-right tabular-nums">{r.suggestedPrice ? formatRp(dec(r.suggestedPrice)) : "—"}</Td>
                    <Td className="text-xs text-ink-muted">{r.note ?? "—"}</Td>
                    <Td>
                      <div className="flex items-center gap-2">
                        <Link href="/owner/produk/baru" className="text-xs font-bold text-primary hover:underline">
                          Buat Produk
                        </Link>
                        <form
                          action={async () => {
                            "use server";
                            await resolveProductRequest(r.id, "APPROVED");
                          }}
                        >
                          <button type="submit" className="text-xs font-bold text-success hover:underline">
                            Selesai
                          </button>
                        </form>
                        <form
                          action={async () => {
                            "use server";
                            await resolveProductRequest(r.id, "REJECTED");
                          }}
                        >
                          <button type="submit" className="text-xs font-bold text-ink-faint hover:text-danger">
                            Tolak
                          </button>
                        </form>
                      </div>
                    </Td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
        </TableWrap>
      </Card>
    </>
  );
}
