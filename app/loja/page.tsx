import type { Metadata } from "next";
import { ShopPage } from "@/components/ShopPage";
import { listCategories, listProducts } from "@/lib/store";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Loja", description: "Explore kimonos, rash guards, faixas e shorts ONVEX." };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function one(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }

export default async function ShopRoute({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const values = {
    q: one(params.q), categoria: one(params.categoria), min: one(params.min), max: one(params.max),
    tamanho: one(params.tamanho), cor: one(params.cor), disponibilidade: one(params.disponibilidade), ordenar: one(params.ordenar),
  };
  const page = Math.max(Number(one(params.pagina) ?? 1) || 1, 1);
  const [productRows, categoryRows] = await Promise.all([
    listProducts({
      query: values.q,
      category: values.categoria,
      color: values.cor,
      size: values.tamanho,
      availability: values.disponibilidade === "out-of-stock" ? "out-of-stock" : values.disponibilidade === "in-stock" ? "in-stock" : undefined,
      minPriceCents: values.min ? Math.round(Number(values.min.replace(/\D/g, "")) * 100) : undefined,
      maxPriceCents: values.max ? Math.round(Number(values.max.replace(/\D/g, "")) * 100) : undefined,
      sort: values.ordenar as "best-selling" | "newest" | "price-asc" | "price-desc" | undefined,
      limit: 24,
      offset: (page - 1) * 24,
    }),
    listCategories(),
  ]);
  return <ShopPage products={productRows} categories={categoryRows} values={values} page={page} />;
}
