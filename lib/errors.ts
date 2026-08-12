export class AppError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code = "APP_ERROR",
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function errorResponse(error: unknown): Response {
  if (error instanceof AppError) {
    return Response.json(
      { error: error.message, code: error.code },
      { status: error.status },
    );
  }

  console.error("ONVEX request error", error);
  return Response.json(
    { error: "Não foi possível concluir a operação. Tente novamente.", code: "INTERNAL_ERROR" },
    { status: 500 },
  );
}

export function assertInteger(value: unknown, field: string, minimum = 1): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum) {
    throw new AppError(400, `${field} inválido.`, "VALIDATION_ERROR");
  }
  return parsed;
}

export function cleanText(value: unknown, field: string, maxLength = 250): string {
  if (typeof value !== "string") {
    throw new AppError(400, `${field} inválido.`, "VALIDATION_ERROR");
  }
  const cleaned = value.replace(/[<>]/g, "").trim();
  if (!cleaned || cleaned.length > maxLength) {
    throw new AppError(400, `${field} inválido.`, "VALIDATION_ERROR");
  }
  return cleaned;
}

export function optionalText(value: unknown, maxLength = 250): string | null {
  if (value == null || value === "") return null;
  if (typeof value !== "string") return null;
  return value.replace(/[<>]/g, "").trim().slice(0, maxLength) || null;
}

export function normalizeEmail(value: unknown): string {
  const email = cleanText(value, "E-mail", 200).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new AppError(400, "Informe um e-mail válido.", "VALIDATION_ERROR");
  }
  return email;
}

export function enforceSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  if (origin && origin !== new URL(request.url).origin) {
    throw new AppError(403, "Origem da solicitação inválida.", "CSRF_REJECTED");
  }
  if (fetchSite && !["same-origin", "same-site", "none"].includes(fetchSite)) {
    throw new AppError(403, "Solicitação não autorizada.", "CSRF_REJECTED");
  }
}
