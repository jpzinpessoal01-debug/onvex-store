import { eq } from "drizzle-orm";
import { getDb, getRawDb } from "@/db";
import { productVariants } from "@/db/schema";
import { recordAudit } from "@/lib/audit";
import { requireAdminApi } from "@/lib/auth";
import { AppError, assertInteger, cleanText, enforceSameOrigin, errorResponse } from "@/lib/errors";

const movementTypes = ["RESTOCK", "RETURN", "ADJUSTMENT", "CANCELATION", "MANUAL"] as const;
export async function POST(request: Request) {
  try {
    enforceSameOrigin(request); const admin = await requireAdminApi(); const input = await request.json() as Record<string, unknown>;
    const variantId = assertInteger(input.variantId, "Variante"); const quantity = Number(input.quantity);
    if (!Number.isInteger(quantity) || quantity === 0) return Response.json({ error: "Informe uma quantidade diferente de zero." }, { status: 400 });
    const type = movementTypes.includes(input.type as typeof movementTypes[number]) ? input.type as typeof movementTypes[number] : "MANUAL";
    if (type === "RESTOCK" && quantity < 1) return Response.json({ error: "Reposição precisa adicionar estoque." }, { status: 400 });
    const note = cleanText(input.note, "Motivo", 300); const db = await getDb();
    const [variant] = await db.select().from(productVariants).where(eq(productVariants.id, variantId)).limit(1);
    if (!variant) return Response.json({ error: "Variante não encontrada." }, { status: 404 });
    const raw = await getRawDb(); const now = new Date().toISOString();
    try {
      await raw.batch([
        raw.prepare("INSERT INTO inventory_movements (product_id,variant_id,quantity_before,quantity_changed,quantity_after,type,admin_user_id,note,created_at) SELECT product_id,id,stock,?,stock+?,?,?, ?,? FROM product_variants WHERE id=?").bind(quantity, quantity, type, admin.id, note, now, variantId),
        raw.prepare("UPDATE product_variants SET stock=stock+?,updated_at=? WHERE id=?").bind(quantity, now, variantId),
      ]);
    } catch (error) {
      if (/check constraint|stock/i.test(error instanceof Error ? error.message : "")) throw new AppError(409, "A movimentação deixaria o estoque negativo.", "NEGATIVE_STOCK");
      throw error;
    }
    const [updated] = await db.select().from(productVariants).where(eq(productVariants.id, variantId)).limit(1);
    const after = updated?.stock ?? variant.stock + quantity;
    await recordAudit(admin, request, "INVENTORY_CHANGED", "ProductVariant", variantId, { before: after - quantity, change: quantity, after, type, note });
    return Response.json({ ok: true, before: after - quantity, after });
  } catch (error) { return errorResponse(error); }
}
