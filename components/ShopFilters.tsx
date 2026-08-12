import Link from "next/link";

type FilterValues = {
  q?: string;
  categoria?: string;
  min?: string;
  max?: string;
  tamanho?: string;
  cor?: string;
  disponibilidade?: string;
  ordenar?: string;
};

export function ShopFilters({ values, categories }: { values: FilterValues; categories: Array<{ slug: string; name: string }> }) {
  return (
    <form className="shop-filters" action="/loja">
      <div className="filter-search"><label htmlFor="shop-search">BUSCAR</label><input id="shop-search" name="q" defaultValue={values.q} placeholder="Produto, categoria ou SKU" /></div>
      <details open><summary>CATEGORIA <span>+</span></summary><div className="filter-options"><label><input type="radio" name="categoria" value="" defaultChecked={!values.categoria} />Todos</label>{categories.map((category) => <label key={category.slug}><input type="radio" name="categoria" value={category.slug} defaultChecked={values.categoria === category.slug} />{category.name}</label>)}</div></details>
      <details open><summary>PREÇO <span>+</span></summary><div className="price-range"><label>DE<input name="min" inputMode="numeric" defaultValue={values.min} placeholder="R$ 0" /></label><label>ATÉ<input name="max" inputMode="numeric" defaultValue={values.max} placeholder="R$ 1.000" /></label></div></details>
      <details><summary>TAMANHO <span>+</span></summary><div className="size-filter">{["A0","A1","A2","A3","A4","P","M","G","GG"].map((size) => <label key={size}><input type="radio" name="tamanho" value={size} defaultChecked={values.tamanho === size} /><span>{size}</span></label>)}</div></details>
      <details><summary>COR <span>+</span></summary><div className="filter-options">{["Preto","Branco","Azul","Grafite"].map((color) => <label key={color}><input type="radio" name="cor" value={color} defaultChecked={values.cor === color} />{color}</label>)}</div></details>
      <details><summary>DISPONIBILIDADE <span>+</span></summary><div className="filter-options"><label><input type="radio" name="disponibilidade" value="in-stock" defaultChecked={values.disponibilidade === "in-stock"} />Em estoque</label><label><input type="radio" name="disponibilidade" value="out-of-stock" defaultChecked={values.disponibilidade === "out-of-stock"} />Esgotados</label></div></details>
      <input type="hidden" name="ordenar" value={values.ordenar ?? "best-selling"} />
      <button className="button button--silver" type="submit">APLICAR FILTROS</button>
      <Link href="/loja">LIMPAR FILTROS</Link>
    </form>
  );
}

