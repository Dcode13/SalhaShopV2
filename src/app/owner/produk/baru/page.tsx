import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/auth";
import { storageConfigured } from "@/lib/storage";
import { PageHeader } from "@/components/ui/page-header";
import { ProductForm } from "../product-form";
import { buildProductInitial } from "../form-data";

export const dynamic = "force-dynamic";

export default async function ProdukBaruPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireOwner();
  const sp = await searchParams;
  const dari = typeof sp.dari === "string" ? sp.dari : null;

  const [categories, outlets] = await Promise.all([
    prisma.category.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
    prisma.outlet.findMany({ where: { isActive: true }, orderBy: { code: "asc" } }),
  ]);

  const initial = dari ? await buildProductInitial(dari, true) : undefined;

  return (
    <>
      <PageHeader
        title={initial ? `Duplikat: ${initial.name.trim()}` : "Produk Baru"}
        description="Mode input cepat — setelah simpan, form tetap terbuka untuk produk berikutnya"
      />
      <ProductForm
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        outlets={outlets.map((o) => ({ id: o.id, name: o.name }))}
        initial={initial ?? undefined}
        storageReady={storageConfigured()}
      />
    </>
  );
}
