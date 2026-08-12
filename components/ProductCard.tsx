"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { formatCurrency } from "@/lib/format";
import type { ProductListItem } from "@/lib/types";
import { HeartIcon } from "./icons";
import { useToast } from "./ToastProvider";

export function ProductCard({ product }: { product: ProductListItem }) {
  const [loading, setLoading] = useState(false);
  const [favorite, setFavorite] = useState(false);
  const { showToast } = useToast();
  const price = product.salePriceCents ?? product.priceCents;
  const soldOut = product.stock <= 0;
  const lowStock = product.stock > 0 && product.stock <= product.minimumStock;

  const addToCart = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/cart", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ productId: product.id, quantity: 1 }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Não foi possível adicionar o produto.");
      showToast("Produto adicionado ao carrinho.");
      window.dispatchEvent(new Event("onvex:cart-updated"));
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Não foi possível adicionar o produto.", "error");
    } finally {
      setLoading(false);
    }
  };

  const toggleFavorite = async () => {
    try {
      const response = await fetch("/api/favorites", {
        method: favorite ? "DELETE" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ productId: product.id }),
      });
      if (response.status === 401) {
        window.location.href = `/login?returnTo=${encodeURIComponent(`/produto/${product.slug}`)}`;
        return;
      }
      if (!response.ok) throw new Error();
      setFavorite((value) => !value);
      showToast(favorite ? "Produto removido dos favoritos." : "Produto salvo nos favoritos.");
    } catch {
      showToast("Não foi possível atualizar seus favoritos.", "error");
    }
  };

  return (
    <article className="product-card">
      <div className="product-card__media">
        <Link href={`/produto/${product.slug}`} aria-label={`Ver ${product.name}`}>
          {product.imageUrl ? (
            <Image src={product.imageUrl} alt={product.name} fill sizes="(max-width: 640px) 50vw, (max-width: 1100px) 33vw, 25vw" />
          ) : <div className="product-placeholder">ONVEX</div>}
        </Link>
        <div className="product-badges">
          {product.isNew && <span>NOVO</span>}
          {product.salePriceCents && <span className="product-badge--sale">OFERTA</span>}
          {lowStock && <span className="product-badge--low">ESTOQUE BAIXO</span>}
          {soldOut && <span className="product-badge--out">ESGOTADO</span>}
        </div>
        <button className={`favorite-button ${favorite ? "is-active" : ""}`} onClick={toggleFavorite} aria-label="Adicionar aos favoritos"><HeartIcon /></button>
        <div className="product-card__quick-actions">
          <Link className="product-card__view" href={`/produto/${product.slug}`}>VER PRODUTO</Link>
          <button className="product-card__quick" disabled={soldOut || loading} onClick={addToCart}>
            {soldOut ? "ESGOTADO" : loading ? "ADICIONANDO…" : "ADICIONAR"}
          </button>
        </div>
      </div>
      <div className="product-card__content">
        <p>{product.categoryName}</p>
        <Link href={`/produto/${product.slug}`}>{product.name}</Link>
        <div className="product-card__price">
          {product.salePriceCents && <s>{formatCurrency(product.priceCents)}</s>}
          <strong>{formatCurrency(price)}</strong>
        </div>
        <div className="product-card__foot"><small>ou 6x de {formatCurrency(Math.ceil(price / 6))}</small><span>{soldOut ? "SEM ESTOQUE" : lowStock ? `${product.stock} restantes` : "PRONTA ENTREGA"}</span></div>
      </div>
    </article>
  );
}
