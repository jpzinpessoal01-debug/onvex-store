import { eq } from "drizzle-orm";
import { getDb, getRawDb } from "@/db";
import { orders, payments, webhookEvents } from "@/db/schema";
import { AppError, errorResponse } from "@/lib/errors";
import { sendTransactionalEmail } from "@/lib/email";
import { getRuntimeEnv } from "@/lib/runtime-env";

type RuntimeEnv = { PAYMENT_WEBHOOK_SECRET?: string; PAYMENT_PROVIDER?: string };

function readAmountCents(event: Record<string, unknown>, data: Record<string, unknown>): number | null {
  const cents = data.amount_cents ?? event.amount_cents;
  if (cents != null) {
    const parsed = Number(cents);
    return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
  }
  const majorUnits = data.transaction_amount ?? data.amount ?? event.amount;
  if (majorUnits == null) return null;
  const parsed = Number(majorUnits);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) : null;
}

function normalizePaymentStatus(status: string, eventName = ""): string {
  const normalized = status.toUpperCase();
  if (["PAID", "APPROVED", "COMPLETED", "SUCCEEDED"].includes(normalized) || eventName === "PAYMENT.PAID" || eventName === "PAYMENT_LINK.PAID") return "PAID";
  if (["REFUNDED", "REVERSED", "CHARGED_BACK", "CHARGEBACK"].includes(normalized) || eventName === "PAYMENT.REFUNDED" || eventName === "REFUND.COMPLETED") return "REFUNDED";
  if (["REJECTED", "FAILED", "CANCELED", "CANCELLED", "EXPIRED"].includes(normalized)) return "FAILED";
  return normalized.slice(0, 50) || "PENDING";
}

function bytesToHex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let result = 0;
  for (let index = 0; index < left.length; index += 1) result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return result === 0;
}

async function validateSignature(body: string, signature: string | null): Promise<void> {
  const runtime = await getRuntimeEnv<RuntimeEnv>();
  const secret = runtime.PAYMENT_WEBHOOK_SECRET;
  if (!secret) throw new AppError(503, "Webhook de pagamento não configurado.", "WEBHOOK_NOT_CONFIGURED");
  if (!signature) throw new AppError(401, "Assinatura ausente.", "INVALID_WEBHOOK_SIGNATURE");
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const expected = bytesToHex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body)));
  const normalized = signature.replace(/^sha256=/, "").trim().toLowerCase();
  if (!timingSafeEqual(expected, normalized)) throw new AppError(401, "Assinatura inválida.", "INVALID_WEBHOOK_SIGNATURE");
}

export async function POST(request: Request) {
  try {
    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > 64 * 1024) throw new AppError(413, "Evento muito grande.", "WEBHOOK_TOO_LARGE");
    const rawBody = await request.text();
    if (rawBody.length > 64 * 1024) throw new AppError(413, "Evento muito grande.", "WEBHOOK_TOO_LARGE");
    await validateSignature(
      rawBody,
      request.headers.get("x-goatpay-signature")
        ?? request.headers.get("x-onvex-signature")
        ?? request.headers.get("x-signature"),
    );
    let event: Record<string, unknown>;
    try { event = JSON.parse(rawBody) as Record<string, unknown>; }
    catch { throw new AppError(400, "Evento inválido.", "INVALID_WEBHOOK"); }
    const eventName = String(event.event ?? request.headers.get("x-goatpay-event") ?? "").toUpperCase();
    const eventId = String(event.id ?? event.event_id ?? request.headers.get("x-goatpay-delivery") ?? "").slice(0, 200);
    const data = (event.data ?? event.payment ?? {}) as Record<string, unknown>;
    const gatewayPaymentId = String(data.id ?? event.payment_id ?? "").slice(0, 200);
    const orderNumber = String(data.externalReference ?? data.external_reference ?? event.order_number ?? "").slice(0, 100);
    const rawStatus = String(data.status ?? event.status ?? "").toUpperCase();
    const paymentStatus = normalizePaymentStatus(rawStatus, eventName);
    if (!eventId || !orderNumber) throw new AppError(400, "Evento inválido.", "INVALID_WEBHOOK");

    const db = await getDb();
    const [seen] = await db.select().from(webhookEvents).where(eq(webhookEvents.eventId, eventId)).limit(1);
    if (seen) return Response.json({ ok: true, duplicate: true });
    const [order] = await db.select().from(orders).where(eq(orders.orderNumber, orderNumber)).limit(1);
    if (!order) throw new AppError(404, "Pedido não encontrado.", "ORDER_NOT_FOUND");
    const [payment] = await db.select().from(payments).where(eq(payments.orderId, order.id)).limit(1);
    if (!payment) throw new AppError(404, "Pagamento não encontrado.", "PAYMENT_NOT_FOUND");
    const eventAmountCents = readAmountCents(event, data);
    if (eventAmountCents != null && eventAmountCents !== payment.amountCents) {
      throw new AppError(409, "Valor do pagamento não corresponde ao pedido.", "PAYMENT_AMOUNT_MISMATCH");
    }
    const currency = String(data.currency ?? event.currency ?? "BRL").toUpperCase();
    if (currency !== "BRL") throw new AppError(409, "Moeda do pagamento inválida.", "PAYMENT_CURRENCY_MISMATCH");
    if (payment.gatewayPaymentId && gatewayPaymentId && payment.gatewayPaymentId !== gatewayPaymentId) {
      throw new AppError(409, "Identificador do pagamento não corresponde ao pedido.", "PAYMENT_ID_MISMATCH");
    }

    const bodyHash = bytesToHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(rawBody)));
    const raw = await getRawDb();
    const now = new Date().toISOString();
    const runtime = await getRuntimeEnv<RuntimeEnv>();
    const provider = runtime.PAYMENT_PROVIDER?.slice(0, 80) || "EXTERNAL";
    const statements: D1PreparedStatement[] = [
      raw.prepare("INSERT INTO webhook_events (event_id,provider,payload_hash,processed_at) VALUES (?,?,?,?)").bind(eventId, provider, bodyHash, now),
      raw.prepare("UPDATE payments SET gateway_payment_id=coalesce(gateway_payment_id,?),status=?,raw_response=?,paid_at=CASE WHEN ?='PAID' THEN coalesce(paid_at,?) ELSE paid_at END,updated_at=? WHERE order_id=?").bind(gatewayPaymentId || null, paymentStatus, rawBody.slice(0, 20000), paymentStatus, now, now, order.id),
      raw.prepare("INSERT INTO admin_audit_logs (action,entity_type,entity_id,data,created_at) VALUES ('PAYMENT_WEBHOOK','Order',?,?,?)").bind(String(order.id), JSON.stringify({ eventId, provider, paymentStatus, gatewayPaymentId: gatewayPaymentId || null }), now),
    ];
    if (paymentStatus === "PAID") {
      statements.push(raw.prepare("UPDATE orders SET payment_status='PAID',status=CASE WHEN status='PENDING' THEN 'PAID' ELSE status END,paid_at=coalesce(paid_at,?),updated_at=? WHERE id=? AND payment_status!='PAID'").bind(now, now, order.id));
      statements.push(raw.prepare("INSERT INTO order_events (order_id,type,message,created_at) SELECT ?,'PAYMENT_APPROVED','Pagamento confirmado pelo gateway.',? WHERE NOT EXISTS (SELECT 1 FROM order_events WHERE order_id=? AND type='PAYMENT_APPROVED')").bind(order.id, now, order.id));
    } else if (paymentStatus === "REFUNDED") {
      statements.push(raw.prepare("UPDATE orders SET payment_status='REFUNDED',status='REFUNDED',updated_at=? WHERE id=?").bind(now, order.id));
    } else if (paymentStatus === "FAILED") {
      statements.push(raw.prepare("UPDATE orders SET payment_status='FAILED',updated_at=? WHERE id=? AND payment_status='PENDING'").bind(now, order.id));
    }
    try { await raw.batch(statements); }
    catch (error) {
      if (/webhook_events|unique constraint/i.test(error instanceof Error ? error.message : "")) {
        return Response.json({ ok: true, duplicate: true });
      }
      throw error;
    }
    if (paymentStatus === "PAID" && order.paymentStatus !== "PAID") {
      void sendTransactionalEmail(order.customerEmail, "PAYMENT_APPROVED", { name: order.customerName, orderNumber: order.orderNumber, actionUrl: `/pedido/${order.id}` }).catch(() => false);
    }
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
