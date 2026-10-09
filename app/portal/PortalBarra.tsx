"use client";
import { usePathname } from "next/navigation";

// Íconos dibujados a mano (trazo simple) — sin sumar una librería de íconos.
const ICONOS: Record<string, React.ReactNode> = {
  inicio: <path d="M3 11.5 12 4l9 7.5M5.5 10v9.5h13V10" />,
  recibos: <><path d="M6 3h9l4 4v14H6z" /><path d="M14.5 3v4.5H19M9 12h7M9 16h7" /></>,
  vacaciones: <><rect x="3.5" y="5" width="17" height="15.5" rx="2" /><path d="M3.5 10h17M8 3v4M16 3v4" /></>,
};

const ITEMS = [
  { href: "/portal", label: "Inicio", ico: "inicio", activa: (p: string) => p === "/portal" },
  { href: "/portal/recibos", label: "Recibos", ico: "recibos", activa: (p: string) => p.startsWith("/portal/recibos") },
  { href: "/portal/vacaciones", label: "Vacaciones", ico: "vacaciones", activa: (p: string) => p.startsWith("/portal/vacaciones") },
];

export default function PortalBarra() {
  const pathname = usePathname() ?? "";
  return (
    <nav className="portal-barra" aria-label="Secciones del portal">
      <div className="portal-barra-in">
        {ITEMS.map((t) => (
          <a key={t.href} href={t.href} className={t.activa(pathname) ? "activa" : ""} aria-current={t.activa(pathname) ? "page" : undefined}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICONOS[t.ico]}</svg>
            {t.label}
          </a>
        ))}
      </div>
    </nav>
  );
}
