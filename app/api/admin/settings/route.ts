import { getDb } from "@/db";
import { storeSettings } from "@/db/schema";
import { recordAudit } from "@/lib/audit";
import { requireAdminApi } from "@/lib/auth";
import { AppError, enforceSameOrigin, errorResponse } from "@/lib/errors";

const allowed = new Set(["store_name", "hero_title", "hero_subtitle", "footer_text", "support_email", "support_phone", "instagram", "tiktok", "whatsapp", "shipping_flat_cents", "express_shipping_cents", "free_shipping_from_cents", "cpf_required", "size_guide"]);
const moneySettings = new Set(["shipping_flat_cents", "express_shipping_cents", "free_shipping_from_cents"]);
const urlSettings = new Set(["instagram", "tiktok", "whatsapp"]);

function normalizeSetting(key: string, value: string): string {
  if (moneySettings.has(key)) {
    if (!/^\d{1,9}$/.test(value)) throw new AppError(400, "Informe os valores monetários em centavos.", "VALIDATION_ERROR");
    return String(Number(value));
  }
  if (key === "cpf_required") {
    if (!["true", "false"].includes(value)) throw new AppError(400, "Configuração de CPF inválida.", "VALIDATION_ERROR");
    return value;
  }
  if (key === "size_guide") {
    let parsed: unknown;
    try { parsed = JSON.parse(value); } catch { throw new AppError(400, "O guia de tamanhos precisa ser um JSON válido.", "VALIDATION_ERROR"); }
    if (!Array.isArray(parsed) || parsed.length > 30 || parsed.some((row) => { const item = row as Record<string, unknown> | null; return !item || typeof item.size !== "string" || typeof item.height !== "string" || typeof item.weight !== "string"; })) {
      throw new AppError(400, "O guia deve conter uma lista com size, height e weight.", "VALIDATION_ERROR");
    }
    return JSON.stringify(parsed.map((row) => { const item = row as Record<string, unknown>; return { size: String(item.size).slice(0, 20), height: String(item.height).slice(0, 50), weight: String(item.weight).slice(0, 50) }; }));
  }
  const cleaned = value.replace(/[<>]/g, "").trim().slice(0, key === "footer_text" ? 800 : 500);
  if (urlSettings.has(key) && cleaned) {
    let url: URL;
    try { url = new URL(cleaned); } catch { throw new AppError(400, `URL de ${key} inválida.`, "VALIDATION_ERROR"); }
    if (url.protocol !== "https:") throw new AppError(400, `Use HTTPS em ${key}.`, "VALIDATION_ERROR");
  }
  if (key === "support_email" && cleaned && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned)) throw new AppError(400, "E-mail de suporte inválido.", "VALIDATION_ERROR");
  return cleaned;
}

export async function PATCH(request: Request) {
  try {
    enforceSameOrigin(request);
    const admin = await requireAdminApi();
    const input = await request.json() as Record<string, unknown>;
    const db = await getDb();
    const changed: string[] = [];
    for (const [key, rawValue] of Object.entries(input)) {
      if (!allowed.has(key) || typeof rawValue !== "string" || rawValue.length > 10000) continue;
      const value = normalizeSetting(key, rawValue);
      await db.insert(storeSettings).values({ key, value, updatedBy: admin.id }).onConflictDoUpdate({ target: storeSettings.key, set: { value, updatedBy: admin.id, updatedAt: new Date().toISOString() } });
      changed.push(key);
    }
    await recordAudit(admin, request, "SETTINGS_UPDATED", "StoreSettings", null, { keys: changed });
    return Response.json({ ok: true, changed });
  } catch (error) { return errorResponse(error); }
}
