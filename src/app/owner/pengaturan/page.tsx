import { redirect } from "next/navigation";
import { Settings } from "lucide-react";
import { requireOwner } from "@/lib/auth";
import { getSettings, SETTING_KEYS } from "@/lib/settings";
import { saveSettings } from "@/server/actions/master";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/field";

export const dynamic = "force-dynamic";

export default async function PengaturanPage() {
  await requireOwner();
  const settings = await getSettings();

  return (
    <>
      <PageHeader title="Pengaturan" description="Konfigurasi umum aplikasi" />

      <Card className="max-w-xl">
        <CardHeader
          title={
            <span className="inline-flex items-center gap-2">
              <Settings className="size-4 text-primary" /> Umum
            </span>
          }
        />
        <CardBody>
          <form
            action={async (fd: FormData) => {
              "use server";
              await saveSettings([
                { key: SETTING_KEYS.storeName, value: String(fd.get("store_name") ?? "") },
                { key: SETTING_KEYS.maxDiscountKasir, value: String(Number(fd.get("max_discount_kasir") ?? 0)) },
                { key: SETTING_KEYS.receiptFooter, value: String(fd.get("receipt_footer") ?? "") },
                { key: SETTING_KEYS.lowStockDefault, value: String(Number(fd.get("low_stock_default") ?? 0)) },
              ]);
              redirect("/owner/pengaturan");
            }}
            className="space-y-4"
          >
            <div>
              <Label htmlFor="store_name">Nama toko</Label>
              <Input id="store_name" name="store_name" defaultValue={settings[SETTING_KEYS.storeName]} />
            </div>
            <div>
              <Label htmlFor="max_discount_kasir">Batas diskon kasir per transaksi (Rp)</Label>
              <Input
                id="max_discount_kasir"
                name="max_discount_kasir"
                type="number"
                min={0}
                defaultValue={settings[SETTING_KEYS.maxDiscountKasir]}
                className="text-right"
              />
              <p className="mt-1 text-xs text-ink-faint">Isi 0 untuk melarang kasir memberi diskon sama sekali.</p>
            </div>
            <div>
              <Label htmlFor="receipt_footer">Teks bawah struk</Label>
              <Input id="receipt_footer" name="receipt_footer" defaultValue={settings[SETTING_KEYS.receiptFooter]} />
            </div>
            <div>
              <Label htmlFor="low_stock_default">Default stok minimum produk baru</Label>
              <Input
                id="low_stock_default"
                name="low_stock_default"
                type="number"
                min={0}
                defaultValue={settings[SETTING_KEYS.lowStockDefault]}
                className="text-right"
              />
            </div>
            <button type="submit" className="h-11 w-full rounded-lg bg-primary text-sm font-bold text-primary-fg hover:bg-primary-strong">
              Simpan Pengaturan
            </button>
          </form>
        </CardBody>
      </Card>
    </>
  );
}
