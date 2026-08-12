"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export function SiteExperience() {
  const pathname = usePathname();
  const [booting, setBooting] = useState(true);
  const [routeFlash, setRouteFlash] = useState(false);

  useEffect(() => {
    const seen = sessionStorage.getItem("onvex_boot_seen");
    const duration = seen ? 260 : 900;
    const timer = window.setTimeout(() => {
      setBooting(false);
      sessionStorage.setItem("onvex_boot_seen", "1");
    }, duration);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (booting) return;
    setRouteFlash(true);
    const timer = window.setTimeout(() => setRouteFlash(false), 360);
    return () => window.clearTimeout(timer);
  }, [pathname, booting]);

  useEffect(() => {
    if (booting) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("ovx-scroll-visible");
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: "0px 0px -6% 0px", threshold: 0.08 },
    );

    const selectors = [
      ".product-card",
      ".category-card",
      ".benefit-grid article",
      ".section-heading",
      ".manifesto__image",
      ".manifesto__content",
      ".newsletter__inner",
    ].join(",");

    const id = window.requestAnimationFrame(() => {
      document.querySelectorAll<HTMLElement>(selectors).forEach((element, index) => {
        element.classList.add("ovx-scroll-reveal");
        element.style.setProperty("--ovx-reveal-delay", `${Math.min(index % 4, 3) * 70}ms`);
        observer.observe(element);
      });
    });

    return () => {
      window.cancelAnimationFrame(id);
      observer.disconnect();
    };
  }, [pathname, booting]);

  return (
    <>
      {booting && (
        <div className="onvex-loader" role="status" aria-label="Carregando ONVEX">
          <div className="onvex-loader__grid" />
          <div className="onvex-loader__beam" />
          <div className="onvex-loader__core">
            <span className="onvex-loader__eyebrow">JIU-JITSU PERFORMANCE SYSTEM</span>
            <strong>ONVEX</strong>
            <div className="onvex-loader__progress-head"><span>INICIALIZANDO</span><span>100%</span></div>
            <div className="onvex-loader__track"><i /></div>
            <small>CARREGANDO EXPERIÊNCIA</small>
          </div>
        </div>
      )}
      <div className={`onvex-route-flash ${routeFlash ? "is-active" : ""}`} aria-hidden="true" />
      <div className="onvex-ambient" aria-hidden="true"><i /><i /></div>
    </>
  );
}
