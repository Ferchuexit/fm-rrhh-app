// FM RRHH — app/portal/biblioteca/page.tsx
// La Librería: lo que el empleado puede consultar, con buscador. La
// búsqueda se hace en el servidor (incluye lo que dicen los PDF por dentro).
import { redirect } from "next/navigation";
import { obtenerSesionPortal } from "@/lib/portal";
import { articulosPara, buscar, porCategoria, emojiDeCategoria } from "@/lib/biblioteca";

export const dynamic = "force-dynamic";

export default async function PortalBiblioteca({ searchParams }: { searchParams: { q?: string } }) {
  const sesion = await obtenerSesionPortal();
  if (!sesion) redirect("/portal/login");
  const articulos = await articulosPara(sesion.legajoId);
  const q = String(searchParams.q ?? "").trim().slice(0, 80);
  const resultados = q ? buscar(articulos, q) : null;
  const destacados = articulos.filter((a) => a.destacado);
  const tipo = (a: { archivoMime: string | null; enlace: string | null; contenido: string | null }) => (a.archivoMime === "application/pdf" ? "PDF" : a.archivoMime ? "Imagen" : a.enlace && !a.contenido ? "Enlace" : null);
  const fila = (a: (typeof articulos)[number], sub?: string | null) => (
    <a key={a.id} href={`/portal/biblioteca/${a.id}`} style={{ display: "flex", gap: "0.7rem", alignItems: "center", padding: "0.65rem 0.9rem", borderBottom: "1px solid var(--gris-claro)", textDecoration: "none" }}>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontWeight: 600, color: "#12202e" }}>{a.titulo}</span>
        {sub && <span style={{ display: "block", fontSize: "0.82rem", color: "#6b727b", overflowWrap: "anywhere" }}>{sub}</span>}
      </span>
      {tipo(a) && <span className="p-chip info">{tipo(a)}</span>}
      <span style={{ color: "#6b727b" }} aria-hidden="true">›</span>
    </a>
  );

  return (
    <>
      <h1>Librería</h1>
      <form method="get" role="search" style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
        <input name="q" defaultValue={q} placeholder="Buscar: vacaciones, evacuación, seccionadora…" aria-label="Buscar en la librería" style={{ flex: 1, minWidth: 0, padding: "0.75rem 0.9rem", fontSize: "1rem", border: "1px solid #b9c4cd", borderRadius: 8 }} />
        <button type="submit" style={{ padding: "0 1rem", borderRadius: 8, border: 0, background: "var(--azul-oscuro)", color: "#fff", fontWeight: 700 }}>Buscar</button>
      </form>

      {articulos.length === 0 && <p className="p-sub">Todavía no hay material cargado.</p>}

      {resultados && (
        <>
          <p className="p-sub">{resultados.length === 0 ? `No encontramos nada con "${q}". Probá con otra palabra, o preguntale a RR.HH. por el chat.` : `${resultados.length} ${resultados.length === 1 ? "resultado" : "resultados"} para "${q}"`} · <a href="/portal/biblioteca">Ver todo</a></p>
          {resultados.length > 0 && <div className="p-card" style={{ padding: 0 }}>{resultados.map((r) => fila(r.articulo, r.fragmento ?? `${emojiDeCategoria(r.articulo.categoria)} ${r.articulo.categoria}`))}</div>}
          {resultados.length === 0 && <a href="/portal/chat" className="p-btn sec">Preguntarle a RR.HH.</a>}
        </>
      )}

      {!resultados && (
        <>
          {destacados.length > 0 && (
            <>
              <h2>⭐ Lo más importante</h2>
              <div className="p-card" style={{ padding: 0 }}>{destacados.map((a) => fila(a, `${emojiDeCategoria(a.categoria)} ${a.categoria}`))}</div>
            </>
          )}
          {porCategoria(articulos).map((g) => (
            <div key={g.categoria}>
              <h2>{g.emoji} {g.categoria}</h2>
              <div className="p-card" style={{ padding: 0 }}>{g.articulos.map((a) => fila(a))}</div>
            </div>
          ))}
        </>
      )}
    </>
  );
}
