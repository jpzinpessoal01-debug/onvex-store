import { addCartItem, buildCartView, removeCartItem, resolveCart, updateCartItem } from "@/lib/cart";
import { assertInteger, enforceSameOrigin, errorResponse } from "@/lib/errors";

export async function GET() {
  try {
    const context = await resolveCart(false);
    return Response.json({ cart: await buildCartView(context) }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    enforceSameOrigin(request);
    const context = await resolveCart(true);
    if (!context) throw new Error("Cart creation failed");
    const payload = (await request.json()) as Record<string, unknown>;
    await addCartItem(context, {
      variantId: payload.variantId == null ? undefined : assertInteger(payload.variantId, "Variação"),
      productId: payload.productId == null ? undefined : assertInteger(payload.productId, "Produto"),
      quantity: assertInteger(payload.quantity ?? 1, "Quantidade"),
    });
    return Response.json({ cart: await buildCartView(context) }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    enforceSameOrigin(request);
    const context = await resolveCart(false);
    if (!context) return Response.json({ error: "Carrinho vazio." }, { status: 404 });
    const payload = (await request.json()) as Record<string, unknown>;
    await updateCartItem(
      context,
      assertInteger(payload.itemId, "Item"),
      assertInteger(payload.quantity, "Quantidade"),
      payload.variantId == null ? undefined : assertInteger(payload.variantId, "Variação"),
    );
    return Response.json({ cart: await buildCartView(context) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    enforceSameOrigin(request);
    const context = await resolveCart(false);
    if (!context) return Response.json({ cart: await buildCartView(null) });
    const payload = (await request.json()) as Record<string, unknown>;
    await removeCartItem(context, assertInteger(payload.itemId, "Item"));
    return Response.json({ cart: await buildCartView(context) });
  } catch (error) {
    return errorResponse(error);
  }
}
