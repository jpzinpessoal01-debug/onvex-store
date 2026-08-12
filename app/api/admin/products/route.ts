import { and, eq, sql } from "drizzle-orm";
import { getDb, getRawDb } from "@/db";
import { getRuntimeEnv } from "@/lib/runtime-env";
import { productImages, products, productVariants } from "@/db/schema";
import { requireAdminApi } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { AppError, assertInteger, cleanText, enforceSameOrigin, errorResponse, optionalText } from "@/lib/errors";
import { slugify } from "@/lib/format";

type VariantInput = { id?: number; sku?: string; color?: string; size?: string; stock?: number; minimumStock?: number; priceAdjustmentCents?: number; active?: boolean };
type ImageInput = { id?: number; storageKey?: string | null; url?: string; alt?: string; sortOrder?: number; isPrimary?: boolean };

function normalizeImages(value: unknown, productName: string): Array<{ storageKey: string | null; url: string; alt: string; sortOrder: number; isPrimary: boolean }> {
  if (!Array.isArray(value)) return [];
  if (value.length > 10) throw new AppError(400, "Use no máximo 10 imagens por produto.", "IMAGE_LIMIT");
  const rows = (value as ImageInput[]).map((image, index) => {
    const url = cleanText(image.url, "URL da imagem", 500);
    if (!url.startsWith("/")) throw new AppError(400, "Use imagens enviadas pelo painel.", "INVALID_IMAGE_URL");
    return {
      storageKey: optionalText(image.storageKey, 500),
      url,
      alt: optionalText(image.alt, 180) ?? productName,
      sortOrder: index,
      isPrimary: image.isPrimary === true,
    };
  });
  if (rows.length && !rows.some((image) => image.isPrimary)) rows[0].isPrimary = true;
  let primarySeen = false;
  return rows.map((image) => {
    const isPrimary = image.isPrimary && !primarySeen;
    if (isPrimary) primarySeen = true;
    return { ...image, isPrimary };
  });
}

export async function GET(request: Request) {
  try {
    await requireAdminApi();
    const id = Number(new URL(request.url).searchParams.get("id"));
    if (!Number.isInteger(id) || id < 1) return Response.json({ error: "Produto inválido." }, { status: 400 });
    const db = await getDb();
    const [product] = await db.select().from(products).where(eq(products.id, id)).limit(1);
    if (!product) return Response.json({ error: "Produto não encontrado." }, { status: 404 });
    const [variants, images] = await Promise.all([
      db.select().from(productVariants).where(and(eq(productVariants.productId, id), eq(productVariants.active, true))),
      db.select().from(productImages).where(eq(productImages.productId, id)),
    ]);
    return Response.json({ product, variants, images });
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request) {
  try {
    enforceSameOrigin(request);
    const admin = await requireAdminApi();
    const input = await request.json() as Record<string, unknown>;
    if (input.action === "duplicate") return duplicateProduct(request, admin, assertInteger(input.productId, "Produto"));
    const name = cleanText(input.name, "Nome", 180);
    const slug = slugify(optionalText(input.slug, 180) ?? name);
    const baseSku = cleanText(input.baseSku, "SKU", 80).toUpperCase();
    const categoryId = assertInteger(input.categoryId, "Categoria");
    const priceCents = assertInteger(input.priceCents, "Preço", 0);
    const salePriceCents = input.salePriceCents == null || input.salePriceCents === "" ? null : assertInteger(input.salePriceCents, "Preço promocional", 0);
    if (salePriceCents != null && salePriceCents >= priceCents) throw new AppError(400, "O preço promocional deve ser menor que o preço normal.", "INVALID_SALE_PRICE");
    const variants = Array.isArray(input.variants) ? input.variants as VariantInput[] : [];
    if (!variants.length) throw new AppError(400, "Adicione pelo menos uma variante.", "VARIANT_REQUIRED");
    const images = normalizeImages(input.images, name);
    const raw = await getRawDb();
    const now = new Date().toISOString();
    const statements: D1PreparedStatement[] = [raw.prepare(
      `INSERT INTO products (category_id,name,slug,short_description,description,brand,base_sku,price_cents,sale_price_cents,weight_grams,active,featured,is_new,meta_title,meta_description,created_at,updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    ).bind(categoryId, name, slug, optionalText(input.shortDescription, 300) ?? "", optionalText(input.description, 10000) ?? "", optionalText(input.brand, 80) ?? "ONVEX", baseSku, priceCents, salePriceCents, Number(input.weightGrams ?? 0), input.active !== false ? 1 : 0, input.featured === true ? 1 : 0, input.isNew === true ? 1 : 0, optionalText(input.metaTitle, 180), optionalText(input.metaDescription, 300), now, now)];
    for (const [index, variantInput] of variants.entries()) {
      const color = cleanText(variantInput.color, "Cor", 50);
      const size = cleanText(variantInput.size, "Tamanho", 30);
      const sku = (optionalText(variantInput.sku, 80) ?? `${baseSku}-${color}-${size}`).toUpperCase().replace(/\s+/g, "-");
      statements.push(raw.prepare("INSERT INTO product_variants (product_id,sku,color,size,stock,minimum_stock,price_adjustment_cents,active,created_at,updated_at) VALUES ((SELECT id FROM products WHERE slug=?),?,?,?,?,?,?,?,?,?)").bind(slug, sku, color, size, assertInteger(variantInput.stock ?? 0, `Estoque da variante ${index + 1}`, 0), assertInteger(variantInput.minimumStock ?? 5, "Estoque mínimo", 0), Number(variantInput.priceAdjustmentCents ?? 0), variantInput.active === false ? 0 : 1, now, now));
    }
    for (const image of images) {
      statements.push(raw.prepare("INSERT INTO product_images (product_id,storage_key,url,alt,sort_order,is_primary,created_at) VALUES ((SELECT id FROM products WHERE slug=?),?,?,?,?,?,?)").bind(slug, image.storageKey, image.url, image.alt, image.sortOrder, image.isPrimary ? 1 : 0, now));
    }
    await raw.batch(statements);
    const db = await getDb();
    const [created] = await db.select().from(products).where(eq(products.slug, slug)).limit(1);
    await recordAudit(admin, request, "PRODUCT_CREATED", "Product", created.id, { name, baseSku, variants: variants.length });
    return Response.json({ product: created }, { status: 201 });
  } catch (error) { return errorResponse(error); }
}

export async function PATCH(request: Request) {
  try {
    enforceSameOrigin(request);
    const admin = await requireAdminApi();
    const input = await request.json() as Record<string, unknown>;
    const id = assertInteger(input.id, "Produto");
    const db = await getDb();
    const [before] = await db.select().from(products).where(eq(products.id, id)).limit(1);
    if (!before) return Response.json({ error: "Produto não encontrado." }, { status: 404 });
    const update: Partial<typeof products.$inferInsert> = { updatedAt: new Date().toISOString() };
    if (input.name != null) update.name = cleanText(input.name, "Nome", 180);
    if (input.slug != null) update.slug = slugify(cleanText(input.slug, "Slug", 180));
    if (input.baseSku != null) update.baseSku = cleanText(input.baseSku, "SKU", 80).toUpperCase();
    if (input.brand != null) update.brand = cleanText(input.brand, "Marca", 80);
    if (input.categoryId != null) update.categoryId = assertInteger(input.categoryId, "Categoria");
    if (input.shortDescription != null) update.shortDescription = optionalText(input.shortDescription, 300) ?? "";
    if (input.description != null) update.description = optionalText(input.description, 10000) ?? "";
    if (input.priceCents != null) update.priceCents = assertInteger(input.priceCents, "Preço", 0);
    if ("salePriceCents" in input) update.salePriceCents = input.salePriceCents == null || input.salePriceCents === "" ? null : assertInteger(input.salePriceCents, "Preço promocional", 0);
    if (input.active != null) update.active = input.active === true;
    if (input.featured != null) update.featured = input.featured === true;
    if (input.isNew != null) update.isNew = input.isNew === true;
    if (input.weightGrams != null) update.weightGrams = assertInteger(input.weightGrams, "Peso", 0);
    if ("metaTitle" in input) update.metaTitle = optionalText(input.metaTitle, 180);
    if ("metaDescription" in input) update.metaDescription = optionalText(input.metaDescription, 300);
    const nextPrice = update.priceCents ?? before.priceCents;
    const nextSalePrice = "salePriceCents" in update ? update.salePriceCents : before.salePriceCents;
    if (nextSalePrice != null && nextSalePrice >= nextPrice) throw new AppError(400, "O preço promocional deve ser menor que o preço normal.", "INVALID_SALE_PRICE");
    await db.update(products).set(update).where(eq(products.id, id));
    if (Array.isArray(input.images)) {
      const existingImages = await db.select().from(productImages).where(eq(productImages.productId, id));
      const images = normalizeImages(input.images, update.name ?? before.name);
      const raw = await getRawDb();
      const imageStatements: D1PreparedStatement[] = [raw.prepare("DELETE FROM product_images WHERE product_id=?").bind(id)];
      for (const image of images) {
        imageStatements.push(raw.prepare("INSERT INTO product_images (product_id,storage_key,url,alt,sort_order,is_primary,created_at) VALUES (?,?,?,?,?,?,?)").bind(id, image.storageKey, image.url, image.alt, image.sortOrder, image.isPrimary ? 1 : 0, new Date().toISOString()));
      }
      await raw.batch(imageStatements);
      const keptKeys = new Set(images.map((image) => image.storageKey).filter(Boolean));
      const removedKeys = existingImages.map((image) => image.storageKey).filter((key): key is string => Boolean(key) && !keptKeys.has(key));
      if (removedKeys.length) {
        const runtime = await getRuntimeEnv<{ BUCKET?: R2Bucket }>();
        const bucket = runtime.BUCKET;
        if (bucket) {
          for (const key of removedKeys) {
            const [reference] = await db.select({ count: sql<number>`count(*)` }).from(productImages).where(eq(productImages.storageKey, key));
            if ((reference?.count ?? 0) === 0) await bucket.delete(key);
          }
        }
      }
    }
    if (Array.isArray(input.variants)) {
      const variantRows = input.variants as VariantInput[];
      if (!variantRows.length) throw new AppError(400, "Adicione pelo menos uma variante.", "VARIANT_REQUIRED");
      const existingVariants = await db.select({ id: productVariants.id }).from(productVariants).where(eq(productVariants.productId, id));
      const submittedIds = new Set(variantRows.map((item) => item.id).filter((variantId): variantId is number => Number.isInteger(variantId)));
      for (const existing of existingVariants) {
        if (!submittedIds.has(existing.id)) await db.update(productVariants).set({ active: false, updatedAt: sql`CURRENT_TIMESTAMP` }).where(eq(productVariants.id, existing.id));
      }
      for (const item of variantRows) {
        if (item.id) {
          await db.update(productVariants).set({ sku: item.sku?.toUpperCase(), color: item.color, size: item.size, minimumStock: item.minimumStock, priceAdjustmentCents: item.priceAdjustmentCents, active: item.active, updatedAt: sql`CURRENT_TIMESTAMP` }).where(and(eq(productVariants.id, item.id), eq(productVariants.productId, id)));
        } else {
          await db.insert(productVariants).values({ productId: id, sku: cleanText(item.sku, "SKU", 80).toUpperCase(), color: cleanText(item.color, "Cor", 50), size: cleanText(item.size, "Tamanho", 30), stock: assertInteger(item.stock ?? 0, "Estoque", 0), minimumStock: assertInteger(item.minimumStock ?? 5, "Estoque mínimo", 0), priceAdjustmentCents: Number(item.priceAdjustmentCents ?? 0), active: item.active !== false });
        }
      }
    }
    await recordAudit(admin, request, "PRODUCT_UPDATED", "Product", id, { before: { name: before.name, priceCents: before.priceCents }, changed: Object.keys(update) });
    if ((update.priceCents != null && update.priceCents !== before.priceCents) || ("salePriceCents" in update && update.salePriceCents !== before.salePriceCents)) {
      await recordAudit(admin, request, "PRODUCT_PRICE_CHANGED", "Product", id, { before: { priceCents: before.priceCents, salePriceCents: before.salePriceCents }, after: { priceCents: update.priceCents ?? before.priceCents, salePriceCents: "salePriceCents" in update ? update.salePriceCents : before.salePriceCents } });
    }
    return Response.json({ ok: true });
  } catch (error) { return errorResponse(error); }
}

export async function DELETE(request: Request) {
  try {
    enforceSameOrigin(request);
    const admin = await requireAdminApi();
    const input = await request.json() as Record<string, unknown>;
    const id = assertInteger(input.id, "Produto");
    const db = await getDb();
    await db.update(products).set({ active: false, deletedAt: sql`CURRENT_TIMESTAMP`, updatedAt: sql`CURRENT_TIMESTAMP` }).where(eq(products.id, id));
    await recordAudit(admin, request, "PRODUCT_ARCHIVED", "Product", id);
    return Response.json({ ok: true });
  } catch (error) { return errorResponse(error); }
}

async function duplicateProduct(request: Request, admin: Awaited<ReturnType<typeof requireAdminApi>>, id: number) {
  const db = await getDb();
  const [source] = await db.select().from(products).where(eq(products.id, id)).limit(1);
  if (!source) return Response.json({ error: "Produto não encontrado." }, { status: 404 });
  const [variants, images] = await Promise.all([
    db.select().from(productVariants).where(eq(productVariants.productId, id)),
    db.select().from(productImages).where(eq(productImages.productId, id)),
  ]);
  const suffix = crypto.getRandomValues(new Uint16Array(1))[0].toString(36).toUpperCase();
  const slug = `${source.slug}-copia-${suffix.toLowerCase()}`;
  const baseSku = `${source.baseSku}-COPY-${suffix}`;
  const raw = await getRawDb();
  const now = new Date().toISOString();
  const statements = [raw.prepare("INSERT INTO products (category_id,name,slug,short_description,description,brand,base_sku,price_cents,sale_price_cents,weight_grams,active,featured,is_new,sales_count,meta_title,meta_description,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(source.categoryId, `${source.name} — Cópia`, slug, source.shortDescription, source.description, source.brand, baseSku, source.priceCents, source.salePriceCents, source.weightGrams, 0, 0, source.isNew ? 1 : 0, 0, source.metaTitle, source.metaDescription, now, now)];
  variants.forEach((variant) => statements.push(raw.prepare("INSERT INTO product_variants (product_id,sku,color,size,stock,minimum_stock,price_adjustment_cents,active,created_at,updated_at) VALUES ((SELECT id FROM products WHERE slug=?),?,?,?,?,?,?,?,?,?)").bind(slug, `${variant.sku}-COPY-${suffix}`, variant.color, variant.size, 0, variant.minimumStock, variant.priceAdjustmentCents, variant.active ? 1 : 0, now, now)));
  images.forEach((image) => statements.push(raw.prepare("INSERT INTO product_images (product_id,storage_key,url,alt,sort_order,is_primary,created_at) VALUES ((SELECT id FROM products WHERE slug=?),?,?,?,?,?,?)").bind(slug, image.storageKey, image.url, image.alt, image.sortOrder, image.isPrimary ? 1 : 0, now)));
  await raw.batch(statements);
  const [created] = await db.select().from(products).where(eq(products.slug, slug)).limit(1);
  await recordAudit(admin, request, "PRODUCT_DUPLICATED", "Product", created.id, { sourceId: id });
  return Response.json({ product: created }, { status: 201 });
}
