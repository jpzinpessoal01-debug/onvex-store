import { getDb } from "@/db";
import { adminAuditLogs } from "@/db/schema";
import type { AppUser } from "./types";
import { requestIp } from "./rate-limit";

export async function recordAudit(
  admin: AppUser,
  request: Request,
  action: string,
  entityType: string,
  entityId: string | number | null,
  data: unknown = {},
): Promise<void> {
  const db = await getDb();
  await db.insert(adminAuditLogs).values({
    adminUserId: admin.id,
    action,
    entityType,
    entityId: entityId == null ? null : String(entityId),
    ip: requestIp(request),
    data: JSON.stringify(data).slice(0, 20000),
  });
}

