import { getRuntimeEnv } from "./runtime-env";

type EmailRuntimeEnv = {
  EMAIL_API_URL?: string;
  EMAIL_API_KEY?: string;
  EMAIL_FROM?: string;
  STORE_BASE_URL?: string;
};

export type EmailTemplate = "WELCOME" | "VERIFY_EMAIL" | "RESET_PASSWORD" | "ORDER_RECEIVED" | "PAYMENT_APPROVED" | "ORDER_SHIPPED" | "ORDER_DELIVERED";

const subjects: Record<EmailTemplate, string> = {
  WELCOME: "Bem-vindo à ONVEX",
  VERIFY_EMAIL: "Confirme seu e-mail ONVEX",
  RESET_PASSWORD: "Recupere seu acesso ONVEX",
  ORDER_RECEIVED: "Recebemos seu pedido",
  PAYMENT_APPROVED: "Pagamento aprovado",
  ORDER_SHIPPED: "Seu pedido foi enviado",
  ORDER_DELIVERED: "Pedido entregue",
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character);
}

export function renderEmail(template: EmailTemplate, variables: Record<string, string>) {
  const name = escapeHtml(variables.name ?? "atleta");
  const orderNumber = escapeHtml(variables.orderNumber ?? "");
  const actionUrl = escapeHtml(variables.actionUrl ?? "#");
  const messages: Record<EmailTemplate, { eyebrow: string; title: string; body: string; action: string }> = {
    WELCOME: { eyebrow: "ONVEX MEMBER", title: `BEM-VINDO, ${name.toUpperCase()}.`, body: "Sua conta está pronta. Salve favoritos, acompanhe pedidos e evolua seu equipamento.", action: "EXPLORAR A LOJA" },
    VERIFY_EMAIL: { eyebrow: "CONFIRMAÇÃO", title: "CONFIRME SEU E-MAIL.", body: "Use o botão abaixo para confirmar seu endereço de e-mail.", action: "CONFIRMAR E-MAIL" },
    RESET_PASSWORD: { eyebrow: "SEGURANÇA", title: "RECUPERE SEU ACESSO.", body: "Recebemos uma solicitação de recuperação. Ignore esta mensagem se não foi você.", action: "RECUPERAR ACESSO" },
    ORDER_RECEIVED: { eyebrow: orderNumber, title: "PEDIDO RECEBIDO.", body: "O estoque foi reservado e aguardamos a confirmação segura do pagamento.", action: "ACOMPANHAR PEDIDO" },
    PAYMENT_APPROVED: { eyebrow: orderNumber, title: "PAGAMENTO APROVADO.", body: "Tudo certo. Seu pedido seguirá para preparação.", action: "VER PEDIDO" },
    ORDER_SHIPPED: { eyebrow: orderNumber, title: "SEU PEDIDO SAIU.", body: "A entrega está a caminho. Acompanhe o rastreamento na sua conta.", action: "RASTREAR PEDIDO" },
    ORDER_DELIVERED: { eyebrow: orderNumber, title: "ENTREGA CONCLUÍDA.", body: "Seu equipamento chegou. Nos vemos no tatame.", action: "AVALIAR PRODUTOS" },
  };
  const content = messages[template];
  return {
    subject: subjects[template],
    text: `${content.title}\n\n${content.body}\n\n${variables.actionUrl ?? ""}`,
    html: `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#050505;color:#f4f4f2;font-family:Arial,sans-serif"><table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr><td align="center" style="padding:40px 16px"><table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;border:1px solid #292929;background:#101010"><tr><td style="padding:30px;border-bottom:1px solid #292929;font-size:24px;font-weight:800;letter-spacing:7px;color:#d3d3cf">ONVEX</td></tr><tr><td style="padding:50px 30px"><p style="margin:0 0 18px;color:#777;font-size:10px;letter-spacing:2px">${escapeHtml(content.eyebrow)}</p><h1 style="margin:0;font-size:42px;line-height:.95;letter-spacing:-2px">${content.title}</h1><p style="margin:24px 0 30px;color:#a3a3a3;font-size:15px;line-height:1.7">${content.body}</p><a href="${actionUrl}" style="display:inline-block;padding:16px 22px;background:#d3d3cf;color:#050505;font-size:11px;font-weight:700;letter-spacing:1px;text-decoration:none">${content.action} →</a></td></tr><tr><td style="padding:22px 30px;border-top:1px solid #292929;color:#666;font-size:10px">© ONVEX. Todos os direitos reservados.</td></tr></table></td></tr></table></body></html>`,
  };
}

export async function sendTransactionalEmail(to: string, template: EmailTemplate, variables: Record<string, string>): Promise<boolean> {
  const runtime = await getRuntimeEnv<EmailRuntimeEnv>();
  if (!runtime.EMAIL_API_URL || !runtime.EMAIL_API_KEY || !runtime.EMAIL_FROM) return false;
  const actionValue = variables.actionUrl ?? "";
  const actionUrl = actionValue.startsWith("/") && runtime.STORE_BASE_URL
    ? new URL(actionValue, runtime.STORE_BASE_URL).toString()
    : actionValue;
  const rendered = renderEmail(template, { ...variables, actionUrl });
  const response = await fetch(runtime.EMAIL_API_URL, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${runtime.EMAIL_API_KEY}` },
    body: JSON.stringify({ from: runtime.EMAIL_FROM, to, subject: rendered.subject, html: rendered.html, text: rendered.text }),
  });
  return response.ok;
}
