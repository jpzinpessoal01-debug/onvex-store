import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site-url";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = getSiteUrl();
  return ["", "/loja", "/categoria/kimonos", "/categoria/rash-guards", "/categoria/faixas", "/categoria/shorts", "/sobre", "/contato", "/trocas-e-devolucoes", "/privacidade", "/termos"].map((path) => ({
    url: `${base}${path}`,
    lastModified: new Date(),
    changeFrequency: path === "" ? "daily" : "weekly",
    priority: path === "" ? 1 : .7,
  }));
}
