"use client";

import Image from "next/image";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/format";
import type { AppUser, CartView } from "@/lib/types";
import { ArrowRightIcon, ShieldIcon } from "./icons";
import { useToast } from "./ToastProvider";

type CheckoutData = {
  name: string; email: string; phone: string; cpf: string;
  postalCode: string; street: string; number: string; complement: string; district: string; city: string; state: string;
  delivery: "STANDARD" | "EXPRESS"; paymentMethod: "PIX" | "CREDIT_CARD";
};

const steps = ["DADOS", "ENDEREÇO", "ENTREGA", "PAGAMENTO", "CONFIRMAÇÃO"];

export function CheckoutPage({ user, cpfRequired }: { user: AppUser; cpfRequired: boolean }) {
  const [step, setStep] = useState(1);
  const [cart, setCart] = useState<CartView | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [data, setData] = useState<CheckoutData>({ name: user.name, email: user.email, phone: user.phone ?? "", cpf: user.cpf ?? "", postalCode: "", street: "", number: "", complement: "", district: "", city: "", state: "", delivery: "STANDARD", paymentMethod: "PIX" });
  const idempotencyKey = useRef(crypto.randomUUID());
  const router = useRouter();
  const { showToast } = useToast();

  useEffect(() => {
    fetch("/api/cart", { cache: "no-store" })
      .then(async (response) => (await response.json()) as { cart?: CartView })
      .then((result) => setCart(result.cart ?? null))
      .catch(() => showToast("Não foi possível carregar o checkout.", "error"));
  }, [showToast]);

  const displayShipping = data.delivery === "EXPRESS" ? 4990 : cart?.shippingCents ?? 0;
  const displayTotal = useMemo(() => cart ? Math.max(0, cart.subtotalCents - cart.discountCents + displayShipping) : 0, [cart, displayShipping]);
  const set = (field: keyof CheckoutData, value: string) => setData((current) => ({ ...current, [field]: value }));

  const validateStep = () => {
    if (step === 1 && (!data.name.trim() || !data.phone.trim() || !data.email.trim() || (cpfRequired && !data.cpf.trim()))) return "Preencha seus dados pessoais.";
    if (step === 2 && (!data.postalCode.trim() || !data.street.trim() || !data.number.trim() || !data.district.trim() || !data.city.trim() || data.state.trim().length !== 2)) return "Preencha o endereço completo.";
    return null;
  };

  const next = () => {
    const error = validateStep();
    if (error) { showToast(error, "error"); return; }
    setStep((value) => Math.min(value + 1, 5));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!cart?.items.length) { showToast("Seu carrinho está vazio.", "error"); return; }
    setSubmitting(true);
    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": idempotencyKey.current },
        body: JSON.stringify({
          idempotencyKey: idempotencyKey.current,
          customer: { name: data.name, email: data.email, phone: data.phone, cpf: data.cpf || null },
          address: { postalCode: data.postalCode, street: data.street, number: data.number, complement: data.complement || null, district: data.district, city: data.city, state: data.state },
          delivery: data.delivery,
          paymentMethod: data.paymentMethod,
        }),
      });
      const result = await response.json() as { order?: { id: number }; payment?: { checkoutUrl?: string; qrCode?: string }; error?: string };
      if (!response.ok || !result.order) throw new Error(result.error ?? "Não foi possível criar o pedido.");
      window.dispatchEvent(new Event("onvex:cart-updated"));
      showToast("Pedido criado com sucesso.");
      if (result.payment?.checkoutUrl?.startsWith("https://")) {
        window.location.assign(result.payment.checkoutUrl);
        return;
      }
      router.push(`/pedido/${result.order.id}`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Não foi possível finalizar o pedido.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  if (!cart) return <div className="checkout-page page-dark"><div className="container checkout-loading"><div className="skeleton skeleton--title" /><div className="skeleton-card" /></div></div>;
  if (!cart.items.length) return <div className="empty-cart container"><p className="eyebrow">CHECKOUT</p><h1>SEU CARRINHO<br />ESTÁ VAZIO.</h1><a className="button button--silver" href="/loja">IR PARA A LOJA</a></div>;

  return (
    <main className="checkout-page page-dark">
      <div className="container checkout-head"><div><p className="eyebrow">FINALIZAÇÃO SEGURA</p><h1>CHECKOUT.</h1></div><div className="checkout-steps">{steps.map((label, index) => <button key={label} className={step === index + 1 ? "is-active" : step > index + 1 ? "is-done" : ""} onClick={() => index + 1 < step && setStep(index + 1)}><span>{String(index + 1).padStart(2, "0")}</span>{label}</button>)}</div></div>
      <form className="container checkout-layout" onSubmit={submit}>
        <section className="checkout-form-card">
          {step === 1 && <fieldset><legend><span>01</span>DADOS PESSOAIS</legend><p>Use os dados vinculados à sua conta ONVEX.</p><div className="form-grid"><label className="full">NOME COMPLETO<input value={data.name} onChange={(event) => set("name", event.target.value)} autoComplete="name" required /></label><label className="full">E-MAIL<input value={data.email} readOnly autoComplete="email" /></label><label>TELEFONE<input value={data.phone} onChange={(event) => set("phone", event.target.value)} placeholder="(00) 00000-0000" autoComplete="tel" required /></label><label>CPF {!cpfRequired&&<small>OPCIONAL</small>}<input value={data.cpf} onChange={(event) => set("cpf", event.target.value)} placeholder="000.000.000-00" inputMode="numeric" required={cpfRequired} /></label></div></fieldset>}
          {step === 2 && <fieldset><legend><span>02</span>ENDEREÇO DE ENTREGA</legend><p>Confira os dados com atenção para evitar atrasos no envio.</p><div className="form-grid"><label>CEP<input value={data.postalCode} onChange={(event) => set("postalCode", event.target.value)} placeholder="00000-000" inputMode="numeric" autoComplete="postal-code" required /></label><label>ESTADO<input value={data.state} onChange={(event) => set("state", event.target.value.toUpperCase().slice(0,2))} placeholder="UF" maxLength={2} autoComplete="address-level1" required /></label><label className="wide">RUA<input value={data.street} onChange={(event) => set("street", event.target.value)} autoComplete="address-line1" required /></label><label>NÚMERO<input value={data.number} onChange={(event) => set("number", event.target.value)} required /></label><label>COMPLEMENTO <small>OPCIONAL</small><input value={data.complement} onChange={(event) => set("complement", event.target.value)} autoComplete="address-line2" /></label><label>BAIRRO<input value={data.district} onChange={(event) => set("district", event.target.value)} required /></label><label>CIDADE<input value={data.city} onChange={(event) => set("city", event.target.value)} autoComplete="address-level2" required /></label></div></fieldset>}
          {step === 3 && <fieldset><legend><span>03</span>FORMA DE ENTREGA</legend><p>Escolha como deseja receber seus produtos.</p><div className="choice-list"><label className={data.delivery === "STANDARD" ? "is-selected" : ""}><input type="radio" name="delivery" checked={data.delivery === "STANDARD"} onChange={() => set("delivery", "STANDARD")} /><div><strong>ENTREGA PADRÃO</strong><span>5 a 10 dias úteis • Com rastreamento</span></div><b>{cart.shippingCents === 0 ? "GRÁTIS" : formatCurrency(cart.shippingCents)}</b></label><label className={data.delivery === "EXPRESS" ? "is-selected" : ""}><input type="radio" name="delivery" checked={data.delivery === "EXPRESS"} onChange={() => set("delivery", "EXPRESS")} /><div><strong>ENTREGA EXPRESSA</strong><span>2 a 5 dias úteis • Prioridade no envio</span></div><b>{formatCurrency(4990)}</b></label></div></fieldset>}
          {step === 4 && <fieldset><legend><span>04</span>PAGAMENTO</legend><p>A confirmação ocorre somente pelo gateway, nunca pelo navegador.</p><div className="choice-list payment-choices"><label className={data.paymentMethod === "PIX" ? "is-selected" : ""}><input type="radio" name="payment" checked={data.paymentMethod === "PIX"} onChange={() => set("paymentMethod", "PIX")} /><div><strong>PIX</strong><span>Aprovação rápida após confirmação do banco</span></div><b>PIX</b></label><label className={data.paymentMethod === "CREDIT_CARD" ? "is-selected" : ""}><input type="radio" name="payment" checked={data.paymentMethod === "CREDIT_CARD"} onChange={() => set("paymentMethod", "CREDIT_CARD")} /><div><strong>CARTÃO DE CRÉDITO</strong><span>Dados coletados pelo ambiente seguro do gateway</span></div><b>ATÉ 6X</b></label></div><div className="gateway-note"><ShieldIcon /><p><strong>SEUS DADOS FINANCEIROS NÃO FICAM NA ONVEX.</strong> Ao confirmar, o pagamento é criado no provedor configurado. O pedido só muda para pago após um webhook assinado.</p></div></fieldset>}
          {step === 5 && <fieldset><legend><span>05</span>CONFIRME SEU PEDIDO</legend><p>Revise tudo antes de criar o pedido.</p><div className="checkout-review"><article><span>CONTATO</span><strong>{data.name}</strong><p>{data.email}<br />{data.phone}</p><button type="button" onClick={() => setStep(1)}>EDITAR</button></article><article><span>ENTREGA</span><strong>{data.street}, {data.number}</strong><p>{data.district} • {data.city}/{data.state}<br />CEP {data.postalCode}</p><button type="button" onClick={() => setStep(2)}>EDITAR</button></article><article><span>MÉTODO</span><strong>{data.paymentMethod === "PIX" ? "PIX" : "Cartão de crédito"}</strong><p>{data.delivery === "EXPRESS" ? "Entrega expressa" : "Entrega padrão"}</p><button type="button" onClick={() => setStep(3)}>EDITAR</button></article></div><label className="terms-check"><input type="checkbox" required />Li e concordo com os <a href="/termos" target="_blank">Termos de Uso</a> e a <a href="/privacidade" target="_blank">Política de Privacidade</a>.</label></fieldset>}
          <div className="checkout-nav">{step > 1 && <button type="button" className="button button--ghost" onClick={() => setStep((value) => value - 1)}>VOLTAR</button>}{step < 5 ? <button type="button" className="button button--silver" onClick={next}>CONTINUAR <ArrowRightIcon /></button> : <button className="button button--silver" type="submit" disabled={submitting}>{submitting ? "PROCESSANDO…" : "CONFIRMAR PEDIDO"} <ArrowRightIcon /></button>}</div>
        </section>

        <aside className="checkout-summary"><h2>SEU PEDIDO</h2><div className="checkout-items">{cart.items.map((item) => <div key={item.id}><div className="checkout-item__image">{item.imageUrl && <Image src={item.imageUrl} alt={item.productName} fill sizes="72px" />}<span>{item.quantity}</span></div><div><strong>{item.productName}</strong><small>{item.color} / {item.size}</small></div><b>{formatCurrency(item.unitPriceCents * item.quantity)}</b></div>)}</div><div className="summary-lines"><p><span>Subtotal</span><strong>{formatCurrency(cart.subtotalCents)}</strong></p>{cart.discountCents > 0 && <p className="summary-discount"><span>Desconto</span><strong>− {formatCurrency(cart.discountCents)}</strong></p>}<p><span>Frete</span><strong>{displayShipping === 0 ? "GRÁTIS" : formatCurrency(displayShipping)}</strong></p></div><div className="summary-total"><span>TOTAL</span><div><strong>{formatCurrency(displayTotal)}</strong><small>Valores recalculados no servidor</small></div></div></aside>
      </form>
    </main>
  );
}
