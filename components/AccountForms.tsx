"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import type { AppUser } from "@/lib/types";
import { useToast } from "./ToastProvider";

export function ProfileForm({ user }: { user: AppUser }) {
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone ?? "");
  const [cpf, setCpf] = useState(user.cpf ?? "");
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  const submit = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true);
    const response = await fetch("/api/account", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, phone, cpf }) });
    const result = await response.json() as { error?: string };
    showToast(response.ok ? "Dados atualizados com sucesso." : result.error ?? "Não foi possível salvar.", response.ok ? "success" : "error");
    setSaving(false);
  };

  return <form className="account-form" onSubmit={submit}><div className="form-grid"><label className="full">NOME COMPLETO<input value={name} onChange={(event) => setName(event.target.value)} required /></label><label className="full">E-MAIL<input value={user.email} readOnly /></label><label>TELEFONE<input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="(00) 00000-0000" /></label><label>CPF<input value={cpf} onChange={(event) => setCpf(event.target.value)} placeholder="000.000.000-00" /></label></div><button className="button button--silver" disabled={saving}>{saving ? "SALVANDO…" : "SALVAR ALTERAÇÕES"}</button></form>;
}

export function AddressManager({ addresses }: { addresses: Array<Record<string, unknown>> }) {
  const [open, setOpen] = useState(addresses.length === 0);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ label: "Principal", recipientName: "", postalCode: "", street: "", number: "", complement: "", district: "", city: "", state: "", isDefault: addresses.length === 0 });
  const { showToast } = useToast();
  const router = useRouter();
  const set = (field: string, value: string | boolean) => setForm((current) => ({ ...current, [field]: value }));

  const submit = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true);
    const response = await fetch("/api/account/addresses", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(form) });
    const result = await response.json() as { error?: string };
    if (response.ok) { showToast("Endereço adicionado."); setOpen(false); router.refresh(); } else showToast(result.error ?? "Não foi possível adicionar o endereço.", "error");
    setSaving(false);
  };

  const remove = async (id: number) => {
    const response = await fetch("/api/account/addresses", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }) });
    if (response.ok) { showToast("Endereço removido."); router.refresh(); } else showToast("Não foi possível remover o endereço.", "error");
  };

  return <div className="address-manager"><div className="address-grid">{addresses.map((address) => <article key={String(address.id)}><div><span>{String(address.label)}</span>{Boolean(address.isDefault) && <b>PADRÃO</b>}</div><strong>{String(address.recipientName)}</strong><p>{String(address.street)}, {String(address.number)}<br />{String(address.district)}<br />{String(address.city)}/{String(address.state)} • {String(address.postalCode)}</p><button onClick={() => remove(Number(address.id))}>REMOVER</button></article>)}</div><button className="button button--outline" onClick={() => setOpen((value) => !value)}>{open ? "CANCELAR" : "+ ADICIONAR ENDEREÇO"}</button>{open && <form className="account-form address-form" onSubmit={submit}><div className="form-grid"><label>IDENTIFICAÇÃO<input value={form.label} onChange={(event) => set("label", event.target.value)} required /></label><label>DESTINATÁRIO<input value={form.recipientName} onChange={(event) => set("recipientName", event.target.value)} required /></label><label>CEP<input value={form.postalCode} onChange={(event) => set("postalCode", event.target.value)} required /></label><label>ESTADO<input value={form.state} onChange={(event) => set("state", event.target.value.toUpperCase().slice(0,2))} maxLength={2} required /></label><label className="wide">RUA<input value={form.street} onChange={(event) => set("street", event.target.value)} required /></label><label>NÚMERO<input value={form.number} onChange={(event) => set("number", event.target.value)} required /></label><label>COMPLEMENTO<input value={form.complement} onChange={(event) => set("complement", event.target.value)} /></label><label>BAIRRO<input value={form.district} onChange={(event) => set("district", event.target.value)} required /></label><label>CIDADE<input value={form.city} onChange={(event) => set("city", event.target.value)} required /></label></div><label className="terms-check"><input type="checkbox" checked={form.isDefault} onChange={(event) => set("isDefault", event.target.checked)} />Usar como endereço padrão</label><button className="button button--silver" disabled={saving}>{saving ? "SALVANDO…" : "SALVAR ENDEREÇO"}</button></form>}</div>;
}

