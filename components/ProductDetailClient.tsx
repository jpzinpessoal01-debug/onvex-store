"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { formatCurrency } from "@/lib/format";
import type { ProductDetail } from "@/lib/types";
import { HeartIcon, ShieldIcon, TruckIcon } from "./icons";
import { useToast } from "./ToastProvider";

type SizeGuideRow = { size: string; height: string; weight: string };

export function ProductDetailClient({ product, sizeGuide }: { product: ProductDetail; sizeGuide: SizeGuideRow[] }) {
  const [selectedImage, setSelectedImage] = useState(product.imageUrl ?? product.images[0]?.url ?? "");
  const firstAvailable = product.variants.find((variant) => variant.stock > 0) ?? product.variants[0];
  const [selectedColor, setSelectedColor] = useState(firstAvailable?.color ?? "");
  const [selectedSize, setSelectedSize] = useState(firstAvailable?.size ?? "");
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const { showToast } = useToast();

  const colors = useMemo(() => [...new Set(product.variants.map((variant) => variant.color))], [product.variants]);
  const sizes = useMemo(() => [...new Set(product.variants.filter((variant) => variant.color === selectedColor).map((variant) => variant.size))], [product.variants, selectedColor]);
  const selectedVariant = product.variants.find((variant) => variant.color === selectedColor && variant.size === selectedSize);
  const price = (product.salePriceCents ?? product.priceCents) + (selectedVariant?.priceAdjustmentCents ?? 0);
  const soldOut = !selectedVariant || selectedVariant.stock <= 0;

  useEffect(() => {
    document.body.style.overflow = guideOpen || zoomed ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [guideOpen, zoomed]);

  const chooseColor = (color: string) => {
    setSelectedColor(color);
    const variant = product.variants.find((item) => item.color === color && item.stock > 0) ?? product.variants.find((item) => item.color === color);
    if (variant) setSelectedSize(variant.size);
    setQuantity(1);
  };

  const addToCart = async () => {
    if (!selectedVariant || soldOut) return;
    setLoading(true);
    try {
      const response = await fetch("/api/cart", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ variantId: selectedVariant.id, quantity }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Não foi possível adicionar ao carrinho.");
      showToast("Produto adicionado ao carrinho.");
      window.dispatchEvent(new Event("onvex:cart-updated"));
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Não foi possível adicionar ao carrinho.", "error");
    } finally {
      setLoading(false);
    }
  };

  const favorite = async () => {
    const response = await fetch("/api/favorites", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ productId: product.id }) });
    if (response.status === 401) { window.location.href = `/login?returnTo=${encodeURIComponent(`/produto/${product.slug}`)}`; return; }
    showToast(response.ok ? "Produto salvo nos favoritos." : "Não foi possível favoritar.", response.ok ? "success" : "error");
  };

  return (
    <>
      <main className="product-page page-dark">
        <div className="container breadcrumbs"><Link href="/">Início</Link><span>/</span><Link href={`/categoria/${product.categorySlug}`}>{product.categoryName}</Link><span>/</span><strong>{product.name}</strong></div>
        <div className="container product-detail">
          <section className="product-gallery">
            <div className="product-gallery__thumbs">{product.images.map((image) => <button key={image.id} className={selectedImage === image.url ? "is-active" : ""} onClick={() => setSelectedImage(image.url)}><Image src={image.url} alt={image.alt || product.name} fill sizes="80px" /></button>)}</div>
            <button className="product-gallery__main" onClick={() => setZoomed(true)} aria-label="Ampliar imagem">
              {selectedImage ? <Image src={selectedImage} alt={product.name} fill priority sizes="(max-width: 900px) 100vw, 55vw" /> : <span>ONVEX</span>}
              <small>CLIQUE PARA AMPLIAR +</small>
            </button>
          </section>

          <section className="product-info">
            <div className="product-info__badges">{product.isNew && <span>NOVO</span>}{product.salePriceCents && <span>OFERTA</span>}</div>
            <p className="product-info__category">{product.categoryName} / {product.baseSku}</p>
            <h1>{product.name}</h1>
            <p className="product-info__short">{product.shortDescription}</p>
            <div className="product-info__price">{product.salePriceCents && <s>{formatCurrency(product.priceCents)}</s>}<strong>{formatCurrency(price)}</strong><small>ou 6x de {formatCurrency(Math.ceil(price / 6))} sem juros</small></div>

            <div className="option-group"><div className="option-group__head"><strong>COR</strong><span>{selectedColor}</span></div><div className="color-options">{colors.map((color) => <button key={color} className={selectedColor === color ? "is-active" : ""} onClick={() => chooseColor(color)}><i data-color={color.toLowerCase()} /><span>{color}</span></button>)}</div></div>
            <div className="option-group"><div className="option-group__head"><strong>TAMANHO</strong><button onClick={() => setGuideOpen(true)}>GUIA DE TAMANHOS ↗</button></div><div className="size-options">{sizes.map((size) => { const variant = product.variants.find((item) => item.color === selectedColor && item.size === size); return <button key={size} disabled={!variant || variant.stock === 0} className={selectedSize === size ? "is-active" : ""} onClick={() => { setSelectedSize(size); setQuantity(1); }}>{size}</button>; })}</div></div>

            <div className="stock-status"><span className={soldOut ? "is-out" : selectedVariant && selectedVariant.stock <= selectedVariant.minimumStock ? "is-low" : ""} />{soldOut ? "ESGOTADO NESTA VARIANTE" : selectedVariant && selectedVariant.stock <= selectedVariant.minimumStock ? `ESTOQUE BAIXO — RESTAM ${selectedVariant.stock}` : "EM ESTOQUE E PRONTO PARA ENVIO"}</div>
            <div className="product-buy"><div className="quantity-control"><button disabled={quantity <= 1} onClick={() => setQuantity((value) => value - 1)}>−</button><span>{quantity}</span><button disabled={soldOut || quantity >= (selectedVariant?.stock ?? 0)} onClick={() => setQuantity((value) => value + 1)}>+</button></div><button className="button button--silver" disabled={soldOut || loading} onClick={addToCart}>{soldOut ? "ESGOTADO" : loading ? "ADICIONANDO…" : "ADICIONAR AO CARRINHO"}</button><button className="product-favorite" aria-label="Adicionar aos favoritos" onClick={favorite}><HeartIcon /></button></div>

            <div className="product-assurances"><p><TruckIcon /><span><strong>ENVIO PARA TODO BRASIL</strong>Prazo calculado no checkout</span></p><p><ShieldIcon /><span><strong>COMPRA PROTEGIDA</strong>Ambiente e pagamento seguros</span></p></div>
            <div className="product-accordions"><details open><summary>DESCRIÇÃO <span>+</span></summary><p>{product.description}</p></details><details><summary>DETALHES TÉCNICOS <span>+</span></summary><ul><li>SKU: {selectedVariant?.sku ?? product.baseSku}</li><li>Peso aproximado: {product.weightGrams} g</li><li>Marca: {product.brand}</li><li>Estoque controlado individualmente por cor e tamanho</li></ul></details><details><summary>CUIDADOS E LAVAGEM <span>+</span></summary><p>Lave em água fria, não use alvejante e seque à sombra. Não utilize secadora.</p></details></div>
          </section>
        </div>

        <section className="product-story"><div className="container"><p className="eyebrow">FEITO PARA EVOLUIR</p><h2>DETALHES QUE<br />RESISTEM AO ROLA.</h2><div className="product-story__grid"><p><span>01</span><strong>CONSTRUÇÃO REFORÇADA</strong>Costuras e pontos de tensão pensados para treinos intensos.</p><p><span>02</span><strong>MOBILIDADE TÉCNICA</strong>Modelagem que acompanha o movimento sem excesso de tecido.</p><p><span>03</span><strong>IDENTIDADE MINIMALISTA</strong>Acabamento premium com presença discreta e sofisticada.</p></div></div></section>
        <section className="product-reviews container"><div className="section-heading"><div><p className="eyebrow">AVALIAÇÕES VERIFICADAS</p><h2>QUEM TREINA,<br />APROVA.</h2></div><Link className="button button--outline" href="/minha-conta/pedidos">AVALIAR UMA COMPRA</Link></div>{product.reviews.length ? <div className="review-grid">{product.reviews.map((review) => <article key={review.id}><span>{"★".repeat(review.rating)}{"☆".repeat(5-review.rating)}</span><p>“{review.comment}”</p><strong>{review.customerName}{review.verifiedPurchase && <small> COMPRA VERIFICADA</small>}</strong></article>)}</div> : <div className="empty-state"><span>AVALIAÇÕES</span><h3>Seja o primeiro a avaliar</h3><p>Apenas clientes que compraram podem publicar uma avaliação.</p></div>}</section>
      </main>

      {guideOpen && <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Guia de tamanhos"><div className="size-guide-modal"><div className="modal-head"><div><p className="eyebrow">ONVEX FIT SYSTEM</p><h2>GUIA DE TAMANHOS</h2></div><button onClick={() => setGuideOpen(false)}>FECHAR ×</button></div><p>Use a tabela como referência. Se estiver entre dois tamanhos, considere seu tipo físico e a preferência de ajuste.</p><div className="size-table"><div><strong>TAMANHO</strong><strong>ALTURA</strong><strong>PESO</strong></div>{sizeGuide.map((row) => <div key={row.size}><b>{row.size}</b><span>{row.height}</span><span>{row.weight}</span></div>)}</div></div></div>}
      {zoomed && <div className="zoom-modal" role="dialog" aria-modal="true" onClick={() => setZoomed(false)}>{selectedImage && <Image src={selectedImage} alt={product.name} fill sizes="100vw" />}<button onClick={() => setZoomed(false)}>FECHAR ×</button></div>}
    </>
  );
}

