import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
};

export const users = sqliteTable(
  "users",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    email: text("email").notNull(),
    name: text("name").notNull(),
    phone: text("phone"),
    cpf: text("cpf"),
    role: text("role", { enum: ["CUSTOMER", "ADMIN", "SUPER_ADMIN"] })
      .notNull()
      .default("CUSTOMER"),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    emailVerifiedAt: text("email_verified_at"),
    lastLoginAt: text("last_login_at"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("users_email_unique").on(table.email),
    index("users_role_idx").on(table.role),
  ],
);

export const addresses = sqliteTable(
  "addresses",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    label: text("label").notNull().default("Principal"),
    recipientName: text("recipient_name").notNull(),
    postalCode: text("postal_code").notNull(),
    street: text("street").notNull(),
    number: text("number").notNull(),
    complement: text("complement"),
    district: text("district").notNull(),
    city: text("city").notNull(),
    state: text("state").notNull(),
    isDefault: integer("is_default", { mode: "boolean" }).notNull().default(false),
    ...timestamps,
  },
  (table) => [index("addresses_user_idx").on(table.userId)],
);

export const categories = sqliteTable(
  "categories",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description").notNull().default(""),
    imageUrl: text("image_url"),
    sortOrder: integer("sort_order").notNull().default(0),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    deletedAt: text("deleted_at"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("categories_slug_unique").on(table.slug),
    index("categories_active_order_idx").on(table.active, table.sortOrder),
  ],
);

export const products = sqliteTable(
  "products",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    categoryId: integer("category_id")
      .notNull()
      .references(() => categories.id),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    shortDescription: text("short_description").notNull().default(""),
    description: text("description").notNull().default(""),
    brand: text("brand").notNull().default("ONVEX"),
    baseSku: text("base_sku").notNull(),
    priceCents: integer("price_cents").notNull(),
    salePriceCents: integer("sale_price_cents"),
    weightGrams: integer("weight_grams").notNull().default(0),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    featured: integer("featured", { mode: "boolean" }).notNull().default(false),
    isNew: integer("is_new", { mode: "boolean" }).notNull().default(false),
    salesCount: integer("sales_count").notNull().default(0),
    metaTitle: text("meta_title"),
    metaDescription: text("meta_description"),
    deletedAt: text("deleted_at"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("products_slug_unique").on(table.slug),
    uniqueIndex("products_base_sku_unique").on(table.baseSku),
    index("products_category_active_idx").on(table.categoryId, table.active),
    index("products_featured_idx").on(table.featured, table.salesCount),
  ],
);

export const productImages = sqliteTable(
  "product_images",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    storageKey: text("storage_key"),
    url: text("url").notNull(),
    alt: text("alt").notNull().default(""),
    sortOrder: integer("sort_order").notNull().default(0),
    isPrimary: integer("is_primary", { mode: "boolean" }).notNull().default(false),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("product_images_product_order_idx").on(table.productId, table.sortOrder),
    uniqueIndex("product_images_primary_unique").on(table.productId).where(sql`${table.isPrimary} = 1`),
  ],
);

export const productVariants = sqliteTable(
  "product_variants",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    sku: text("sku").notNull(),
    color: text("color").notNull(),
    size: text("size").notNull(),
    stock: integer("stock").notNull().default(0),
    minimumStock: integer("minimum_stock").notNull().default(5),
    priceAdjustmentCents: integer("price_adjustment_cents").notNull().default(0),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("product_variants_sku_unique").on(table.sku),
    uniqueIndex("product_variant_options_unique").on(table.productId, table.color, table.size),
    index("product_variants_product_idx").on(table.productId, table.active),
    index("product_variants_stock_idx").on(table.stock, table.minimumStock),
    check("product_variants_stock_nonnegative", sql`${table.stock} >= 0`),
    check("product_variants_minimum_nonnegative", sql`${table.minimumStock} >= 0`),
  ],
);

export const inventoryMovements = sqliteTable(
  "inventory_movements",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    productId: integer("product_id").notNull().references(() => products.id),
    variantId: integer("variant_id").notNull().references(() => productVariants.id),
    quantityBefore: integer("quantity_before").notNull(),
    quantityChanged: integer("quantity_changed").notNull(),
    quantityAfter: integer("quantity_after").notNull(),
    type: text("type", {
      enum: ["RESTOCK", "SALE", "RETURN", "ADJUSTMENT", "CANCELATION", "MANUAL"],
    }).notNull(),
    adminUserId: integer("admin_user_id").references(() => users.id),
    orderId: integer("order_id"),
    note: text("note").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("inventory_variant_date_idx").on(table.variantId, table.createdAt),
    index("inventory_type_date_idx").on(table.type, table.createdAt),
    check("inventory_final_nonnegative", sql`${table.quantityAfter} >= 0`),
  ],
);

export const coupons = sqliteTable(
  "coupons",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    code: text("code").notNull(),
    type: text("type", { enum: ["PERCENTAGE", "FIXED"] }).notNull(),
    value: integer("value").notNull(),
    minimumCents: integer("minimum_cents").notNull().default(0),
    startsAt: text("starts_at"),
    endsAt: text("ends_at"),
    maximumUses: integer("maximum_uses"),
    usesPerCustomer: integer("uses_per_customer").notNull().default(1),
    currentUses: integer("current_uses").notNull().default(0),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    ...timestamps,
  },
  (table) => [uniqueIndex("coupons_code_unique").on(table.code), index("coupons_active_idx").on(table.active)],
);

export const couponProducts = sqliteTable(
  "coupon_products",
  {
    couponId: integer("coupon_id").notNull().references(() => coupons.id, { onDelete: "cascade" }),
    productId: integer("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.couponId, table.productId] })],
);

export const couponCategories = sqliteTable(
  "coupon_categories",
  {
    couponId: integer("coupon_id").notNull().references(() => coupons.id, { onDelete: "cascade" }),
    categoryId: integer("category_id").notNull().references(() => categories.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.couponId, table.categoryId] })],
);

export const carts = sqliteTable(
  "carts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
    anonymousToken: text("anonymous_token"),
    couponId: integer("coupon_id").references(() => coupons.id, { onDelete: "set null" }),
    status: text("status", { enum: ["ACTIVE", "CONVERTED", "ABANDONED"] }).notNull().default("ACTIVE"),
    ...timestamps,
  },
  (table) => [
    index("carts_user_status_idx").on(table.userId, table.status),
    uniqueIndex("carts_user_active_unique").on(table.userId).where(sql`${table.status} = 'ACTIVE' AND ${table.userId} IS NOT NULL`),
    uniqueIndex("carts_anonymous_unique").on(table.anonymousToken),
  ],
);

export const cartItems = sqliteTable(
  "cart_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    cartId: integer("cart_id").notNull().references(() => carts.id, { onDelete: "cascade" }),
    variantId: integer("variant_id").notNull().references(() => productVariants.id),
    quantity: integer("quantity").notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("cart_items_cart_variant_unique").on(table.cartId, table.variantId),
    check("cart_items_quantity_positive", sql`${table.quantity} > 0`),
  ],
);

export const orders = sqliteTable(
  "orders",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    orderNumber: text("order_number").notNull(),
    userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
    customerName: text("customer_name").notNull(),
    customerEmail: text("customer_email").notNull(),
    customerPhone: text("customer_phone").notNull(),
    customerCpf: text("customer_cpf"),
    subtotalCents: integer("subtotal_cents").notNull(),
    discountCents: integer("discount_cents").notNull().default(0),
    shippingCents: integer("shipping_cents").notNull().default(0),
    totalCents: integer("total_cents").notNull(),
    couponCode: text("coupon_code"),
    paymentMethod: text("payment_method", { enum: ["PIX", "CREDIT_CARD"] }).notNull(),
    paymentStatus: text("payment_status", { enum: ["PENDING", "PAID", "FAILED", "REFUNDED"] }).notNull().default("PENDING"),
    status: text("status", {
      enum: ["PENDING", "PAID", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELED", "REFUNDED"],
    }).notNull().default("PENDING"),
    addressSnapshot: text("address_snapshot").notNull(),
    carrier: text("carrier"),
    trackingCode: text("tracking_code"),
    trackingUrl: text("tracking_url"),
    notes: text("notes"),
    paidAt: text("paid_at"),
    canceledAt: text("canceled_at"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("orders_number_unique").on(table.orderNumber),
    index("orders_user_date_idx").on(table.userId, table.createdAt),
    index("orders_status_date_idx").on(table.status, table.createdAt),
    check("orders_totals_nonnegative", sql`${table.subtotalCents} >= 0 AND ${table.discountCents} >= 0 AND ${table.shippingCents} >= 0 AND ${table.totalCents} >= 0`),
  ],
);

export const orderItems = sqliteTable(
  "order_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    orderId: integer("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
    productId: integer("product_id").references(() => products.id, { onDelete: "set null" }),
    variantId: integer("variant_id").references(() => productVariants.id, { onDelete: "set null" }),
    productName: text("product_name").notNull(),
    productSlug: text("product_slug").notNull(),
    sku: text("sku").notNull(),
    color: text("color").notNull(),
    size: text("size").notNull(),
    imageUrl: text("image_url"),
    unitPriceCents: integer("unit_price_cents").notNull(),
    quantity: integer("quantity").notNull(),
    totalCents: integer("total_cents").notNull(),
  },
  (table) => [index("order_items_order_idx").on(table.orderId)],
);

export const orderEvents = sqliteTable(
  "order_events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    orderId: integer("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    message: text("message").notNull(),
    adminUserId: integer("admin_user_id").references(() => users.id),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("order_events_order_date_idx").on(table.orderId, table.createdAt)],
);

export const payments = sqliteTable(
  "payments",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    orderId: integer("order_id").notNull().references(() => orders.id),
    gateway: text("gateway").notNull(),
    gatewayPaymentId: text("gateway_payment_id"),
    method: text("method").notNull(),
    amountCents: integer("amount_cents").notNull(),
    status: text("status").notNull().default("PENDING"),
    idempotencyKey: text("idempotency_key").notNull(),
    rawResponse: text("raw_response"),
    paidAt: text("paid_at"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("payments_idempotency_unique").on(table.idempotencyKey),
    uniqueIndex("payments_gateway_payment_unique").on(table.gatewayPaymentId),
    index("payments_order_idx").on(table.orderId),
  ],
);

export const couponUsages = sqliteTable(
  "coupon_usages",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    couponId: integer("coupon_id").notNull().references(() => coupons.id),
    userId: integer("user_id").references(() => users.id),
    orderId: integer("order_id").notNull().references(() => orders.id),
    usedAt: text("used_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("coupon_usages_coupon_user_idx").on(table.couponId, table.userId),
    uniqueIndex("coupon_usages_order_unique").on(table.orderId),
  ],
);

export const favorites = sqliteTable(
  "favorites",
  {
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    productId: integer("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [primaryKey({ columns: [table.userId, table.productId] })],
);

export const reviews = sqliteTable(
  "reviews",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id").notNull().references(() => users.id),
    productId: integer("product_id").notNull().references(() => products.id),
    orderId: integer("order_id").references(() => orders.id),
    rating: integer("rating").notNull(),
    comment: text("comment").notNull(),
    status: text("status", { enum: ["PENDING", "APPROVED", "REJECTED"] }).notNull().default("PENDING"),
    verifiedPurchase: integer("verified_purchase", { mode: "boolean" }).notNull().default(false),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("reviews_user_product_unique").on(table.userId, table.productId),
    index("reviews_product_status_idx").on(table.productId, table.status),
    check("reviews_rating_range", sql`${table.rating} BETWEEN 1 AND 5`),
  ],
);

export const banners = sqliteTable(
  "banners",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    imageUrl: text("image_url").notNull(),
    link: text("link").notNull().default("/loja"),
    sortOrder: integer("sort_order").notNull().default(0),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    ...timestamps,
  },
  (table) => [index("banners_active_order_idx").on(table.active, table.sortOrder)],
);

export const storeSettings = sqliteTable("store_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedBy: integer("updated_by").references(() => users.id),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const adminAuditLogs = sqliteTable(
  "admin_audit_logs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    adminUserId: integer("admin_user_id").references(() => users.id),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    ip: text("ip"),
    data: text("data").notNull().default("{}"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("audit_admin_date_idx").on(table.adminUserId, table.createdAt)],
);

export const webhookEvents = sqliteTable("webhook_events", {
  eventId: text("event_id").primaryKey(),
  provider: text("provider").notNull(),
  payloadHash: text("payload_hash").notNull(),
  processedAt: text("processed_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const passwordResetTokens = sqliteTable("password_reset_tokens", {
  tokenHash: text("token_hash").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: text("expires_at").notNull(),
  usedAt: text("used_at"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const emailVerificationTokens = sqliteTable("email_verification_tokens", {
  tokenHash: text("token_hash").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: text("expires_at").notNull(),
  usedAt: text("used_at"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const rateLimits = sqliteTable(
  "rate_limits",
  {
    key: text("key").primaryKey(),
    count: integer("count").notNull().default(0),
    windowStart: text("window_start").notNull(),
  },
  (table) => [check("rate_limits_count_nonnegative", sql`${table.count} >= 0`)],
);

export const newsletterSubscribers = sqliteTable(
  "newsletter_subscribers",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    email: text("email").notNull(),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    source: text("source").notNull().default("home"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [uniqueIndex("newsletter_email_unique").on(table.email)],
);

export const contactMessages = sqliteTable(
  "contact_messages",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),
    subject: text("subject").notNull(),
    message: text("message").notNull(),
    status: text("status", { enum: ["NEW", "READ", "CLOSED"] }).notNull().default("NEW"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("contact_status_date_idx").on(table.status, table.createdAt)],
);
