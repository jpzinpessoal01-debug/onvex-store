"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export function SiteExperience() {
  const pathname = usePathname();
  const [booting, setBooting] = useState(true);
  const [routeFlash, setRouteFlash] = useState(false);

  useEffect(() => {
    const seen = sessionStorage.getItem("onvex_boot_seen");
    const duration = seen ? 380 : 1150;
    const timer = window.setTimeout(() => {
      setBooting(false);
      sessionStorage.setItem("onvex_boot_seen", "1");
    }, duration);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (booting) return;
    setRouteFlash(true);
    const timer = window.setTimeout(() => setRouteFlash(false), 520);
    return () => window.clearTimeout(timer);
  }, [pathname, booting]);

  useEffect(() => {
    if (booting) return;

    let revealObserver: IntersectionObserver | undefined;
    let mutationObserver: MutationObserver | undefined;
    const timers: number[] = [];

    const prepare = () => {
      revealObserver?.disconnect();
      revealObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add("ovx-scroll-visible");
            revealObserver?.unobserve(entry.target);
          });
        },
        { rootMargin: "0px 0px -8% 0px", threshold: 0.12 },
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

      document.querySelectorAll<HTMLElement>(selectors).forEach((element, index) => {
        if (element.dataset.ovxRevealReady === "1") return;
        element.dataset.ovxRevealReady = "1";
        element.classList.add("ovx-scroll-reveal");
        element.style.setProperty("--ovx-reveal-delay", `${Math.min(index % 5, 4) * 90}ms`);
        revealObserver?.observe(element);
      });
    };

    const first = window.setTimeout(prepare, 80);
    timers.push(first);
    mutationObserver = new MutationObserver(() => {
      const id = window.setTimeout(prepare, 40);
      timers.push(id);
    });
    mutationObserver.observe(document.body, { childList: true, subtree: true });

    return () => {
      timers.forEach((id) => window.clearTimeout(id));
      mutationObserver?.disconnect();
      revealObserver?.disconnect();
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
            <div className="onvex-loader__track"><i /></div>
            <small>CARREGANDO EXPERIÊNCIA</small>
          </div>
        </div>
      )}
      <div className={`onvex-route-flash ${routeFlash ? "is-active" : ""}`} aria-hidden="true" />
      <div className="onvex-ambient" aria-hidden="true"><i /><i /><i /></div>
    </>
  );
}
