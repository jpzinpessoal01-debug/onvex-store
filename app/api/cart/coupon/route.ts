import { applyCoupon, buildCartView, resolveCart } from "@/lib/cart";
import { cleanText, enforceSameOrigin, errorResponse } from "@/lib/errors";
import { getDb } from "@/db";
import { carts } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

export async function POST(request: Request) {
  try {
    enforceSameOrigin(request);
    const context = await resolveCart(false);
    if (!context) return Response.json({ error: "Seu carrinho está vazio." }, { status: 400 });
    const payload = (await request.json()) as Record<string, unknown>;
    const cart = await applyCoupon(context, cleanText(payload.code, "Cupom", 40));
    return Response.json({ cart });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    enforceSameOrigin(request);
    const context = await resolveCart(false);
    if (!context) return Response.json({ cart: await buildCartView(null) });
    const db = await getDb();
    await db.update(carts).set({ couponId: null, updatedAt: sql`CURRENT_TIMESTAMP` }).where(eq(carts.id, context.cartId));
    return Response.json({ cart: await buildCartView(context) });
  } catch (error) {
    return errorResponse(error);
  }
}
