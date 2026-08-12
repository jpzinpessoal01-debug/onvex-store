import { and, asc, desc, eq, gte, lte, sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  adminAuditLogs,
  banners,
  categories,
  coupons,
  inventoryMovements,
  orderItems,
  orders,
  productImages,
  products,
  productVariants,
  reviews,
  storeSettings,
  users,
} from "@/db/schema";

export async function getAdminDashboard(range?: { since: string; until?: string; label: string; key: string }) {
  const db = await getDb();
  const since = range?.since ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const periodCondition = range?.until
    ? and(gte(orders.createdAt, since), lte(orders.createdAt, range.until))
    : gte(orders.createdAt, since);
  const [sales, soldRows, customerCount, productCount, lowStock, pendingCount, recentOrders, stockRows, salesByDay, topProducts] = await Promise.all([
    db.select({
      revenue: sql<number>`coalesce(sum(case when ${orders.paymentStatus}='PAID' then ${orders.totalCents} else 0 end),0)`,
      count: sql<number>`count(*)`,
      paidCount: sql<number>`coalesce(sum(case when ${orders.paymentStatus}='PAID' then 1 else 0 end),0)`,
    }).from(orders).where(periodCondition),
    db.select({ sold: sql<number>`coalesce(sum(${orderItems.quantity}),0)` })
      .from(orderItems)
      .innerJoin(orders, eq(orders.id, orderItems.orderId))
      .where(and(periodCondition, eq(orders.paymentStatus, "PAID"))),
    db.select({ count: sql<number>`count(*)` }).from(users).where(eq(users.role, "CUSTOMER")),
    db.select({ count: sql<number>`count(*)` }).from(products).where(and(eq(products.active, true), sql`${products.deletedAt} is null`)),
    db.select({ count: sql<number>`count(*)` }).from(productVariants).where(and(eq(productVariants.active, true), sql`${productVariants.stock} <= ${productVariants.minimumStock}`)),
    db.select({ count: sql<number>`count(*)` }).from(orders).where(eq(orders.status, "PENDING")),
    db.select().from(orders).where(periodCondition).orderBy(desc(orders.createdAt)).limit(7),
    db.select({ variantId: productVariants.id, productName: products.name, sku: productVariants.sku, color: productVariants.color, size: productVariants.size, stock: productVariants.stock, minimumStock: productVariants.minimumStock }).from(productVariants).innerJoin(products, eq(products.id, productVariants.productId)).where(and(eq(productVariants.active, true), sql`${productVariants.stock} <= ${productVariants.minimumStock}`)).orderBy(asc(productVariants.stock)).limit(8),
    db.select({
      day: sql<string>`substr(${orders.createdAt},1,10)`,
      revenue: sql<number>`coalesce(sum(${orders.totalCents}),0)`,
      count: sql<number>`count(*)`,
    }).from(orders).where(and(periodCondition, eq(orders.paymentStatus, "PAID"))).groupBy(sql`substr(${orders.createdAt},1,10)`).orderBy(asc(sql`substr(${orders.createdAt},1,10)`)),
    db.select({ name: orderItems.productName, quantity: sql<number>`sum(${orderItems.quantity})`, revenue: sql<number>`sum(${orderItems.totalCents})` }).from(orderItems).innerJoin(orders, eq(orders.id, orderItems.orderId)).where(and(periodCondition, eq(orders.paymentStatus, "PAID"))).groupBy(orderItems.productName).orderBy(desc(sql`sum(${orderItems.quantity})`)).limit(5),
  ]);
  const orderCount = Number(sales[0]?.count ?? 0);
  const paidOrderCount = Number(sales[0]?.paidCount ?? 0);
  const revenue = Number(sales[0]?.revenue ?? 0);
  return {
    metrics: { revenue, orders: orderCount, sold: Number(soldRows[0]?.sold ?? 0), customers: Number(customerCount[0]?.count ?? 0), products: Number(productCount[0]?.count ?? 0), lowStock: Number(lowStock[0]?.count ?? 0), pending: Number(pendingCount[0]?.count ?? 0), averageTicket: paidOrderCount ? Math.round(revenue / paidOrderCount) : 0 },
    recentOrders, lowStockRows: stockRows, salesByDay, topProducts,
    periodLabel: range?.label ?? "30 dias",
    periodKey: range?.key ?? "30",
    periodSince: since,
    periodUntil: range?.until ?? new Date().toISOString(),
  };
}

export async function getAdminProducts() {
  const db = await getDb();
  return db.select({ id: products.id, name: products.name, slug: products.slug, category: categories.name, baseSku: products.baseSku, priceCents: products.priceCents, salePriceCents: products.salePriceCents, active: products.active, featured: products.featured, isNew: products.isNew, stock: sql<number>`coalesce(sum(${productVariants.stock}),0)`, variants: sql<number>`count(${productVariants.id})`, imageUrl: sql<string | null>`max(${productImages.url})` }).from(products).innerJoin(categories, eq(categories.id, products.categoryId)).leftJoin(productVariants, eq(productVariants.productId, products.id)).leftJoin(productImages, and(eq(productImages.productId, products.id), eq(productImages.isPrimary, true))).where(sql`${products.deletedAt} is null`).groupBy(products.id, categories.name).orderBy(desc(products.createdAt));
}

export async function getAdminCategories() {
  const db = await getDb();
  return db.select({ id: categories.id, name: categories.name, slug: categories.slug, description: categories.description, imageUrl: categories.imageUrl, sortOrder: categories.sortOrder, active: categories.active, products: sql<number>`count(${products.id})` }).from(categories).leftJoin(products, and(eq(products.categoryId, categories.id), sql`${products.deletedAt} is null`)).where(sql`${categories.deletedAt} is null`).groupBy(categories.id).orderBy(asc(categories.sortOrder));
}

export async function getAdminInventory() {
  const db = await getDb();
  return db.select({ variantId: productVariants.id, productId: products.id, productName: products.name, category: categories.name, sku: productVariants.sku, color: productVariants.color, size: productVariants.size, stock: productVariants.stock, minimumStock: productVariants.minimumStock, active: productVariants.active }).from(productVariants).innerJoin(products, eq(products.id, productVariants.productId)).innerJoin(categories, eq(categories.id, products.categoryId)).where(sql`${products.deletedAt} is null`).orderBy(asc(products.name), asc(productVariants.color), asc(productVariants.size));
}

export async function getAdminMovements() {
  const db = await getDb();
  return db.select({ id: inventoryMovements.id, productName: products.name, sku: productVariants.sku, color: productVariants.color, size: productVariants.size, quantityBefore: inventoryMovements.quantityBefore, quantityChanged: inventoryMovements.quantityChanged, quantityAfter: inventoryMovements.quantityAfter, type: inventoryMovements.type, note: inventoryMovements.note, adminName: users.name, createdAt: inventoryMovements.createdAt }).from(inventoryMovements).innerJoin(products, eq(products.id, inventoryMovements.productId)).innerJoin(productVariants, eq(productVariants.id, inventoryMovements.variantId)).leftJoin(users, eq(users.id, inventoryMovements.adminUserId)).orderBy(desc(inventoryMovements.createdAt)).limit(300);
}

export async function getAdminOrders() {
  const db = await getDb();
  return db.select().from(orders).orderBy(desc(orders.createdAt)).limit(200);
}

export async function getAdminCustomers() {
  const db = await getDb();
  return db.select({ id: users.id, name: users.name, email: users.email, phone: users.phone, active: users.active, role: users.role, orders: sql<number>`count(${orders.id})`, totalSpent: sql<number>`coalesce(sum(case when ${orders.paymentStatus}='PAID' then ${orders.totalCents} else 0 end),0)`, lastOrder: sql<string | null>`max(${orders.createdAt})` }).from(users).leftJoin(orders, eq(orders.userId, users.id)).groupBy(users.id).orderBy(desc(sql`max(${orders.createdAt})`));
}

export async function getAdminCoupons() { const db = await getDb(); return db.select().from(coupons).orderBy(desc(coupons.createdAt)); }
export async function getAdminReviews() { const db = await getDb(); return db.select({ id: reviews.id, productName: products.name, customerName: users.name, rating: reviews.rating, comment: reviews.comment, status: reviews.status, verifiedPurchase: reviews.verifiedPurchase, createdAt: reviews.createdAt }).from(reviews).innerJoin(products, eq(products.id, reviews.productId)).innerJoin(users, eq(users.id, reviews.userId)).orderBy(desc(reviews.createdAt)); }
export async function getAdminBanners() { const db = await getDb(); return db.select().from(banners).orderBy(asc(banners.sortOrder)); }
export async function getAdminSettings() { const db = await getDb(); return db.select().from(storeSettings).orderBy(asc(storeSettings.key)); }
export async function getAdminUsers() { const db = await getDb(); return db.select().from(users).orderBy(desc(users.createdAt)); }
export async function getAdminLogs() { const db = await getDb(); return db.select({ id: adminAuditLogs.id, adminName: users.name, adminEmail: users.email, action: adminAuditLogs.action, entityType: adminAuditLogs.entityType, entityId: adminAuditLogs.entityId, ip: adminAuditLogs.ip, data: adminAuditLogs.data, createdAt: adminAuditLogs.createdAt }).from(adminAuditLogs).leftJoin(users, eq(users.id, adminAuditLogs.adminUserId)).orderBy(desc(adminAuditLogs.createdAt)).limit(400); }
