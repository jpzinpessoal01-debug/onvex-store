"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export function SiteExperience() {
  const pathname = usePathname();
  const [booting, setBooting] = useState(true);
  const [progress, setProgress] = useState(4);
  const [routeFlash, setRouteFlash] = useState(false);

  useEffect(() => {
    const seen = sessionStorage.getItem("onvex_boot_seen");
    const duration = seen ? 720 : 1550;
    const startedAt = performance.now();

    const interval = window.setInterval(() => {
      const elapsed = performance.now() - startedAt;
      const ratio = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - ratio, 3);
      setProgress(Math.min(99, Math.max(4, Math.round(eased * 100))));
    }, 45);

    const timer = window.setTimeout(() => {
      setProgress(100);
      window.setTimeout(() => {
        setBooting(false);
        sessionStorage.setItem("onvex_boot_seen", "1");
      }, 140);
    }, duration);

    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (booting) return;
    setRouteFlash(true);
    const timer = window.setTimeout(() => setRouteFlash(false), 320);
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
      { rootMargin: "0px 0px -5% 0px", threshold: 0.06 },
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
        element.style.setProperty("--ovx-reveal-delay", `${Math.min(index % 4, 3) * 55}ms`);
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
        <div className="onvex-loader onvex-loader--active" role="status" aria-label={`Carregando ONVEX ${progress}%`}>
          <div className="onvex-loader__grid" />
          <div className="onvex-loader__beam" />
          <div className="onvex-loader__core">
            <span className="onvex-loader__eyebrow">JIU-JITSU PERFORMANCE SYSTEM</span>
            <strong>ONVEX</strong>
            <div className="onvex-loader__progress-head"><span>CARREGANDO</span><span>{progress}%</span></div>
            <div className="onvex-loader__track" aria-hidden="true"><i style={{ width: `${progress}%` }} /></div>
            <small>{progress < 35 ? "INICIALIZANDO SISTEMA" : progress < 75 ? "PREPARANDO EXPERIÊNCIA" : "QUASE PRONTO"}</small>
          </div>
        </div>
      )}
      <div className={`onvex-route-flash ${routeFlash ? "is-active" : ""}`} aria-hidden="true" />
      <div className="onvex-ambient" aria-hidden="true"><i /><i /></div>
    </>
  );
}
