import { eq } from "drizzle-orm";
import { getDb, getRawDb } from "@/db";
import { coupons, orderItems, orders } from "@/db/schema";
import { recordAudit } from "@/lib/audit";
import { requireAdminApi } from "@/lib/auth";
import { assertInteger, enforceSameOrigin, errorResponse, optionalText } from "@/lib/errors";
import { sendTransactionalEmail } from "@/lib/email";
import { getOrderDetail } from "@/lib/orders";

const allowedStatuses = ["PROCESSING", "SHIPPED", "DELIVERED", "CANCELED"] as const;
export async function GET(request: Request) {
  try {
    const admin = await requireAdminApi();
    const id = assertInteger(new URL(request.url).searchParams.get("id"), "Pedido");
    return Response.json(await getOrderDetail(id, admin), { headers: { "cache-control": "no-store" } });
  } catch (error) { return errorResponse(error); }
}

export async function PATCH(request: Request) {
  try {
    enforceSameOrigin(request); const admin = await requireAdminApi(); const input = await request.json() as Record<string, unknown>;
    const id = assertInteger(input.id, "Pedido"); const status = String(input.status ?? "").toUpperCase();
    if (!allowedStatuses.includes(status as typeof allowedStatuses[number])) return Response.json({ error: "Status inválido." }, { status: 400 });
    const db = await getDb(); const [order] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
    if (!order) return Response.json({ error: "Pedido não encontrado." }, { status: 404 });
    if (["CANCELED", "REFUNDED"].includes(order.status)) return Response.json({ error: "Este pedido não pode mais ser alterado." }, { status: 409 });
    if (status !== "CANCELED" && order.paymentStatus !== "PAID") return Response.json({ error: "Confirme o pagamento antes de processar o pedido." }, { status: 409 });
    const transitions: Record<string, string[]> = { PENDING: ["CANCELED"], PAID: ["PROCESSING", "CANCELED"], PROCESSING: ["SHIPPED", "CANCELED"], SHIPPED: ["DELIVERED", "CANCELED"], DELIVERED: [] };
    if (!(transitions[order.status] ?? []).includes(status)) return Response.json({ error: `Transição de ${order.status} para ${status} não permitida.` }, { status: 409 });
    const raw = await getRawDb(); const now = new Date().toISOString(); const statements: D1PreparedStatement[] = [];
    if (status === "CANCELED") {
      const items = await db.select().from(orderItems).where(eq(orderItems.orderId, id));
      for (const item of items) if (item.variantId && item.productId) {
        statements.push(raw.prepare("INSERT INTO inventory_movements (product_id,variant_id,quantity_before,quantity_changed,quantity_after,type,admin_user_id,order_id,note,created_at) SELECT product_id,id,stock,?,stock+?,'CANCELATION',?,?,?,? FROM product_variants WHERE id=?").bind(item.quantity, item.quantity, admin.id, id, `Pedido ${order.orderNumber} cancelado`, now, item.variantId));
        statements.push(raw.prepare("UPDATE product_variants SET stock=stock+?,updated_at=? WHERE id=?").bind(item.quantity, now, item.variantId));
        statements.push(raw.prepare("UPDATE products SET sales_count=max(sales_count-?,0),updated_at=? WHERE id=?").bind(item.quantity, now, item.productId));
      }
      if (order.couponCode) {
        const [coupon] = await db.select().from(coupons).where(eq(coupons.code, order.couponCode)).limit(1);
        if (coupon) {
          statements.push(raw.prepare("DELETE FROM coupon_usages WHERE order_id=?").bind(id));
          statements.push(raw.prepare("UPDATE coupons SET current_uses=max(current_uses-1,0),updated_at=? WHERE id=?").bind(now, coupon.id));
        }
      }
    }
    statements.push(raw.prepare("UPDATE orders SET status=?,carrier=?,tracking_code=?,tracking_url=?,canceled_at=CASE WHEN ?='CANCELED' THEN ? ELSE canceled_at END,updated_at=? WHERE id=?").bind(status, optionalText(input.carrier, 100), optionalText(input.trackingCode, 100), optionalText(input.trackingUrl, 500), status, now, now, id));
    statements.push(raw.prepare("INSERT INTO order_events (order_id,type,message,admin_user_id,created_at) VALUES (?,?,?,?,?)").bind(id, `STATUS_${status}`, `Status atualizado para ${status}.`, admin.id, now));
    await raw.batch(statements); await recordAudit(admin, request, "ORDER_STATUS_CHANGED", "Order", id, { before: order.status, after: status, tracking: input.trackingCode });
    if (status === "SHIPPED" || status === "DELIVERED") void sendTransactionalEmail(order.customerEmail, status === "SHIPPED" ? "ORDER_SHIPPED" : "ORDER_DELIVERED", { name: order.customerName, orderNumber: order.orderNumber, actionUrl: `/pedido/${order.id}` }).catch(() => false);
    return Response.json({ ok: true });
  } catch (error) { return errorResponse(error); }
}
