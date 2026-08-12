import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { requireChatGPTUser } from "@/app/chatgpt-auth";
import { ProductGrid } from "@/components/ProductGrid";
import { getDb } from "@/db";
import { favorites } from "@/db/schema";
import { getCurrentAppUser } from "@/lib/auth";
import { listProducts } from "@/lib/store";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Favoritos" };

export default async function FavoritesPage() {
  await requireChatGPTUser("/favoritos");
  const user = await getCurrentAppUser();
  if (!user) return null;
  const db = await getDb();
  const rows = await db.select({ productId: favorites.productId }).from(favorites).where(eq(favorites.userId, user.id));
  const ids = new Set(rows.map((row) => row.productId));
  const productRows = (await listProducts({ limit: 60 })).filter((product) => ids.has(product.id));
  return <main className="page-dark account-list-page"><div className="container page-heading"><p className="eyebrow">SUA SELEÇÃO</p><h1>FAVORITOS.</h1><p>Produtos salvos para seu próximo rolamento.</p></div><div className="container account-products"><ProductGrid products={productRows} /></div></main>;
}

