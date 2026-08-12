import { eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { reviews } from "@/db/schema";
import { recordAudit } from "@/lib/audit";
import { requireAdminApi } from "@/lib/auth";
import { assertInteger, enforceSameOrigin, errorResponse } from "@/lib/errors";
export async function PATCH(request:Request){try{enforceSameOrigin(request);const admin=await requireAdminApi();const input=await request.json() as Record<string,unknown>;const id=assertInteger(input.id,"Avaliação");const status=["APPROVED","REJECTED","PENDING"].includes(String(input.status))?String(input.status) as "APPROVED"|"REJECTED"|"PENDING":"PENDING";const db=await getDb();await db.update(reviews).set({status,updatedAt:sql`CURRENT_TIMESTAMP`}).where(eq(reviews.id,id));await recordAudit(admin,request,"REVIEW_MODERATED","Review",id,{status});return Response.json({ok:true});}catch(error){return errorResponse(error);}}

