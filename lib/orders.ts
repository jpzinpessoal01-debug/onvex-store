import { and, asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { orderEvents, orderItems, orders, payments } from "@/db/schema";
import type { AppUser } from "./types";
import { AppError } from "./errors";

export async function getOrderDetail(orderId: number, viewer: AppUser) {
  const db = await getDb();
  const admin = viewer.role !== "CUSTOMER";
  const [order] = await db.select().from(orders).where(admin ? eq(orders.id, orderId) : and(eq(orders.id, orderId), eq(orders.userId, viewer.id))).limit(1);
  if (!order) throw new AppError(404, "Pedido não encontrado.", "ORDER_NOT_FOUND");
  const [items, events, paymentRows] = await Promise.all([
    db.select().from(orderItems).where(eq(orderItems.orderId, order.id)),
    db.select().from(orderEvents).where(eq(orderEvents.orderId, order.id)).orderBy(asc(orderEvents.createdAt)),
    db.select({ gateway: payments.gateway, method: payments.method, status: payments.status, gatewayPaymentId: payments.gatewayPaymentId, rawResponse: payments.rawResponse }).from(payments).where(eq(payments.orderId, order.id)),
  ]);
  let address: Record<string, string> = {};
  try { address = JSON.parse(order.addressSnapshot) as Record<string, string>; } catch { address = {}; }
  const paymentRow = paymentRows[0];
  let checkoutUrl: string | null = null;
  let qrCode: string | null = null;
  if (paymentRow?.rawResponse) {
    try {
      const raw = JSON.parse(paymentRow.rawResponse) as Record<string, unknown>;
      const transactionData = (raw.point_of_interaction as Record<string, unknown> | undefined)?.transaction_data as Record<string, unknown> | undefined;
      const candidateUrl = raw.checkout_url ?? raw.init_point;
      if (typeof candidateUrl === "string" && candidateUrl.startsWith("https://")) checkoutUrl = candidateUrl.slice(0, 2000);
      const candidateQr = raw.qr_code ?? transactionData?.qr_code;
      if (typeof candidateQr === "string") qrCode = candidateQr.slice(0, 10000);
    } catch { /* provider payload stays private when it is not valid JSON */ }
  }
  const payment = paymentRow ? { gateway: paymentRow.gateway, method: paymentRow.method, status: paymentRow.status, gatewayPaymentId: paymentRow.gatewayPaymentId, checkoutUrl, qrCode } : null;
  return { order, items, events, payment, address };
}
