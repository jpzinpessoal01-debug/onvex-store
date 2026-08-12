import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { getDb } from "@/db";
import {
  cartItems,
  carts,
  categories,
  couponCategories,
  couponProducts,
  coupons,
  couponUsages,
  productImages,
  products,
  productVariants,
  storeSettings,
} from "@/db/schema";
import { getCurrentAppUser } from "./auth";
import { assertStock, calculateTotals, effectivePrice, type CouponRule } from "./commerce";
import { AppError } from "./errors";
import type { CartLine, CartView } from "./types";

const CART_COOKIE = "onvex_cart";

export type CartContext = { cartId: number; userId: number | null; anonymousToken: string | null };

export async function resolveCart(create = true): Promise<CartContext | null> {
  const db = await getDb();
  const user = await getCurrentAppUser();
  const cookieStore = await cookies();
  const cookieToken = cookieStore.get(CART_COOKIE)?.value ?? null;

  if (user) {
    let [cart] = await db
      .select()
      .from(carts)
      .where(and(eq(carts.userId, user.id), eq(carts.status, "ACTIVE")))
      .limit(1);

    if (!cart && create) {
      [cart] = await db.insert(carts).values({ userId: user.id, status: "ACTIVE" }).onConflictDoNothing().returning();
      if (!cart) [cart] = await db.select().from(carts).where(and(eq(carts.userId, user.id), eq(carts.status, "ACTIVE"))).limit(1);
    }

    if (cart && cookieToken) {
      const [anonymousCart] = await db.select().from(carts).where(eq(carts.anonymousToken, cookieToken)).limit(1);
      if (anonymousCart && anonymousCart.id !== cart.id && anonymousCart.status === "ACTIVE") {
        const anonymousItems = await db.select().from(cartItems).where(eq(cartItems.cartId, anonymousCart.id));
        for (const item of anonymousItems) {
          const [existing] = await db.select().from(cartItems).where(and(eq(cartItems.cartId, cart.id), eq(cartItems.variantId, item.variantId))).limit(1);
          if (existing) {
            const [variant] = await db.select().from(productVariants).where(eq(productVariants.id, item.variantId)).limit(1);
            const nextQuantity = Math.min(variant?.stock ?? existing.quantity, existing.quantity + item.quantity);
            await db.update(cartItems).set({ quantity: nextQuantity, updatedAt: sql`CURRENT_TIMESTAMP` }).where(eq(cartItems.id, existing.id));
          } else {
            await db.update(cartItems).set({ cartId: cart.id, updatedAt: sql`CURRENT_TIMESTAMP` }).where(eq(cartItems.id, item.id));
          }
        }
        await db.update(carts).set({ status: "CONVERTED", updatedAt: sql`CURRENT_TIMESTAMP` }).where(eq(carts.id, anonymousCart.id));
        cookieStore.delete(CART_COOKIE);
      }
    }
    return cart ? { cartId: cart.id, userId: user.id, anonymousToken: null } : null;
  }

  if (cookieToken) {
    const [existing] = await db.select().from(carts).where(and(eq(carts.anonymousToken, cookieToken), eq(carts.status, "ACTIVE"))).limit(1);
    if (existing) return { cartId: existing.id, userId: null, anonymousToken: cookieToken };
  }
  if (!create) return null;

  const token = crypto.randomUUID();
  const [created] = await db.insert(carts).values({ anonymousToken: token, status: "ACTIVE" }).returning();
  cookieStore.set(CART_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return { cartId: created.id, userId: null, anonymousToken: token };
}

export async function getCartLines(cartId: number): Promise<CartLine[]> {
  const db = await getDb();
  const rows = await db
    .select({
      id: cartItems.id,
      variantId: productVariants.id,
      productId: products.id,
      productName: products.name,
      productSlug: products.slug,
      categoryId: categories.id,
      sku: productVariants.sku,
      color: productVariants.color,
      size: productVariants.size,
      quantity: cartItems.quantity,
      stock: productVariants.stock,
      priceCents: products.priceCents,
      salePriceCents: products.salePriceCents,
      priceAdjustmentCents: productVariants.priceAdjustmentCents,
      imageUrl: sql<string | null>`max(case when ${productImages.isPrimary} = 1 then ${productImages.url} else null end)`,
    })
    .from(cartItems)
    .innerJoin(productVariants, eq(productVariants.id, cartItems.variantId))
    .innerJoin(products, eq(products.id, productVariants.productId))
    .innerJoin(categories, eq(categories.id, products.categoryId))
    .leftJoin(
      productImages,
      and(eq(productImages.productId, products.id), eq(productImages.isPrimary, true)),
    )
    .where(and(eq(cartItems.cartId, cartId), eq(products.active, true), eq(productVariants.active, true)))
    .groupBy(
      cartItems.id,
      productVariants.id,
      products.id,
      products.name,
      products.slug,
      categories.id,
      productVariants.sku,
      productVariants.color,
      productVariants.size,
      cartItems.quantity,
      productVariants.stock,
      products.priceCents,
      products.salePriceCents,
      productVariants.priceAdjustmentCents,
    )
    .orderBy(asc(cartItems.createdAt));

  const productIds = [...new Set(rows.map((row) => row.productId))];
  const availableVariants = productIds.length
    ? await db
      .select({ id: productVariants.id, productId: productVariants.productId, color: productVariants.color, size: productVariants.size, stock: productVariants.stock })
      .from(productVariants)
      .where(and(inArray(productVariants.productId, productIds), eq(productVariants.active, true)))
      .orderBy(asc(productVariants.color), asc(productVariants.size))
    : [];

  return rows.map((row) => ({
    id: row.id,
    variantId: row.variantId,
    productId: row.productId,
    productName: row.productName,
    productSlug: row.productSlug,
    categoryId: row.categoryId,
    sku: row.sku,
    color: row.color,
    size: row.size,
    quantity: row.quantity,
    stock: row.stock,
    unitPriceCents: effectivePrice(row.priceCents, row.salePriceCents) + row.priceAdjustmentCents,
    imageUrl: row.imageUrl,
    availableVariants: availableVariants.filter((variant) => variant.productId === row.productId),
  }));
}

async function getCouponRule(couponId: number): Promise<(CouponRule & { id: number; code: string; usesPerCustomer: number }) | null> {
  const db = await getDb();
  const [coupon] = await db.select().from(coupons).where(eq(coupons.id, couponId)).limit(1);
  if (!coupon) return null;
  const [productRows, categoryRows] = await Promise.all([
    db.select({ id: couponProducts.productId }).from(couponProducts).where(eq(couponProducts.couponId, couponId)),
    db.select({ id: couponCategories.categoryId }).from(couponCategories).where(eq(couponCategories.couponId, couponId)),
  ]);
  return {
    id: coupon.id,
    code: coupon.code,
    type: coupon.type,
    value: coupon.value,
    minimumCents: coupon.minimumCents,
    startsAt: coupon.startsAt,
    endsAt: coupon.endsAt,
    maximumUses: coupon.maximumUses,
    currentUses: coupon.currentUses,
    active: coupon.active,
    usesPerCustomer: coupon.usesPerCustomer,
    productIds: productRows.map((row) => row.id),
    categoryIds: categoryRows.map((row) => row.id),
  };
}

export async function buildCartView(context: CartContext | null): Promise<CartView> {
  if (!context) return { id: 0, items: [], coupon: null, subtotalCents: 0, discountCents: 0, shippingCents: 0, totalCents: 0, itemCount: 0 };
  const db = await getDb();
  const [cart] = await db.select().from(carts).where(eq(carts.id, context.cartId)).limit(1);
  if (!cart) throw new AppError(404, "Carrinho não encontrado.", "CART_NOT_FOUND");
  const lines = await getCartLines(cart.id);
  const settingsRows = await db.select().from(storeSettings).where(sql`${storeSettings.key} in ('shipping_flat_cents', 'free_shipping_from_cents')`);
  const settings = Object.fromEntries(settingsRows.map((row) => [row.key, Number(row.value)]));
  const couponRule = cart.couponId ? await getCouponRule(cart.couponId) : null;
  const pricedLines = lines.map((line) => ({ productId: line.productId, categoryId: line.categoryId, unitPriceCents: line.unitPriceCents, quantity: line.quantity }));
  let totals;
  try {
    totals = calculateTotals(pricedLines, couponRule, settings.shipping_flat_cents ?? 2490, settings.free_shipping_from_cents ?? 69900);
  } catch {
    await db.update(carts).set({ couponId: null, updatedAt: sql`CURRENT_TIMESTAMP` }).where(eq(carts.id, cart.id));
    totals = calculateTotals(pricedLines, null, settings.shipping_flat_cents ?? 2490, settings.free_shipping_from_cents ?? 69900);
  }
  return {
    id: cart.id,
    items: lines,
    coupon: couponRule ? { code: couponRule.code, type: couponRule.type, value: couponRule.value } : null,
    ...totals,
    itemCount: lines.reduce((sum, line) => sum + line.quantity, 0),
  };
}

export async function addCartItem(context: CartContext, input: { variantId?: number; productId?: number; quantity: number }): Promise<void> {
  const db = await getDb();
  let variant;
  if (input.variantId) {
    [variant] = await db.select().from(productVariants).where(and(eq(productVariants.id, input.variantId), eq(productVariants.active, true))).limit(1);
  } else if (input.productId) {
    [variant] = await db.select().from(productVariants).where(and(eq(productVariants.productId, input.productId), eq(productVariants.active, true), sql`${productVariants.stock} > 0`)).orderBy(descStock()).limit(1);
  }
  if (!variant) throw new AppError(404, "Variação indisponível.", "VARIANT_NOT_FOUND");
  const [product] = await db.select().from(products).where(and(eq(products.id, variant.productId), eq(products.active, true))).limit(1);
  if (!product) throw new AppError(404, "Produto indisponível.", "PRODUCT_NOT_FOUND");
  const [existing] = await db.select().from(cartItems).where(and(eq(cartItems.cartId, context.cartId), eq(cartItems.variantId, variant.id))).limit(1);
  const nextQuantity = (existing?.quantity ?? 0) + input.quantity;
  assertStock(variant.stock, nextQuantity);
  if (existing) {
    await db.update(cartItems).set({ quantity: nextQuantity, updatedAt: sql`CURRENT_TIMESTAMP` }).where(eq(cartItems.id, existing.id));
  } else {
    await db.insert(cartItems).values({ cartId: context.cartId, variantId: variant.id, quantity: input.quantity });
  }
  await db.update(carts).set({ updatedAt: sql`CURRENT_TIMESTAMP` }).where(eq(carts.id, context.cartId));
}

function descStock() {
  return sql`${productVariants.stock} desc`;
}

export async function updateCartItem(context: CartContext, itemId: number, quantity: number, variantId?: number): Promise<void> {
  const db = await getDb();
  const [item] = await db.select().from(cartItems).where(and(eq(cartItems.id, itemId), eq(cartItems.cartId, context.cartId))).limit(1);
  if (!item) throw new AppError(404, "Item não encontrado no carrinho.", "CART_ITEM_NOT_FOUND");
  const targetVariantId = variantId ?? item.variantId;
  const [variant] = await db.select().from(productVariants).where(and(eq(productVariants.id, targetVariantId), eq(productVariants.active, true))).limit(1);
  if (!variant) throw new AppError(404, "Variação indisponível.", "VARIANT_NOT_FOUND");
  assertStock(variant.stock, quantity);
  const [duplicate] = await db.select().from(cartItems).where(and(eq(cartItems.cartId, context.cartId), eq(cartItems.variantId, targetVariantId))).limit(1);
  if (duplicate && duplicate.id !== item.id) {
    const mergedQuantity = duplicate.quantity + quantity;
    assertStock(variant.stock, mergedQuantity);
    await db.batch([
      db.update(cartItems).set({ quantity: mergedQuantity, updatedAt: sql`CURRENT_TIMESTAMP` }).where(eq(cartItems.id, duplicate.id)),
      db.delete(cartItems).where(eq(cartItems.id, item.id)),
    ]);
  } else {
    await db.update(cartItems).set({ quantity, variantId: targetVariantId, updatedAt: sql`CURRENT_TIMESTAMP` }).where(eq(cartItems.id, item.id));
  }
}

export async function removeCartItem(context: CartContext, itemId: number): Promise<void> {
  const db = await getDb();
  await db.delete(cartItems).where(and(eq(cartItems.id, itemId), eq(cartItems.cartId, context.cartId)));
  await db.update(carts).set({ updatedAt: sql`CURRENT_TIMESTAMP` }).where(eq(carts.id, context.cartId));
}

export async function applyCoupon(context: CartContext, code: string): Promise<CartView> {
  const db = await getDb();
  const normalized = code.trim().toUpperCase();
  const [coupon] = await db.select().from(coupons).where(eq(coupons.code, normalized)).limit(1);
  if (!coupon) throw new AppError(400, "Cupom inválido.", "COUPON_INVALID");
  const rule = await getCouponRule(coupon.id);
  if (!rule) throw new AppError(400, "Cupom inválido.", "COUPON_INVALID");
  if (context.userId) {
    const usageRows = await db.select({ count: sql<number>`count(*)` }).from(couponUsages).where(and(eq(couponUsages.couponId, coupon.id), eq(couponUsages.userId, context.userId)));
    if ((usageRows[0]?.count ?? 0) >= rule.usesPerCustomer) {
      throw new AppError(400, "Você já utilizou este cupom.", "COUPON_CUSTOMER_LIMIT");
    }
  }
  const lines = await getCartLines(context.cartId);
  const settingsRows = await db.select().from(storeSettings).where(sql`${storeSettings.key} in ('shipping_flat_cents', 'free_shipping_from_cents')`);
  const settings = Object.fromEntries(settingsRows.map((row) => [row.key, Number(row.value)]));
  calculateTotals(
    lines.map((line) => ({ productId: line.productId, categoryId: line.categoryId, unitPriceCents: line.unitPriceCents, quantity: line.quantity })),
    rule,
    settings.shipping_flat_cents ?? 2490,
    settings.free_shipping_from_cents ?? 69900,
  );
  await db.update(carts).set({ couponId: coupon.id, updatedAt: sql`CURRENT_TIMESTAMP` }).where(eq(carts.id, context.cartId));
  return buildCartView(context);
}
