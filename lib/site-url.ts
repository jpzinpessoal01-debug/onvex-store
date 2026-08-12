export function getSiteUrl(): string {
  const candidate = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.STORE_BASE_URL ?? "https://onvex-store.site";
  try {
    const url = new URL(candidate);
    return url.protocol === "https:" || url.hostname === "localhost" ? url.origin : "https://onvex-store.site";
  } catch { return "https://onvex-store.site"; }
}
