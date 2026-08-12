"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CartIcon, CloseIcon, HeartIcon, MenuIcon, SearchIcon, UserIcon } from "./icons";

const links = [
  ["Início", "/"],
  ["Loja", "/loja"],
  ["Rash Guards", "/categoria/rash-guards"],
  ["Shorts", "/categoria/shorts"],
  ["Acessórios", "/categoria/acessorios"],
  ["Contato", "/contato"],
];

export function HeaderActions({ signedIn, isAdmin = false }: { signedIn: boolean; isAdmin?: boolean }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [cartCount, setCartCount] = useState(0);

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch("/api/cart", { cache: "no-store" });
        if (response.ok) {
          const data = (await response.json()) as { cart?: { itemCount?: number } };
          setCartCount(data.cart?.itemCount ?? 0);
        }
      } catch {
        // Header remains usable when cart data is temporarily unavailable.
      }
    };
    void load();
    window.addEventListener("onvex:cart-updated", load);
    return () => window.removeEventListener("onvex:cart-updated", load);
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  return (
    <>
      <nav className="desktop-nav" aria-label="Navegação principal">
        {links.map(([label, href]) => <Link href={href} key={href}>{label}</Link>)}
      </nav>
      <div className="header-actions">
        <button className="icon-button" aria-label="Pesquisar" onClick={() => setSearchOpen((value) => !value)}><SearchIcon /></button>
        <Link className="icon-button hide-mobile" aria-label="Favoritos" href="/favoritos"><HeartIcon /></Link>
        <Link className="icon-button hide-mobile" aria-label={signedIn ? "Minha conta" : "Entrar"} href={signedIn ? "/minha-conta" : "/login"}><UserIcon /></Link>
        {isAdmin && <Link className="icon-button hide-mobile" aria-label="Painel administrativo" href="/admin"><strong style={{fontSize:10,letterSpacing:".08em"}}>AD</strong></Link>}
        <Link className="icon-button cart-button" aria-label={`Carrinho com ${cartCount} itens`} href="/carrinho">
          <CartIcon />
          {cartCount > 0 && <span className="cart-count">{cartCount > 99 ? "99+" : cartCount}</span>}
        </Link>
        <button className="icon-button menu-button" aria-label="Abrir menu" onClick={() => setMenuOpen(true)}><MenuIcon /></button>
      </div>

      {searchOpen && (
        <div className="search-bar-wrap">
          <form action="/loja" className="search-form">
            <SearchIcon />
            <input name="q" autoFocus placeholder="Busque por produto, categoria ou SKU" aria-label="Buscar produtos" />
            <button type="button" className="icon-button" aria-label="Fechar busca" onClick={() => setSearchOpen(false)}><CloseIcon /></button>
          </form>
        </div>
      )}

      <div className={`mobile-drawer-backdrop ${menuOpen ? "is-open" : ""}`} onClick={() => setMenuOpen(false)} />
      <aside className={`mobile-drawer ${menuOpen ? "is-open" : ""}`} aria-hidden={!menuOpen}>
        <div className="mobile-drawer__head">
          <span className="brand-logo brand-logo--compact">ONVEX</span>
          <button className="icon-button" aria-label="Fechar menu" onClick={() => setMenuOpen(false)}><CloseIcon /></button>
        </div>
        <nav aria-label="Menu mobile">
          {links.map(([label, href]) => <Link href={href} key={href} onClick={() => setMenuOpen(false)}>{label}<span>↗</span></Link>)}
          {isAdmin && <Link href="/admin" onClick={() => setMenuOpen(false)}>Painel administrativo<span>↗</span></Link>}
        </nav>
        <div className="mobile-drawer__account">
          <Link href={signedIn ? "/minha-conta" : "/login"}><UserIcon />{signedIn ? "Minha conta" : "Entrar"}</Link>
          <Link href="/favoritos"><HeartIcon />Favoritos</Link>
          {isAdmin && <Link href="/admin"><span>⚙</span>Painel admin</Link>}
        </div>
      </aside>
    </>
  );
}
