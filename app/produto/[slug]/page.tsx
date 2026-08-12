import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductDetailClient } from "@/components/ProductDetailClient";
import { getProductBySlug, getStoreSettings } from "@/lib/store";
import { formatCurrency } from "@/lib/format";

export const dynamic = "force-dynamic";
type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: "Produto não encontrado" };
  return {
    title: product.metaTitle ?? product.name,
    description: product.metaDescription ?? product.shortDescription,
    alternates: { canonical: `/produto/${product.slug}` },
    openGraph: { images: product.imageUrl ? [product.imageUrl] : [] },
  };
}

export default async function ProductRoute({ params }: { params: Params }) {
  const { slug } = await params;
  const [product, settings] = await Promise.all([getProductBySlug(slug), getStoreSettings()]);
  if (!product) notFound();
  let sizeGuide: Array<{ size: string; height: string; weight: string }> = [];
  try { sizeGuide = JSON.parse(settings.size_guide ?? "[]") as typeof sizeGuide; } catch { sizeGuide = []; }
  const structuredData = {
    "@context": "https://schema.org", "@type": "Product", name: product.name, image: product.images.map((image) => image.url),
    description: product.shortDescription, sku: product.baseSku, brand: { "@type": "Brand", name: product.brand },
    offers: { "@type": "Offer", priceCurrency: "BRL", price: ((product.salePriceCents ?? product.priceCents) / 100).toFixed(2), availability: product.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock" },
  };
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} /><ProductDetailClient product={product} sizeGuide={sizeGuide} /><span className="sr-only">Preço {formatCurrency(product.salePriceCents ?? product.priceCents)}</span></>;
}

