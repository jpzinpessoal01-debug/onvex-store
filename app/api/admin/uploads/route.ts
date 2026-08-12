import { requireAdminApi } from "@/lib/auth";
import { enforceSameOrigin, errorResponse } from "@/lib/errors";
import { getRuntimeEnv } from "@/lib/runtime-env";

type RuntimeEnv = { BUCKET?: R2Bucket };
const scopes = new Set(["products", "banners", "categories"]);

export async function POST(request: Request) {
  try {
    enforceSameOrigin(request);
    await requireAdminApi();
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return Response.json({ error: "Selecione uma imagem." }, { status: 400 });
    if (file.size > 8 * 1024 * 1024) return Response.json({ error: "A imagem deve ter no máximo 8 MB." }, { status: 400 });
    if (!["image/jpeg", "image/png", "image/webp", "image/avif"].includes(file.type)) return Response.json({ error: "Formato de imagem não suportado." }, { status: 400 });
    const requestedScope = String(form.get("scope") ?? "products");
    const scope = scopes.has(requestedScope) ? requestedScope : "products";
    const safe = file.name.toLowerCase().replace(/[^a-z0-9.]+/g, "-").replace(/^-|-$/g, "");
    const key = `${scope}/${crypto.randomUUID()}-${safe}`;
    const runtime = await getRuntimeEnv<RuntimeEnv>();
    if (!runtime.BUCKET) return Response.json({ error: "Armazenamento de imagens ainda não foi configurado neste ambiente." }, { status: 503 });
    await runtime.BUCKET.put(key, await file.arrayBuffer(), {
      httpMetadata: { contentType: file.type, cacheControl: "public, max-age=31536000, immutable" },
    });
    return Response.json({ key, url: `/api/assets/${key}` }, { status: 201 });
  } catch (error) { return errorResponse(error); }
}
