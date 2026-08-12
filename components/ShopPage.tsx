import Link from "next/link";
import { ProductGrid } from "./ProductGrid";
import { ShopFilters } from "./ShopFilters";
import type { ProductListItem } from "@/lib/types";

type Values = { q?: string; categoria?: string; min?: string; max?: string; tamanho?: string; cor?: string; disponibilidade?: string; ordenar?: string };

export function ShopPage({ products, categories, values, page = 1, title = "A COLEÇÃO.", description = "Performance, resistência e design para cada fase da sua evolução." }: {
  products: ProductListItem[];
  categories: Array<{ slug: string; name: string }>;
  values: Values;
  page?: number;
  title?: string;
  description?: string;
}) {
  const queryParams = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => { if (value) queryParams.set(key, value); });

  return (
    <main className="shop-page page-dark">
      <div className="container shop-hero"><div><p className="eyebrow">ONVEX / LOJA</p><h1>{title}</h1><p>{description}</p></div><span>{String(products.length).padStart(2, "0")} PRODUTOS • PÁG. {page}</span></div>
      <div className="container shop-toolbar">
        <details className="mobile-filter"><summary>FILTROS <span>+</span></summary><ShopFilters values={values} categories={categories} /></details>
        <p>{values.q ? <>RESULTADOS PARA <strong>“{values.q}”</strong></> : "EQUIPAMENTOS ONVEX"}</p>
        <form action="/loja"><input type="hidden" name="q" value={values.q ?? ""} /><input type="hidden" name="categoria" value={values.categoria ?? ""} /><label>ORDENAR POR <select name="ordenar" defaultValue={values.ordenar ?? "best-selling"} onChange={undefined}><option value="best-selling">Mais vendidos</option><option value="newest">Mais recentes</option><option value="price-asc">Menor preço</option><option value="price-desc">Maior preço</option></select></label><button type="submit">OK</button></form>
      </div>
      <div className="container shop-layout">
        <aside className="desktop-filters"><ShopFilters values={values} categories={categories} /></aside>
        <section className="shop-results"><ProductGrid products={products} /><div className="pagination">{page>1&&<Link href={`/loja?${queryParams.toString()}&pagina=${page-1}`}>← ANTERIOR</Link>}{products.length>=24&&<Link href={`/loja?${queryParams.toString()}&pagina=${page+1}`}>PRÓXIMA →</Link>}</div></section>
      </div>
    </main>
  );
}
