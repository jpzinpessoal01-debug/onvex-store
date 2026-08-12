import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { favorites } from "@/db/schema";
import { requireUserApi } from "@/lib/auth";
import { assertInteger, enforceSameOrigin, errorResponse } from "@/lib/errors";
import { listProducts } from "@/lib/store";

export async function GET() {
  try {
    const user = await requireUserApi();
    const db = await getDb();
    const favoriteRows = await db.select({ productId: favorites.productId }).from(favorites).where(eq(favorites.userId, user.id));
    const ids = new Set(favoriteRows.map((row) => row.productId));
    const productRows = (await listProducts({ limit: 60 })).filter((product) => ids.has(product.id));
    return Response.json({ products: productRows });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    enforceSameOrigin(request);
    const user = await requireUserApi();
    const payload = (await request.json()) as Record<string, unknown>;
    const productId = assertInteger(payload.productId, "Produto");
    const db = await getDb();
    await db.insert(favorites).values({ userId: user.id, productId }).onConflictDoNothing();
    return Response.json({ ok: true }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    enforceSameOrigin(request);
    const user = await requireUserApi();
    const payload = (await request.json()) as Record<string, unknown>;
    const productId = assertInteger(payload.productId, "Produto");
    const db = await getDb();
    await db.delete(favorites).where(and(eq(favorites.userId, user.id), eq(favorites.productId, productId)));
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
