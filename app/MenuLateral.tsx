"use client";
// FM RRHH — app/MenuLateral.tsx
// Barra superior + menú lateral del panel. Tres comportamientos:
//   - Escritorio: el botón ☰ lo achica a solo íconos (y se acuerda).
//   - Celular/tablet angosta: el menú es un cajón que se abre con ☰.
//   - El grupo de la pantalla actual arranca abierto; el resto, cerrados.
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import type { CategoriaMenu } from "@/lib/menu-estructura";

const CLAVE = "fm-menu-colapsado";

function esActivo(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

export default function MenuLateral({ categorias, usuario, children }: { categorias: CategoriaMenu[]; usuario: { nombre: string; rol: string }; children?: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const [colapsado, setColapsado] = useState(false);
  const [cajon, setCajon] = useState(false);
  const [abiertos, setAbiertos] = useState<Record<string, boolean>>({});

  // El estado colapsado ya lo aplicó al <body> el script de layout.tsx
  // (antes del primer pintado, para que no "salte"); acá solo se lee.
  useEffect(() => setColapsado(document.body.dataset.menu === "colapsado"), []);
  useEffect(() => setCajon(false), [pathname]);

  function alternar() {
    if (window.matchMedia("(max-width: 900px)").matches) {
      setCajon((v) => !v);
      return;
    }
    const nuevo = !colapsado;
    setColapsado(nuevo);
    document.body.dataset.menu = nuevo ? "colapsado" : "abierto";
    try { localStorage.setItem(CLAVE, nuevo ? "1" : "0"); } catch {}
  }

  const estaAbierto = (cat: CategoriaMenu) => abiertos[cat.categoria] ?? cat.items.some((i) => esActivo(pathname, i.href));

  return (
    <>
      <header className="ml-top">
        <button className="ml-burger" onClick={alternar} aria-label="Mostrar u ocultar el menú" aria-expanded={!colapsado}>
          <span /><span /><span />
        </button>
        <a href="/" className="ml-logo" aria-label="Inicio">
          <svg height={28} viewBox="0 0 220 60" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="FM Software">
            <rect x="2" y="8" width="30" height="40" rx="3" fill="none" stroke="#EEF1F4" strokeWidth="2.5" />
            <line x1="8" y1="18" x2="24" y2="18" stroke="#7FA8C6" strokeWidth="2" />
            <line x1="8" y1="24" x2="24" y2="24" stroke="#7FA8C6" strokeWidth="2" />
            <line x1="8" y1="30" x2="18" y2="30" stroke="#7FA8C6" strokeWidth="2" />
            <circle cx="26" cy="42" r="12" fill="#7FA8C6" />
            <path d="M 20 42 L 24.5 47 L 33 37" fill="none" stroke="#163A5C" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            <text x="44" y="38" fontFamily="Arial, sans-serif" fontWeight="800" fontSize="26" fill="#FFFFFF">FM</text>
            <text x="90" y="38" fontFamily="Arial, sans-serif" fontWeight="400" fontSize="26" fill="#7FA8C6">Software</text>
          </svg>
        </a>
        <div className="ml-top-der">
          {children}
          <span className="ml-usuario">{usuario.nombre} <span>({usuario.rol})</span></span>
          <a href="/api/logout" className="ml-salir">Salir</a>
        </div>
      </header>

      {cajon && <div className="ml-velo" onClick={() => setCajon(false)} />}

      <nav className={`ml-lado${cajon ? " abierto" : ""}`} aria-label="Módulos">
        <a href="/" className={`ml-item ml-inicio${pathname === "/" ? " activo" : ""}`} title="Inicio">
          <span className="ml-ico">🏠</span><span className="ml-txt">Inicio</span>
        </a>

        {categorias.map((cat, i) => {
          const abierto = estaAbierto(cat);
          const tieneActivo = cat.items.some((it) => esActivo(pathname, it.href));
          return (
            <div key={cat.categoria}>
              {(i === 0 || categorias[i - 1].bloque !== cat.bloque) && <div className="ml-bloque"><span>{cat.bloque}</span></div>}
              <button
                className={`ml-item ml-grupo${tieneActivo ? " con-activo" : ""}`}
                onClick={() => {
                  // Achicado no hay lugar para la lista: tocar un grupo vuelve a abrir el menú.
                  if (colapsado && !cajon) { alternar(); setAbiertos((a) => ({ ...a, [cat.categoria]: true })); return; }
                  setAbiertos((a) => ({ ...a, [cat.categoria]: !abierto }));
                }}
                aria-expanded={abierto}
                title={cat.categoria}
              >
                <span className="ml-ico">{cat.icono}</span>
                <span className="ml-txt">{cat.categoria}</span>
                <span className={`ml-flecha${abierto ? " abierta" : ""}`} aria-hidden="true">›</span>
              </button>
              {abierto && (
                <div className="ml-sub">
                  {cat.items.map((it) => (
                    <a key={it.href} href={it.href} className={`ml-subitem${esActivo(pathname, it.href) ? " activo" : ""}`} aria-current={esActivo(pathname, it.href) ? "page" : undefined}>
                      {it.label}
                    </a>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </>
  );
}
