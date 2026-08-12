import {
  and,
  asc,
  desc,
  eq,
  gte,
  like,
  lte,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { getDb } from "@/db";
import {
  categories,
  banners,
  productImages,
  products,
  productVariants,
  reviews,
  storeSettings,
  users,
} from "@/db/schema";
import type { ProductDetail, ProductListItem } from "./types";

export type ProductFilters = {
  query?: string;
  category?: string;
  color?: string;
  size?: string;
  availability?: "in-stock" | "out-of-stock";
  minPriceCents?: number;
  maxPriceCents?: number;
  sort?: "best-selling" | "newest" | "price-asc" | "price-desc";
  limit?: number;
  offset?: number;
  featured?: boolean;
};

const productSelection = {
  id: products.id,
  name: products.name,
  slug: products.slug,
  categoryId: products.categoryId,
  categoryName: categories.name,
  categorySlug: categories.slug,
  shortDescription: products.shortDescription,
  priceCents: products.priceCents,
  salePriceCents: products.salePriceCents,
  featured: products.featured,
  isNew: products.isNew,
  salesCount: products.salesCount,
  imageUrl: sql<string | null>`max(case when ${productImages.isPrimary} = 1 then ${productImages.url} else null end)`,
  stock: sql<number>`coalesce(sum(case when ${productVariants.active} = 1 then ${productVariants.stock} else 0 end), 0)`,
  minimumStock: sql<number>`coalesce(sum(case when ${productVariants.active} = 1 then ${productVariants.minimumStock} else 0 end), 0)`,
};

export async function listProducts(filters: ProductFilters = {}): Promise<ProductListItem[]> {
  const db = await getDb();
  const conditions: SQL[] = [eq(products.active, true), sql`${products.deletedAt} is null`, eq(categories.active, true)];
  const normalizedQuery = filters.query?.trim().toLowerCase();

  if (normalizedQuery) {
    const pattern = `%${normalizedQuery.replace(/[%_]/g, "")}%`;
    conditions.push(
      or(
        like(sql`lower(${products.name})`, pattern),
        like(sql`lower(${products.description})`, pattern),
        like(sql`lower(${products.baseSku})`, pattern),
        like(sql`lower(${categories.name})`, pattern),
      )!,
    );
  }
  if (filters.category) conditions.push(eq(categories.slug, filters.category));
  if (filters.color) conditions.push(eq(productVariants.color, filters.color));
  if (filters.size) conditions.push(eq(productVariants.size, filters.size));
  if (filters.minPriceCents != null) {
    conditions.push(gte(sql`coalesce(${products.salePriceCents}, ${products.priceCents})`, filters.minPriceCents));
  }
  if (filters.maxPriceCents != null) {
    conditions.push(lte(sql`coalesce(${products.salePriceCents}, ${products.priceCents})`, filters.maxPriceCents));
  }
  if (filters.featured) conditions.push(eq(products.featured, true));

  const order = filters.sort === "price-asc"
    ? asc(sql`coalesce(${products.salePriceCents}, ${products.priceCents})`)
    : filters.sort === "price-desc"
      ? desc(sql`coalesce(${products.salePriceCents}, ${products.priceCents})`)
      : filters.sort === "newest"
        ? desc(products.createdAt)
        : desc(products.salesCount);

  const rows = await db
    .select(productSelection)
    .from(products)
    .innerJoin(categories, eq(categories.id, products.categoryId))
    .leftJoin(
      productImages,
      and(eq(productImages.productId, products.id), eq(productImages.isPrimary, true)),
    )
    .leftJoin(productVariants, eq(productVariants.productId, products.id))
    .where(and(...conditions))
    .groupBy(
      products.id,
      products.name,
      products.slug,
      products.categoryId,
      categories.name,
      categories.slug,
      products.shortDescription,
      products.priceCents,
      products.salePriceCents,
      products.featured,
      products.isNew,
      products.salesCount,
    )
    .having(
      filters.availability === "in-stock"
        ? sql`sum(case when ${productVariants.active} = 1 then ${productVariants.stock} else 0 end) > 0`
        : filters.availability === "out-of-stock"
          ? sql`sum(case when ${productVariants.active} = 1 then ${productVariants.stock} else 0 end) = 0`
          : undefined,
    )
    .orderBy(order)
    .limit(Math.min(Math.max(filters.limit ?? 24, 1), 60))
    .offset(Math.max(filters.offset ?? 0, 0));

  return rows as ProductListItem[];
}

export async function getProductBySlug(slug: string): Promise<ProductDetail | null> {
  const db = await getDb();
  const [product] = await db
    .select({
      id: products.id,
      name: products.name,
      slug: products.slug,
      categoryId: products.categoryId,
      categoryName: categories.name,
      categorySlug: categories.slug,
      shortDescription: products.shortDescription,
      description: products.description,
      brand: products.brand,
      baseSku: products.baseSku,
      priceCents: products.priceCents,
      salePriceCents: products.salePriceCents,
      weightGrams: products.weightGrams,
      featured: products.featured,
      isNew: products.isNew,
      salesCount: products.salesCount,
      metaTitle: products.metaTitle,
      metaDescription: products.metaDescription,
    })
    .from(products)
    .innerJoin(categories, eq(categories.id, products.categoryId))
    .where(and(eq(products.slug, slug), eq(products.active, true), sql`${products.deletedAt} is null`))
    .limit(1);

  if (!product) return null;
  const [images, variants, approvedReviews] = await Promise.all([
    db
      .select({ id: productImages.id, url: productImages.url, alt: productImages.alt, isPrimary: productImages.isPrimary })
      .from(productImages)
      .where(eq(productImages.productId, product.id))
      .orderBy(desc(productImages.isPrimary), asc(productImages.sortOrder)),
    db
      .select({
        id: productVariants.id,
        sku: productVariants.sku,
        color: productVariants.color,
        size: productVariants.size,
        stock: productVariants.stock,
        minimumStock: productVariants.minimumStock,
        priceAdjustmentCents: productVariants.priceAdjustmentCents,
        active: productVariants.active,
      })
      .from(productVariants)
      .where(and(eq(productVariants.productId, product.id), eq(productVariants.active, true)))
      .orderBy(asc(productVariants.color), asc(productVariants.size)),
    db
      .select({
        id: reviews.id,
        rating: reviews.rating,
        comment: reviews.comment,
        customerName: users.name,
        verifiedPurchase: reviews.verifiedPurchase,
        createdAt: reviews.createdAt,
      })
      .from(reviews)
      .innerJoin(users, eq(users.id, reviews.userId))
      .where(and(eq(reviews.productId, product.id), eq(reviews.status, "APPROVED")))
      .orderBy(desc(reviews.createdAt))
      .limit(20),
  ]);

  const stock = variants.reduce((sum, variant) => sum + variant.stock, 0);
  const minimumStock = variants.reduce((sum, variant) => sum + variant.minimumStock, 0);
  return {
    ...product,
    imageUrl: images.find((image) => image.isPrimary)?.url ?? images[0]?.url ?? null,
    stock,
    minimumStock,
    images,
    variants,
    reviews: approvedReviews,
  } as ProductDetail;
}

export async function listCategories() {
  const db = await getDb();
  return db
    .select()
    .from(categories)
    .where(and(eq(categories.active, true), sql`${categories.deletedAt} is null`))
    .orderBy(asc(categories.sortOrder), asc(categories.name));
}

export async function getCategoryBySlug(slug: string) {
  const db = await getDb();
  const [category] = await db
    .select()
    .from(categories)
    .where(and(eq(categories.slug, slug), eq(categories.active, true), sql`${categories.deletedAt} is null`))
    .limit(1);
  return category ?? null;
}

export async function getStoreSettings(): Promise<Record<string, string>> {
  const db = await getDb();
  const rows = await db.select().from(storeSettings);
  return Object.fromEntries(rows.map((row) => [row.key, row.value]));
}

export async function getActiveBanner() {
  const db = await getDb();
  const [banner] = await db.select().from(banners).where(eq(banners.active, true)).orderBy(asc(banners.sortOrder)).limit(1);
  return banner ?? null;
}
