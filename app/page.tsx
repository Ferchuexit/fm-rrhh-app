import LogoFM from "./LogoFM";
import { obtenerSesionActual } from "@/lib/auth";
import { menuFiltradoPorRol } from "@/lib/menu-estructura";

export default async function Home() {
  const sesion = await obtenerSesionActual();
  const categorias = sesion ? menuFiltradoPorRol(sesion.rol) : [];

  return (
    <main>
      <div style={{ textAlign: "center", padding: "2rem 0 1rem" }}>
        <LogoFM height={52} />
        <p style={{ color: "#4A4F58", marginTop: "0.75rem" }}>
          Sistema de liquidación y gestión de RRHH — Maestros, Novedades, Liquidaciones, Procesos, Salidas, Reportes y Administración
        </p>
      </div>

      <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
        {categorias.map((cat) => (
          <div key={cat.categoria} style={{ marginBottom: "2rem" }}>
            <h2 style={{ fontSize: "1rem", color: "#163A5C", borderBottom: "2px solid #7FA8C6", paddingBottom: "0.3rem", marginBottom: "0.85rem" }}>
              {cat.categoria}
            </h2>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                gap: "1rem",
              }}
            >
              {cat.items.map((m) => (
                <a
                  key={m.href + m.label}
                  href={m.href}
                  style={{
                    display: "block",
                    background: "white",
                    border: "1px solid #dfe4e8",
                    borderTop: "4px solid #163A5C",
                    borderRadius: "4px",
                    padding: "1.25rem 1rem",
                    textDecoration: "none",
                    color: "#163A5C",
                    transition: "transform 0.12s ease, box-shadow 0.12s ease",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                  }}
                  className="modulo-card"
                >
                  <div style={{ fontSize: "1.8rem", marginBottom: "0.5rem" }}>{m.icono}</div>
                  <div style={{ fontWeight: 700, fontSize: "1.05rem" }}>{m.label}</div>
                  <div style={{ fontSize: "0.8rem", color: "#4A4F58", marginTop: "0.25rem" }}>{m.desc}</div>
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>

      <style>{`
        .modulo-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 10px rgba(22,58,92,0.15);
          border-top-color: #7FA8C6;
        }
      `}</style>
    </main>
  );
}
