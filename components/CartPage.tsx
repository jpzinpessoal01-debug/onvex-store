"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { formatCurrency } from "@/lib/format";
import type { CartView } from "@/lib/types";
import { ArrowRightIcon, CloseIcon } from "./icons";
import { useToast } from "./ToastProvider";

const emptyCart: CartView = { id: 0, items: [], coupon: null, subtotalCents: 0, discountCents: 0, shippingCents: 0, totalCents: 0, itemCount: 0 };

export function CartPage() {
  const [cart, setCart] = useState<CartView>(emptyCart);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [couponCode, setCouponCode] = useState("");
  const { showToast } = useToast();

  useEffect(() => {
    let active = true;
    fetch("/api/cart", { cache: "no-store" })
      .then((response) => response.json() as Promise<{ cart?: CartView; error?: string }>)
      .then((data) => {
        if (!active) return;
        if (!data.cart) throw new Error(data.error);
        setCart(data.cart);
      })
      .catch(() => { if (active) showToast("Não foi possível carregar seu carrinho.", "error"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [showToast]);

  const mutateItem = async (itemId: number, payload: Record<string, unknown>, method = "PATCH") => {
    setBusyId(itemId);
    try {
      const response = await fetch("/api/cart", {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ itemId, ...payload }),
      });
      const data = (await response.json()) as { cart?: CartView; error?: string };
      if (!response.ok || !data.cart) throw new Error(data.error ?? "Não foi possível atualizar o carrinho.");
      setCart(data.cart);
      window.dispatchEvent(new Event("onvex:cart-updated"));
      showToast(method === "DELETE" ? "Produto removido do carrinho." : "Carrinho atualizado.");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Não foi possível atualizar o carrinho.", "error");
    } finally {
      setBusyId(null);
    }
  };

  const applyCoupon = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const response = await fetch("/api/cart/coupon", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: couponCode }),
      });
      const data = (await response.json()) as { cart?: CartView; error?: string };
      if (!response.ok || !data.cart) throw new Error(data.error ?? "Cupom inválido.");
      setCart(data.cart);
      showToast("Cupom aplicado com sucesso.");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Cupom inválido.", "error");
    }
  };

  const removeCoupon = async () => {
    const response = await fetch("/api/cart/coupon", { method: "DELETE" });
    const data = (await response.json()) as { cart?: CartView };
    if (data.cart) setCart(data.cart);
  };

  if (loading) return <CartSkeleton />;
  if (!cart.items.length) {
    return (
      <div className="container empty-cart">
        <span className="empty-cart__mark">ONVEX</span>
        <p className="eyebrow">SEU CARRINHO</p>
        <h1>O TATAME ESTÁ<br />ESPERANDO.</h1>
        <p>Seu carrinho está vazio. Explore a coleção e encontre seu próximo equipamento.</p>
        <Link className="button button--silver" href="/loja">EXPLORAR A LOJA <ArrowRightIcon /></Link>
      </div>
    );
  }

  return (
    <div className="page-dark cart-page">
      <div className="container page-heading"><p className="eyebrow">CHECKOUT ONVEX</p><h1>SEU CARRINHO.</h1><p>{cart.itemCount} {cart.itemCount === 1 ? "item selecionado" : "itens selecionados"}</p></div>
      <div className="container cart-layout">
        <section className="cart-lines" aria-label="Itens do carrinho">
          {cart.items.map((item) => (
            <article className={`cart-line ${busyId === item.id ? "is-busy" : ""}`} key={item.id}>
              <Link href={`/produto/${item.productSlug}`} className="cart-line__image">
                {item.imageUrl ? <Image src={item.imageUrl} alt={item.productName} fill sizes="160px" /> : <span>ONVEX</span>}
              </Link>
              <div className="cart-line__info">
                <div className="cart-line__top"><div><span>{item.sku}</span><Link href={`/produto/${item.productSlug}`}>{item.productName}</Link></div><button onClick={() => mutateItem(item.id, {}, "DELETE")} aria-label={`Remover ${item.productName}`}><CloseIcon /></button></div>
                <label className="variant-select">VARIANTE
                  <select value={item.variantId} onChange={(event) => mutateItem(item.id, { quantity: item.quantity, variantId: Number(event.target.value) })}>
                    {item.availableVariants.map((variant) => <option key={variant.id} value={variant.id} disabled={variant.stock === 0}>{variant.color} / {variant.size}{variant.stock === 0 ? " — Esgotado" : ""}</option>)}
                  </select>
                </label>
                <div className="cart-line__bottom">
                  <div className="quantity-control"><button disabled={item.quantity <= 1} onClick={() => mutateItem(item.id, { quantity: item.quantity - 1 })}>−</button><span>{item.quantity}</span><button disabled={item.quantity >= item.stock} onClick={() => mutateItem(item.id, { quantity: item.quantity + 1 })}>+</button></div>
                  <div><strong>{formatCurrency(item.unitPriceCents * item.quantity)}</strong><small>{formatCurrency(item.unitPriceCents)} cada</small></div>
                </div>
                {item.stock <= 5 && <p className="stock-note">Restam apenas {item.stock} nesta variante</p>}
              </div>
            </article>
          ))}
          <Link href="/loja" className="text-link cart-continue">← CONTINUAR COMPRANDO</Link>
        </section>

        <aside className="cart-summary">
          <h2>RESUMO</h2>
          {cart.coupon ? (
            <div className="applied-coupon"><div><span>CUPOM ATIVO</span><strong>{cart.coupon.code}</strong></div><button onClick={removeCoupon}><CloseIcon /></button></div>
          ) : (
            <form className="coupon-form" onSubmit={applyCoupon}><label htmlFor="coupon">CUPOM DE DESCONTO</label><div><input id="coupon" value={couponCode} onChange={(event) => setCouponCode(event.target.value.toUpperCase())} placeholder="DIGITE O CÓDIGO" /><button type="submit">APLICAR</button></div></form>
          )}
          <div className="summary-lines">
            <p><span>Subtotal</span><strong>{formatCurrency(cart.subtotalCents)}</strong></p>
            {cart.discountCents > 0 && <p className="summary-discount"><span>Desconto</span><strong>− {formatCurrency(cart.discountCents)}</strong></p>}
            <p><span>Frete</span><strong>{cart.shippingCents === 0 ? "GRÁTIS" : formatCurrency(cart.shippingCents)}</strong></p>
          </div>
          <div className="summary-total"><span>TOTAL</span><div><strong>{formatCurrency(cart.totalCents)}</strong><small>ou 6x de {formatCurrency(Math.ceil(cart.totalCents / 6))}</small></div></div>
          <Link className="button button--silver cart-checkout" href="/checkout">IR PARA O CHECKOUT <ArrowRightIcon /></Link>
          <p className="summary-secure">Pagamento processado com segurança. O estoque é validado novamente antes da confirmação.</p>
        </aside>
      </div>
    </div>
  );
}

function CartSkeleton() {
  return <div className="page-dark cart-page"><div className="container page-heading"><div className="skeleton skeleton--eyebrow" /><div className="skeleton skeleton--title" /></div><div className="container cart-layout"><div className="cart-lines">{[1,2].map((item) => <div className="cart-line skeleton-card" key={item} />)}</div><div className="cart-summary skeleton-card" /></div></div>;
}
