import type { ReactNode } from "react";
import "./admin-ui.css";
import "./admin-fixes.css";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
