import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ShopPage } from "@/components/ShopPage";
import { getCategoryBySlug, listCategories, listProducts } from "@/lib/store";

export const dynamic = "force-dynamic";
type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategoryBySlug(slug);
  if (!category) return { title: "Categoria não encontrada" };
  return { title: category.name, description: category.description };
}

export default async function CategoryRoute({ params }: { params: Params }) {
  const { slug } = await params;
  const category = await getCategoryBySlug(slug);
  if (!category) notFound();
  const [productRows, categoryRows] = await Promise.all([listProducts({ category: slug, limit: 24 }), listCategories()]);
  return <ShopPage products={productRows} categories={categoryRows} values={{ categoria: slug }} title={`${category.name.toUpperCase()}.`} description={category.description} />;
}

