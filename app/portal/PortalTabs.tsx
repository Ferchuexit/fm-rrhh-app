"use client";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/portal", label: "Recibos", activa: (p: string) => p === "/portal" || p.startsWith("/portal/recibos") },
  { href: "/portal/vacaciones", label: "Vacaciones y permisos", activa: (p: string) => p.startsWith("/portal/vacaciones") },
];

export default function PortalTabs() {
  const pathname = usePathname() ?? "";
  return (
    <nav className="portal-tabs" aria-label="Secciones del portal">
      <div className="portal-tabs-in">
        {TABS.map((t) => (
          <a key={t.href} href={t.href} className={t.activa(pathname) ? "activa" : ""} aria-current={t.activa(pathname) ? "page" : undefined}>
            {t.label}
          </a>
        ))}
      </div>
    </nav>
  );
}
