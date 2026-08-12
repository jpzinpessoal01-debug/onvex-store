import type { ProductListItem } from "@/lib/types";
import { ProductCard } from "./ProductCard";

export function ProductGrid({ products }: { products: ProductListItem[] }) {
  if (!products.length) {
    return <div className="empty-state"><span>ONVEX</span><h3>Nenhum produto encontrado</h3><p>Ajuste os filtros ou tente uma busca diferente.</p></div>;
  }
  return <div className="product-grid">{products.map((product) => <ProductCard product={product} key={product.id} />)}</div>;
}
