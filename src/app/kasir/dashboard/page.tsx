import Link from "next/link";
import { Clock, PackageX, PlusCircle, ReceiptText, Wallet } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireKasir } from "@/lib/auth";
import { dec } from "@/lib/serialize";
import { rangeForPreset } from "@/lib/dates";
import { formatDateLongID, formatNumber, formatRp, formatTimeID } from "@/lib/format";
import { getLowStock, getRecentSales } from "@/server/reports";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyRow, Table, TableWrap, Td, Th } from "@/components/ui/table";
import { buttonClass } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function KasirDashboard() {
  const user = await requireKasir();
  const today = rangeForPreset("hari-ini");

  const [session, todayAgg, recentSales, lowStock] = await Promise.all([
    prisma.cashSession.findFirst({
      where: { userId: user.id, outletId: user.outletId, status: "OPEN" },
    }),
    prisma.sale.aggregate({
      where: {
        userId: user.id,
        outletId: user.outletId,
        status: "COMPLETED",
        saleDate: { gte: today.from, lt: today.to },
      },
      _sum: { total: true },
      _count: { _all: true },
    }),
    getRecentSales(10, user.outletId, user.id),
    getLowStock(user.outletId, 8),
  ]);

  const omzetHariIni = dec(todayAgg._sum.total);
  const txHariIni = todayAgg._count._all;
  const shiftHours = session
    ? Math.floor((Date.now() - session.openedAt.getTime()) / 3_600_000)
    : 0;
  const shiftMinutes = session
    ? Math.floor(((Date.now() - session.openedAt.getTime()) % 3_600_000) / 60_000)
    : 0;

  return (
    <>
      <PageHeader
        title={`Halo, ${user.name.split(" ")[0]} 👋`}
        description={`${user.outletName} · ${formatDateLongID(new Date())}`}
      />

      {/* Status shift + aksi utama */}
      <div className="grid gap-3 md:grid-cols-3">
        <Card className={session ? "border-success/40" : "border-warn/40"}>
          <CardBody className="flex items-center gap-4">
            <span
              className={`flex size-11 items-center justify-center rounded-xl ${session ? "bg-success-soft text-success" : "bg-warn-soft text-warn"}`}
            >
              <Clock className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-ink-muted">Status Shift</p>
              {session ? (
                <>
                  <p className="text-sm font-extrabold text-ink">
                    BUKA · sejak {formatTimeID(session.openedAt)} ({shiftHours}j {shiftMinutes}m)
                  </p>
                  <p className="text-xs text-ink-muted">Kas awal {formatRp(dec(session.openingCash))}</p>
                </>
              ) : (
                <p className="text-sm font-extrabold text-warn">BELUM BUKA — buka shift dulu</p>
              )}
            </div>
            <Link href="/kasir/shift" className={buttonClass(session ? "outline" : "primary", "sm")}>
              {session ? "Tutup" : "Buka Shift"}
            </Link>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <p className="text-xs font-semibold text-ink-muted">Omzet Saya Hari Ini</p>
            <p className="mt-1 text-2xl font-extrabold tracking-tight text-ink tabular-nums">
              {formatRp(omzetHariIni)}
            </p>
            <p className="mt-1 text-xs text-ink-muted">{formatNumber(txHariIni)} transaksi</p>
          </CardBody>
        </Card>

        <Card className="bg-gradient-to-br from-primary to-primary-strong">
          <CardBody className="flex h-full items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-white/80">Siap melayani?</p>
              <p className="text-lg font-extrabold text-white">Mulai transaksi</p>
            </div>
            <Link
              href="/kasir/pos"
              className="inline-flex h-14 items-center gap-2 rounded-xl bg-white px-6 text-base font-extrabold text-primary-strong shadow-pop hover:bg-primary-soft"
            >
              <PlusCircle className="size-5" /> Transaksi Baru
            </Link>
          </CardBody>
        </Card>
      </div>

      {/* Tombol cepat */}
      <div className="mt-3 flex flex-wrap gap-2">
        <Link href="/kasir/pengeluaran" className={buttonClass("outline", "lg")}>
          <Wallet className="size-4" /> Catat Pengeluaran
        </Link>
        <Link href="/kasir/transaksi" className={buttonClass("outline", "lg")}>
          <ReceiptText className="size-4" /> Riwayat Transaksi
        </Link>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="10 Transaksi Terakhir Saya" description="Klik untuk lihat detail / cetak ulang struk" />
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Invoice</Th>
                  <Th>Jam</Th>
                  <Th className="text-right">Total</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {recentSales.length === 0 ? (
                  <EmptyRow colSpan={4}>Belum ada transaksi hari ini.</EmptyRow>
                ) : (
                  recentSales.map((s) => (
                    <tr key={s.id}>
                      <Td>
                        <Link href={`/kasir/transaksi/${s.id}`} className="font-semibold text-primary hover:underline">
                          {s.invoiceNo}
                        </Link>
                      </Td>
                      <Td className="text-ink-muted">{formatTimeID(s.saleDate)}</Td>
                      <Td className="text-right font-semibold tabular-nums">{formatRp(dec(s.total))}</Td>
                      <Td>
                        {s.status === "VOID" ? <Badge tone="danger">VOID</Badge> : <Badge tone="success">OK</Badge>}
                      </Td>
                    </tr>
                  ))
                )}
              </tbody>
            </Table>
          </TableWrap>
        </Card>

        <Card>
          <CardHeader
            title={
              <span className="inline-flex items-center gap-1.5">
                <PackageX className="size-4 text-danger" /> Stok Menipis di Outlet Ini
              </span>
            }
            description="Laporkan ke owner untuk kulakan"
          />
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Produk</Th>
                  <Th className="text-right">Sisa</Th>
                  <Th className="text-right">Minimum</Th>
                </tr>
              </thead>
              <tbody>
                {lowStock.length === 0 ? (
                  <EmptyRow colSpan={3}>Semua stok aman 👍</EmptyRow>
                ) : (
                  lowStock.map((r) => (
                    <tr key={r.productId}>
                      <Td className="font-semibold">{r.name}</Td>
                      <Td className="text-right">
                        <Badge tone={r.qty <= 0 ? "danger" : "warn"}>
                          {formatNumber(r.qty)} {r.baseUnit}
                        </Badge>
                      </Td>
                      <Td className="text-right text-ink-muted tabular-nums">{formatNumber(r.minStock)}</Td>
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
