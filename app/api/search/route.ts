import { listProducts } from "@/lib/store";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length < 2) return Response.json({ products: [] });
  const productRows = await listProducts({ query, limit: 6 });
  return Response.json({ products: productRows }, { headers: { "cache-control": "public, max-age=30" } });
}

