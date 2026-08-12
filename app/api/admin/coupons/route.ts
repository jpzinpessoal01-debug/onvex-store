import { eq, sql } from "drizzle-orm";
import { getDb, getRawDb } from "@/db";
import { coupons } from "@/db/schema";
import { recordAudit } from "@/lib/audit";
import { requireAdminApi } from "@/lib/auth";
import { AppError, assertInteger, cleanText, enforceSameOrigin, errorResponse, optionalText } from "@/lib/errors";

function parseIds(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(Number).filter((id) => Number.isInteger(id) && id > 0))].slice(0, 200);
}

function parseDate(value: unknown, field: string): string | null {
  const raw = optionalText(value, 50);
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) throw new AppError(400, `${field} inválida.`, "VALIDATION_ERROR");
  return date.toISOString();
}

export async function POST(request: Request) {
  try {
    enforceSameOrigin(request);
    const admin = await requireAdminApi();
    const input = await request.json() as Record<string, unknown>;
    const code = cleanText(input.code, "Código", 40).toUpperCase();
    const type = input.type === "FIXED" ? "FIXED" : "PERCENTAGE";
    const value = assertInteger(input.value, "Valor", 1);
    if (type === "PERCENTAGE" && value > 100) return Response.json({ error: "A porcentagem deve estar entre 1 e 100." }, { status: 400 });
    const minimumCents = assertInteger(input.minimumCents ?? 0, "Valor mínimo", 0);
    const maximumUses = input.maximumUses == null || input.maximumUses === "" ? null : assertInteger(input.maximumUses, "Limite de usos", 1);
    const usesPerCustomer = assertInteger(input.usesPerCustomer ?? 1, "Uso por cliente", 1);
    const startsAt = parseDate(input.startsAt, "Data inicial");
    const endsAt = parseDate(input.endsAt, "Data final");
    if (startsAt && endsAt && startsAt >= endsAt) return Response.json({ error: "A data final deve ser posterior à inicial." }, { status: 400 });
    const categoryIds = parseIds(input.categoryIds);
    const productIds = parseIds(input.productIds);
    const now = new Date().toISOString();
    const raw = await getRawDb();
    const statements: D1PreparedStatement[] = [raw.prepare("INSERT INTO coupons (code,type,value,minimum_cents,starts_at,ends_at,maximum_uses,uses_per_customer,current_uses,active,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,0,?,?,?)").bind(code, type, value, minimumCents, startsAt, endsAt, maximumUses, usesPerCustomer, input.active === false ? 0 : 1, now, now)];
    categoryIds.forEach((categoryId) => statements.push(raw.prepare("INSERT INTO coupon_categories (coupon_id,category_id) VALUES ((SELECT id FROM coupons WHERE code=?),?)").bind(code, categoryId)));
    productIds.forEach((productId) => statements.push(raw.prepare("INSERT INTO coupon_products (coupon_id,product_id) VALUES ((SELECT id FROM coupons WHERE code=?),?)").bind(code, productId)));
    await raw.batch(statements);
    const db = await getDb();
    const [created] = await db.select().from(coupons).where(eq(coupons.code, code)).limit(1);
    await recordAudit(admin, request, "COUPON_CREATED", "Coupon", created.id, { code, categoryIds, productIds });
    return Response.json({ coupon: created }, { status: 201 });
  } catch (error) { return errorResponse(error); }
}
export async function PATCH(request: Request) { try { enforceSameOrigin(request); const admin=await requireAdminApi(); const input=await request.json() as Record<string,unknown>; const id=assertInteger(input.id,"Cupom"); const db=await getDb(); const [current]=await db.select().from(coupons).where(eq(coupons.id,id)).limit(1); if(!current)return Response.json({error:"Cupom não encontrado."},{status:404}); const maximumUses=input.maximumUses===null||input.maximumUses===""?null:input.maximumUses==null?undefined:assertInteger(input.maximumUses,"Limite de usos",1); if(maximumUses!=null&&maximumUses<current.currentUses)return Response.json({error:"O limite não pode ser menor que os usos já registrados."},{status:400}); await db.update(coupons).set({ value:input.value==null?undefined:assertInteger(input.value,"Valor",1), minimumCents:input.minimumCents==null?undefined:assertInteger(input.minimumCents,"Valor mínimo",0), startsAt:input.startsAt==null?undefined:parseDate(input.startsAt,"Data inicial"), endsAt:input.endsAt==null?undefined:parseDate(input.endsAt,"Data final"), maximumUses, usesPerCustomer:input.usesPerCustomer==null?undefined:assertInteger(input.usesPerCustomer,"Uso por cliente",1), active:input.active==null?undefined:input.active===true, updatedAt:sql`CURRENT_TIMESTAMP` }).where(eq(coupons.id,id)); if(Array.isArray(input.categoryIds)||Array.isArray(input.productIds)){const raw=await getRawDb();const statements:D1PreparedStatement[]=[];if(Array.isArray(input.categoryIds)){statements.push(raw.prepare("DELETE FROM coupon_categories WHERE coupon_id=?").bind(id));parseIds(input.categoryIds).forEach(categoryId=>statements.push(raw.prepare("INSERT INTO coupon_categories (coupon_id,category_id) VALUES (?,?)").bind(id,categoryId)));}if(Array.isArray(input.productIds)){statements.push(raw.prepare("DELETE FROM coupon_products WHERE coupon_id=?").bind(id));parseIds(input.productIds).forEach(productId=>statements.push(raw.prepare("INSERT INTO coupon_products (coupon_id,product_id) VALUES (?,?)").bind(id,productId)));}if(statements.length)await raw.batch(statements);} await recordAudit(admin,request,"COUPON_UPDATED","Coupon",id); return Response.json({ok:true}); } catch(error){return errorResponse(error);} }
export async function DELETE(request: Request) { try { enforceSameOrigin(request); const admin=await requireAdminApi(); const input=await request.json() as Record<string,unknown>; const id=assertInteger(input.id,"Cupom"); const db=await getDb(); await db.update(coupons).set({active:false,updatedAt:sql`CURRENT_TIMESTAMP`}).where(eq(coupons.id,id)); await recordAudit(admin,request,"COUPON_DISABLED","Coupon",id); return Response.json({ok:true}); } catch(error){return errorResponse(error);} }
