"use client";

import { useState } from "react";
import { useToast } from "./ToastProvider";

export function PaymentInstructions({ qrCode, checkoutUrl }: { qrCode?: string | null; checkoutUrl?: string | null }) {
  const [copying, setCopying] = useState(false);
  const { showToast } = useToast();
  const copy = async () => {
    if (!qrCode) return;
    setCopying(true);
    try {
      await navigator.clipboard.writeText(qrCode);
      showToast("Código PIX copiado.");
    } catch { showToast("Não foi possível copiar o código PIX.", "error"); }
    finally { setCopying(false); }
  };
  if (!qrCode && !checkoutUrl) return null;
  return <div className="payment-instructions">{qrCode&&<><span>PIX COPIA E COLA</span><textarea value={qrCode} readOnly rows={4}/><button type="button" onClick={copy} disabled={copying}>{copying?"COPIANDO…":"COPIAR CÓDIGO PIX"}</button></>}{checkoutUrl&&<a href={checkoutUrl} rel="noreferrer">ABRIR PAGAMENTO SEGURO ↗</a>}</div>;
}
