import { eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { recordAudit } from "@/lib/audit";
import { requireAdminApi } from "@/lib/auth";
import { assertInteger, enforceSameOrigin, errorResponse } from "@/lib/errors";
export async function PATCH(request:Request){try{enforceSameOrigin(request);const admin=await requireAdminApi(true);const input=await request.json() as Record<string,unknown>;const id=assertInteger(input.id,"Usuário");const role=["CUSTOMER","ADMIN","SUPER_ADMIN"].includes(String(input.role))?String(input.role) as "CUSTOMER"|"ADMIN"|"SUPER_ADMIN":"CUSTOMER";if(id===admin.id&&role!=="SUPER_ADMIN")return Response.json({error:"Você não pode remover seu próprio acesso de super administrador."},{status:409});const db=await getDb();await db.update(users).set({role,updatedAt:sql`CURRENT_TIMESTAMP`}).where(eq(users.id,id));await recordAudit(admin,request,"ADMIN_ROLE_CHANGED","User",id,{role});return Response.json({ok:true});}catch(error){return errorResponse(error);}}

