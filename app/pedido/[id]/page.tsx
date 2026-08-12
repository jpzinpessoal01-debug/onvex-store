import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireChatGPTUser } from "@/app/chatgpt-auth";
import { PaymentInstructions } from "@/components/PaymentInstructions";
import { ReviewOrder } from "@/components/ReviewOrder";
import { getCurrentAppUser } from "@/lib/auth";
import { formatCurrency, formatDate } from "@/lib/format";
import { getOrderDetail } from "@/lib/orders";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Pedido", robots: { index: false, follow: false } };
type Params = Promise<{ id: string }>;

const statusLabel: Record<string, string> = { PENDING: "Aguardando pagamento", PAID: "Pagamento aprovado", PROCESSING: "Em preparação", SHIPPED: "Pedido enviado", DELIVERED: "Entregue", CANCELED: "Cancelado", REFUNDED: "Reembolsado" };

export default async function OrderPage({ params }: { params: Params }) {
  const { id } = await params;
  await requireChatGPTUser(`/pedido/${id}`);
  const viewer = await getCurrentAppUser();
  if (!viewer || !/^\d+$/.test(id)) notFound();
  let detail: Awaited<ReturnType<typeof getOrderDetail>>;
  try { detail = await getOrderDetail(Number(id), viewer); } catch { notFound(); }
  const { order, items, events, address, payment } = detail;
  return <main className="page-dark order-page">
    <div className="container order-success"><span className="order-success__icon">✓</span><p className="eyebrow">PEDIDO RECEBIDO</p><h1>OBRIGADO,<br />{order.customerName.split(" ")[0].toUpperCase()}.</h1><p>Seu pedido <strong>{order.orderNumber}</strong> foi criado. A confirmação de pagamento acontece exclusivamente pelo provedor.</p><div className={`order-status order-status--${order.status.toLowerCase()}`}><span />{statusLabel[order.status] ?? order.status}</div></div>
    <div className="container order-layout">
      <section><h2>ITENS DO PEDIDO</h2><div className="order-items">{items.map((item) => <article key={item.id}><div>{item.imageUrl && <Image src={item.imageUrl} alt={item.productName} fill sizes="90px" />}</div><p><strong>{item.productName}</strong><span>{item.color} / {item.size} • SKU {item.sku}</span><small>Quantidade: {item.quantity}</small></p><b>{formatCurrency(item.totalCents)}</b></article>)}</div><h2>ACOMPANHAMENTO</h2><div className="order-timeline">{events.map((event) => <article key={event.id}><span /><div><strong>{event.message}</strong><small>{formatDate(event.createdAt)}</small></div></article>)}</div>{order.status === "DELIVERED" && <ReviewOrder orderId={order.id} items={items.map(item=>({productId:item.productId,productName:item.productName}))}/>}</section>
      <aside className="order-sidebar">
        <article><h3>RESUMO</h3><p><span>Subtotal</span><strong>{formatCurrency(order.subtotalCents)}</strong></p><p><span>Desconto</span><strong>− {formatCurrency(order.discountCents)}</strong></p><p><span>Frete</span><strong>{order.shippingCents === 0 ? "Grátis" : formatCurrency(order.shippingCents)}</strong></p><p className="order-total"><span>Total</span><strong>{formatCurrency(order.totalCents)}</strong></p></article>
        <article><h3>ENTREGA</h3><p>{order.customerName}<br />{address.street}, {address.number}{address.complement ? ` — ${address.complement}` : ""}<br />{address.district}<br />{address.city}/{address.state} • {address.postalCode}</p>{order.trackingCode && <a href={order.trackingUrl ?? "#"}>Rastrear: {order.trackingCode}</a>}</article>
        <article><h3>PAGAMENTO</h3><p>{payment?.method === "PIX" ? "PIX" : "Cartão de crédito"}<br />Status: {order.paymentStatus}</p>{order.paymentStatus === "PENDING"&&<PaymentInstructions qrCode={payment?.qrCode} checkoutUrl={payment?.checkoutUrl}/>}</article>
        <Link className="button button--outline" href="/minha-conta/pedidos">VER MEUS PEDIDOS</Link>
      </aside>
    </div>
  </main>;
}
