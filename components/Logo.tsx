import Link from "next/link";

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className={`brand-logo ${compact ? "brand-logo--compact" : ""}`} aria-label="ONVEX — Início">
      ONVEX
    </Link>
  );
}

