// FM RRHH — app/Nav.tsx
// Barra fija arriba de cada pantalla. Server Component async — lee la
// sesión actual directo (Node runtime, puede usar next/headers sin problema,
// a diferencia del middleware). Si no hay sesión, no muestra los módulos —
// tiene sentido igual, porque sin sesión el middleware ya te mandó a /login
// antes de que esta barra llegue a renderizarse para cualquier página que
// no sea /login.
//
// Los desplegables por categoría usan <details>/<summary>, el widget nativo
// del navegador — ni un componente cliente, ni una línea de JavaScript
// propia. Se abren y cierran solos, funcionan sin hidratación.
import LogoFM from "./LogoFM";
import EmpresaSelector from "./EmpresaSelector";
import { obtenerSesionActual } from "@/lib/auth";
import { menuFiltradoPorRol } from "@/lib/menu-estructura";

export default async function Nav() {
  const sesion = await obtenerSesionActual();
  const categorias = sesion ? menuFiltradoPorRol(sesion.rol) : [];

  return (
    <nav
      style={{
        background: "#163A5C",
        padding: "0.5rem 1.5rem",
        display: "flex",
        alignItems: "center",
        gap: "0.25rem",
        flexWrap: "wrap",
        position: "sticky",
        top: 0,
        zIndex: 10,
        borderBottom: "3px solid #7FA8C6",
      }}
    >
      <a href="/" style={{ display: "flex", alignItems: "center", marginRight: "0.75rem" }}>
        <LogoFmNav />
      </a>

      {categorias.map((cat) => (
        <details key={cat.categoria} style={{ position: "relative" }}>
          <summary
            style={{
              listStyle: "none",
              cursor: "pointer",
              color: "#cfe0ee",
              fontSize: "0.85rem",
              padding: "0.4rem 0.6rem",
              borderRadius: "3px",
            }}
          >
            {cat.categoria}
          </summary>
          <div
            style={{
              position: "absolute",
              top: "100%",
              left: 0,
              background: "white",
              border: "1px solid #dfe4e8",
              borderRadius: "4px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
              minWidth: "200px",
              zIndex: 20,
              padding: "0.3rem 0",
            }}
          >
            {cat.items.map((item) => (
              <a
                key={item.href + item.label}
                href={item.href}
                style={{
                  display: "block",
                  padding: "0.5rem 0.9rem",
                  color: "#163A5C",
                  textDecoration: "none",
                  fontSize: "0.85rem",
                  whiteSpace: "nowrap",
                }}
              >
                {item.icono} {item.label}
              </a>
            ))}
          </div>
        </details>
      ))}

      <span style={{ marginLeft: "auto", fontSize: "0.8rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
        {sesion && <EmpresaSelector />}
        {sesion ? (
          <span style={{ color: "#cfe0ee" }}>
            {sesion.nombre} <span style={{ opacity: 0.6 }}>({sesion.rol})</span> ·{" "}
            <a href="/api/logout" style={{ color: "white" }}>Salir</a>
          </span>
        ) : (
          <a href="/login" style={{ color: "white" }}>Iniciar sesión</a>
        )}
      </span>
    </nav>
  );
}

// Versión del logo para fondo oscuro (la barra es azul oscuro, así que acá
// el wordmark "FM" va en blanco en vez de azul oscuro, para que se lea).
function LogoFmNav() {
  return (
    <svg height={30} viewBox="0 0 220 60" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="FM Software">
      <rect x="2" y="8" width="30" height="40" rx="3" fill="none" stroke="#EEF1F4" strokeWidth="2.5" />
      <line x1="8" y1="18" x2="24" y2="18" stroke="#7FA8C6" strokeWidth="2" />
      <line x1="8" y1="24" x2="24" y2="24" stroke="#7FA8C6" strokeWidth="2" />
      <line x1="8" y1="30" x2="18" y2="30" stroke="#7FA8C6" strokeWidth="2" />
      <circle cx="26" cy="42" r="12" fill="#7FA8C6" />
      <path d="M 20 42 L 24.5 47 L 33 37" fill="none" stroke="#163A5C" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <text x="44" y="38" fontFamily="Arial, sans-serif" fontWeight="800" fontSize="26" fill="#FFFFFF">FM</text>
      <text x="90" y="38" fontFamily="Arial, sans-serif" fontWeight="400" fontSize="26" fill="#7FA8C6">Software</text>
    </svg>
  );
}
