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
