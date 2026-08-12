import { and, eq, sql } from "drizzle-orm";
import { getDb, getRawDb } from "@/db";
import { couponUsages, coupons, orders, payments, storeSettings, users } from "@/db/schema";
import { requireUserApi } from "./auth";
import { buildCartView, resolveCart } from "./cart";
import { AppError, cleanText, normalizeEmail, optionalText } from "./errors";
import { enforceRateLimit } from "./rate-limit";
import { sendTransactionalEmail } from "./email";
import { getRuntimeEnv } from "./runtime-env";

export type CheckoutInput = {
  idempotencyKey: string;
  customer: { name: string; email: string; phone: string; cpf?: string | null };
  address: { postalCode: string; street: string; number: string; complement?: string | null; district: string; city: string; state: string };
  delivery: "STANDARD" | "EXPRESS";
  paymentMethod: "PIX" | "CREDIT_CARD";
  paymentToken?: string | null;
};

type PaymentIntentResult = {
  configured: boolean;
  gatewayPaymentId?: string;
  checkoutUrl?: string;
  qrCode?: string;
  raw?: unknown;
};

type PaymentRuntimeEnv = {
  PAYMENT_API_URL?: string;
  PAYMENT_ACCESS_TOKEN?: string;
  PAYMENT_PROVIDER?: string;
};

function validateCheckoutInput(input: CheckoutInput): CheckoutInput {
  const idempotencyKey = cleanText(input.idempotencyKey, "Chave da operação", 100);
  const name = cleanText(input.customer?.name, "Nome", 150);
  const email = normalizeEmail(input.customer?.email);
  const phone = cleanText(input.customer?.phone, "Telefone", 30);
  const cpf = optionalText(input.customer?.cpf, 20);
  const postalCode = cleanText(input.address?.postalCode, "CEP", 12);
  const street = cleanText(input.address?.street, "Rua", 180);
  const number = cleanText(input.address?.number, "Número", 20);
  const district = cleanText(input.address?.district, "Bairro", 100);
  const city = cleanText(input.address?.city, "Cidade", 100);
  const state = cleanText(input.address?.state, "Estado", 2).toUpperCase();
  if (!/^\d{5}-?\d{3}$/.test(postalCode)) throw new AppError(400, "Informe um CEP válido.", "VALIDATION_ERROR");
  if (!/^\(?\d{2}\)?\s?\d{4,5}-?\d{4}$/.test(phone.replace(/\s/g, ""))) throw new AppError(400, "Informe um telefone válido.", "VALIDATION_ERROR");
  if (!/^[A-Z]{2}$/.test(state)) throw new AppError(400, "Informe um estado válido.", "VALIDATION_ERROR");
  if (!(["STANDARD", "EXPRESS"] as const).includes(input.delivery)) throw new AppError(400, "Forma de entrega inválida.", "VALIDATION_ERROR");
  if (!(["PIX", "CREDIT_CARD"] as const).includes(input.paymentMethod)) throw new AppError(400, "Forma de pagamento inválida.", "VALIDATION_ERROR");
  return {
    idempotencyKey,
    customer: { name, email, phone, cpf },
    address: { postalCode, street, number, complement: optionalText(input.address?.complement, 100), district, city, state },
    delivery: input.delivery,
    paymentMethod: input.paymentMethod,
    paymentToken: optionalText(input.paymentToken, 500),
  };
}

function createOrderNumber(): string {
  const now = new Date();
  const date = `${now.getUTCFullYear().toString().slice(-2)}${String(now.getUTCMonth() + 1).padStart(2, "0")}${String(now.getUTCDate()).padStart(2, "0")}`;
  const random = crypto.randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase();
  return `ONV-${date}-${random}`;
}

async function createPaymentIntent(order: {
  orderNumber: string;
  totalCents: number;
  method: "PIX" | "CREDIT_CARD";
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerCpf?: string | null;
  paymentToken?: string | null;
  idempotencyKey: string;
}): Promise<PaymentIntentResult> {
  const runtime = await getRuntimeEnv<PaymentRuntimeEnv>();
  const provider = runtime.PAYMENT_PROVIDER?.trim().toUpperCase() || "";
  if (!runtime.PAYMENT_ACCESS_TOKEN) return { configured: false };

  const isGoatPay = provider === "GOATPAY";
  const endpoint = runtime.PAYMENT_API_URL?.trim() || (isGoatPay ? "https://api.goatpay.com.br/v1/billings/create" : "");
  if (!endpoint) return { configured: false };

  const headers: Record<string, string> = {
    "content-type": "application/json",
    "idempotency-key": order.idempotencyKey,
  };
  if (isGoatPay) headers["x-api-key"] = runtime.PAYMENT_ACCESS_TOKEN;
  else headers.authorization = `Bearer ${runtime.PAYMENT_ACCESS_TOKEN}`;

  const body = isGoatPay
    ? {
      method: order.method === "PIX" ? "PIX" : "CARD_CREDIT",
      amount: order.totalCents / 100,
      description: `Pedido ${order.orderNumber}`,
      externalReference: order.orderNumber,
      customer: {
        name: order.customerName,
        email: order.customerEmail,
        phone: order.customerPhone,
        ...(order.customerCpf ? { taxId: order.customerCpf.replace(/\D/g, "") } : {}),
      },
      ...(order.method === "CREDIT_CARD" && order.paymentToken ? { cardToken: order.paymentToken } : {}),
    }
    : {
      external_reference: order.orderNumber,
      amount: order.totalCents / 100,
      currency: "BRL",
      method: order.method,
      customer: { email: order.customerEmail },
      payment_token: order.paymentToken ?? undefined,
      webhook_metadata: { order_number: order.orderNumber },
    };

  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const rawEnvelope = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok || rawEnvelope.success === false) {
    const message = typeof rawEnvelope.message === "string" ? rawEnvelope.message : "O provedor de pagamento não aceitou a solicitação.";
    throw new AppError(502, `${message} Seu pedido continua pendente.`, "PAYMENT_PROVIDER_ERROR");
  }
  const raw = (isGoatPay && rawEnvelope.data && typeof rawEnvelope.data === "object")
    ? rawEnvelope.data as Record<string, unknown>
    : rawEnvelope;
  const transactionData = (raw.point_of_interaction as Record<string, unknown> | undefined)?.transaction_data as Record<string, unknown> | undefined;
  const pixCode = raw.pixCopyPaste ?? raw.copyPaste ?? raw.qr_code ?? transactionData?.qr_code;
  const checkoutUrl = raw.invoiceUrl ?? raw.payCheckoutUrl ?? raw.payPageUrl ?? raw.checkout_url ?? raw.init_point;
  return {
    configured: true,
    gatewayPaymentId: String(raw.id ?? raw.externalId ?? raw.payment_id ?? ""),
    checkoutUrl: typeof checkoutUrl === "string" ? checkoutUrl : undefined,
    qrCode: typeof pixCode === "string" ? pixCode : undefined,
    raw: rawEnvelope,
  };
}

export async function createOrder(inputValue: CheckoutInput) {
  const input = validateCheckoutInput(inputValue);
  const user = await requireUserApi();
  await enforceRateLimit(`checkout:user:${user.id}`, 6, 15 * 60);
  if (input.customer.email !== user.email.toLowerCase()) {
    throw new AppError(400, "Use o mesmo e-mail da sua conta no checkout.", "EMAIL_MISMATCH");
  }

  const db = await getDb();
  const [cpfSetting] = await db.select().from(storeSettings).where(eq(storeSettings.key, "cpf_required")).limit(1);
  if (cpfSetting?.value === "true" && !input.customer.cpf) throw new AppError(400, "Informe o CPF para continuar.", "CPF_REQUIRED");
  const [existingPayment] = await db.select({ orderId: payments.orderId }).from(payments).where(eq(payments.idempotencyKey, input.idempotencyKey)).limit(1);
  if (existingPayment) {
    const [existingOrder] = await db.select().from(orders).where(eq(orders.id, existingPayment.orderId)).limit(1);
    return { order: existingOrder, duplicate: true, payment: { configured: true } };
  }

  const context = await resolveCart(false);
  if (!context || context.userId !== user.id) throw new AppError(400, "Seu carrinho está vazio.", "EMPTY_CART");
  const cart = await buildCartView(context);
  if (!cart.items.length) throw new AppError(400, "Seu carrinho está vazio.", "EMPTY_CART");
  for (const item of cart.items) {
    if (item.quantity > item.stock) throw new AppError(409, `${item.productName} não possui mais a quantidade selecionada.`, "INSUFFICIENT_STOCK");
  }
  const [expressSetting] = await db.select().from(storeSettings).where(eq(storeSettings.key, "express_shipping_cents")).limit(1);
  const shippingCents = input.delivery === "EXPRESS" ? Math.max(Number(expressSetting?.value ?? 4990), 0) : cart.shippingCents;
  const totalCents = Math.max(0, cart.subtotalCents - cart.discountCents + shippingCents);

  let couponId: number | null = null;
  if (cart.coupon) {
    const [coupon] = await db.select().from(coupons).where(eq(coupons.code, cart.coupon.code)).limit(1);
    if (!coupon) throw new AppError(400, "O cupom não está mais disponível.", "COUPON_INVALID");
    const [usage] = await db.select({ count: sql<number>`count(*)` }).from(couponUsages).where(and(eq(couponUsages.couponId, coupon.id), eq(couponUsages.userId, user.id)));
    if ((usage?.count ?? 0) >= coupon.usesPerCustomer) throw new AppError(400, "Você já utilizou este cupom.", "COUPON_CUSTOMER_LIMIT");
    couponId = coupon.id;
  }

  const raw = await getRawDb();
  const orderNumber = createOrderNumber();
  const addressSnapshot = JSON.stringify(input.address);
  const statements: D1PreparedStatement[] = [];
  statements.push(raw.prepare(
    `INSERT INTO orders (order_number,user_id,customer_name,customer_email,customer_phone,customer_cpf,subtotal_cents,discount_cents,shipping_cents,total_cents,coupon_code,payment_method,payment_status,status,address_snapshot,created_at,updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  ).bind(orderNumber, user.id, input.customer.name, input.customer.email, input.customer.phone, input.customer.cpf, cart.subtotalCents, cart.discountCents, shippingCents, totalCents, cart.coupon?.code ?? null, input.paymentMethod, "PENDING", "PENDING", addressSnapshot, new Date().toISOString(), new Date().toISOString()));

  for (const item of cart.items) {
    statements.push(raw.prepare(
      `INSERT INTO order_items (order_id,product_id,variant_id,product_name,product_slug,sku,color,size,image_url,unit_price_cents,quantity,total_cents)
       VALUES ((SELECT id FROM orders WHERE order_number=?),?,?,?,?,?,?,?,?,?,?,?)`,
    ).bind(orderNumber, item.productId, item.variantId, item.productName, item.productSlug, item.sku, item.color, item.size, item.imageUrl, item.unitPriceCents, item.quantity, item.unitPriceCents * item.quantity));
    statements.push(raw.prepare(
      `INSERT INTO inventory_movements (product_id,variant_id,quantity_before,quantity_changed,quantity_after,type,order_id,note,created_at)
       SELECT product_id,id,stock,?,stock-?,'SALE',(SELECT id FROM orders WHERE order_number=?),?,? FROM product_variants WHERE id=?`,
    ).bind(-item.quantity, item.quantity, orderNumber, `Venda ${orderNumber}`, new Date().toISOString(), item.variantId));
    statements.push(raw.prepare("UPDATE product_variants SET stock=stock-?,updated_at=? WHERE id=?").bind(item.quantity, new Date().toISOString(), item.variantId));
    statements.push(raw.prepare("UPDATE products SET sales_count=sales_count+?,updated_at=? WHERE id=?").bind(item.quantity, new Date().toISOString(), item.productId));
  }
  statements.push(raw.prepare(
    `INSERT INTO payments (order_id,gateway,method,amount_cents,status,idempotency_key,created_at,updated_at)
     VALUES ((SELECT id FROM orders WHERE order_number=?),?,?,?,?,?,?,?)`,
  ).bind(orderNumber, "CONFIGURABLE", input.paymentMethod, totalCents, "PENDING", input.idempotencyKey, new Date().toISOString(), new Date().toISOString()));
  statements.push(raw.prepare(
    `INSERT INTO order_events (order_id,type,message,created_at) VALUES ((SELECT id FROM orders WHERE order_number=?),'ORDER_CREATED','Pedido criado e estoque reservado.',?)`,
  ).bind(orderNumber, new Date().toISOString()));
  if (couponId) {
    statements.push(raw.prepare(
      `INSERT INTO coupon_usages (coupon_id,user_id,order_id,used_at)
       VALUES (
         (SELECT c.id FROM coupons AS c
          WHERE c.id=?
            AND c.active=1
            AND (c.starts_at IS NULL OR datetime(c.starts_at)<=datetime('now'))
            AND (c.ends_at IS NULL OR datetime(c.ends_at)>=datetime('now'))
            AND (c.maximum_uses IS NULL OR c.current_uses<c.maximum_uses)
            AND (SELECT count(*) FROM coupon_usages AS u WHERE u.coupon_id=c.id AND u.user_id=?)<c.uses_per_customer),
         ?,
         (SELECT id FROM orders WHERE order_number=?),
         ?
       )`,
    ).bind(couponId, user.id, user.id, orderNumber, new Date().toISOString()));
    statements.push(raw.prepare(
      "UPDATE coupons SET current_uses=current_uses+1,updated_at=? WHERE id=?",
    ).bind(new Date().toISOString(), couponId));
  }
  statements.push(raw.prepare("UPDATE carts SET status='CONVERTED',updated_at=? WHERE id=?").bind(new Date().toISOString(), context.cartId));

  try {
    await raw.batch(statements);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/coupon_usages\.coupon_id|coupon_usages|not null constraint/i.test(message)) throw new AppError(409, "O cupom deixou de estar disponível. Revise seu carrinho e tente novamente.", "COUPON_CONFLICT");
    if (/constraint|stock|check/i.test(message)) throw new AppError(409, "O estoque mudou durante a compra. Revise seu carrinho e tente novamente.", "STOCK_CONFLICT");
    throw error;
  }

  await db.update(users).set({ name: input.customer.name, phone: input.customer.phone, cpf: input.customer.cpf, updatedAt: sql`CURRENT_TIMESTAMP` }).where(eq(users.id, user.id));
  const [createdOrder] = await db.select().from(orders).where(eq(orders.orderNumber, orderNumber)).limit(1);
  let payment: PaymentIntentResult = { configured: false };
  try {
    payment = await createPaymentIntent({
      orderNumber,
      totalCents,
      method: input.paymentMethod,
      customerName: input.customer.name,
      customerEmail: input.customer.email,
      customerPhone: input.customer.phone,
      customerCpf: input.customer.cpf,
      paymentToken: input.paymentToken,
      idempotencyKey: input.idempotencyKey,
    });
    if (payment.configured) {
      await db.update(payments).set({ gateway: "EXTERNAL", gatewayPaymentId: payment.gatewayPaymentId || null, rawResponse: JSON.stringify(payment.raw ?? {}), updatedAt: sql`CURRENT_TIMESTAMP` }).where(eq(payments.idempotencyKey, input.idempotencyKey));
    }
  } catch (error) {
    await db.update(payments).set({ rawResponse: JSON.stringify({ error: error instanceof Error ? error.message : "provider_error" }), updatedAt: sql`CURRENT_TIMESTAMP` }).where(eq(payments.idempotencyKey, input.idempotencyKey));
  }
  void sendTransactionalEmail(input.customer.email, "ORDER_RECEIVED", { name: input.customer.name, orderNumber, actionUrl: `/pedido/${createdOrder.id}` }).catch(() => false);
  return { order: createdOrder, duplicate: false, payment };
}
