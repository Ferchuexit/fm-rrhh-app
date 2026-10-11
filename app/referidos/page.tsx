"use client";
// FM RRHH — app/referidos/page.tsx
// Programa de referidos: cuánta gente recomiendan los empleados, cuántos
// entran, quiénes recomiendan, y los premios que falta entregar.
import { useEffect, useState } from "react";

type Ref = { id: string; nombre: string; etapa: string; createdAt: string; por: string | null; relacion: string | null; busquedaId: string; busqueda: string; premio: string | null; premioEntregadoEn: string | null };
type Datos = { abiertas: { id: string; titulo: string; referidos: boolean; premioReferido: string | null }[]; resumen: { total: number; contratados: number; enProceso: number; efectividad: number | null; premiosPendientes: number; quienes: { clave: string; nombre?: string; referidos: number; contratados: number }[] }; referidos: Ref[] };

const caja: React.CSSProperties = { background: "white", border: "1px solid #dfe4e8", padding: "1rem", marginBottom: "1rem", maxWidth: "960px" };
const numero = (n: string | number, rotulo: string, color = "#163A5C") => <div style={{ textAlign: "center", minWidth: 110 }}><div style={{ fontSize: "1.6rem", fontWeight: 700, color }}>{n}</div><div style={{ fontSize: "0.8rem", color: "#4A4F58" }}>{rotulo}</div></div>;
const dia = (iso: string) => new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit", timeZone: "America/Argentina/Buenos_Aires" });
const NOMBRE_ETAPA: Record<string, string> = { postulado: "Sin revisar", preseleccion: "Preselección", entrevista: "Entrevista", preocupacional: "Preocupacional", oferta: "Oferta", contratado: "Ingresó", descartado: "No avanzó" };
const COLOR_ETAPA: Record<string, string> = { contratado: "#2F6F5E", descartado: "#6b727b", postulado: "#8a5413" };

export default function ReferidosPage() {
  const [datos, setDatos] = useState<Datos | null>(null);
  const [error, setError] = useState("");
  const [soloPremios, setSoloPremios] = useState(false);

  async function cargar() {
    const res = await fetch("/api/referidos");
    const d = await res.json().catch(() => ({ error: "El servidor no devolvió una respuesta válida." }));
    if (!res.ok) { setError(d.error ?? "No se pudo cargar."); return; }
    setError("");
    setDatos(d);
  }
  useEffect(() => { cargar(); }, []);

  async function premio(r: Ref, entregado: boolean) {
    const res = await fetch("/api/referidos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: r.id, entregado }) });
    if (!res.ok) setError((await res.json().catch(() => ({}))).error ?? "No se pudo guardar.");
    cargar();
  }

  const r = datos?.resumen;
  const lista = (datos?.referidos ?? []).filter((x) => !soloPremios || (x.etapa === "contratado" && x.premio && !x.premioEntregadoEn));
  const conReferidos = (datos?.abiertas ?? []).filter((b) => b.referidos);

  return (
    <main>
      <h1>Programa de referidos</h1>
      <p style={{ maxWidth: "860px" }}>
        Los empleados recomiendan gente para las búsquedas abiertas desde el portal. El recomendado entra a <a href="/reclutamiento">Reclutamiento</a> como un candidato más, con el nombre de quien lo recomendó,
        y pasa por el mismo proceso. Quien recomienda ve cómo sigue (sin el detalle interno) y recibe un aviso si su recomendado ingresa.
      </p>
      {error && <p style={{ color: "#B23A3A" }}>{error}</p>}
      {!datos && !error && <p>Cargando…</p>}
      {datos && r && (
        <>
          <div style={{ ...caja, display: "flex", gap: "1.2rem", flexWrap: "wrap", alignItems: "center" }}>
            {numero(r.total, "recomendados")}
            {numero(r.enProceso, "en proceso", "#8a5413")}
            {numero(r.contratados, "ingresaron", "#2F6F5E")}
            {numero(r.efectividad === null ? "—" : `${r.efectividad}%`, "de los recomendados ingresa")}
            {numero(r.premiosPendientes, "premios por entregar", r.premiosPendientes > 0 ? "#B23A3A" : "#163A5C")}
          </div>

          <div style={caja}>
            <strong style={{ color: "#163A5C" }}>Búsquedas abiertas</strong>
            {datos.abiertas.length === 0 ? <p style={{ margin: "0.3rem 0 0", color: "#6b727b" }}>No hay búsquedas abiertas.</p> : (
              <ul style={{ margin: "0.4rem 0 0", paddingLeft: "1.2rem" }}>
                {datos.abiertas.map((b) => <li key={b.id}><a href="/reclutamiento">{b.titulo}</a> — {b.referidos ? <><strong style={{ color: "#2F6F5E" }}>acepta referidos</strong>{b.premioReferido ? ` · premio: ${b.premioReferido}` : " · sin premio"}</> : <span style={{ color: "#6b727b" }}>no acepta referidos</span>}</li>)}
              </ul>
            )}
            <p style={{ fontSize: "0.82rem", color: "#6b727b", margin: "0.5rem 0 0" }}>Se activa en cada búsqueda (Reclutamiento → Editar el aviso → "Aceptar referidos de los empleados"). {conReferidos.length === 0 && datos.abiertas.length > 0 && "Hoy ninguna lo tiene activado: los empleados no ven nada para recomendar."}</p>
          </div>

          {r.quienes.length > 0 && (
            <div style={caja}>
              <strong style={{ color: "#163A5C" }}>Quiénes recomiendan</strong>
              <table style={{ marginTop: "0.4rem" }}><thead><tr><th>Empleado</th><th>Recomendó</th><th>Ingresaron</th></tr></thead>
                <tbody>{r.quienes.map((q) => <tr key={q.clave}><td>{q.nombre}</td><td>{q.referidos}</td><td>{q.contratados > 0 ? <strong style={{ color: "#2F6F5E" }}>{q.contratados}</strong> : 0}</td></tr>)}</tbody>
              </table>
            </div>
          )}

          <div style={caja}>
            <strong style={{ color: "#163A5C" }}>Recomendados ({lista.length})</strong>{" "}
            <label style={{ marginLeft: 12, fontSize: "0.88rem" }}><input type="checkbox" checked={soloPremios} onChange={(e) => setSoloPremios(e.target.checked)} style={{ marginRight: 5 }} />Solo premios por entregar</label>
            {lista.length === 0 ? <p style={{ margin: "0.4rem 0 0", color: "#6b727b" }}>{soloPremios ? "No hay premios pendientes." : "Todavía nadie recomendó a nadie."}</p> : (
              <table style={{ marginTop: "0.4rem" }}>
                <thead><tr><th>Fecha</th><th>Recomendado</th><th>Búsqueda</th><th>Lo recomendó</th><th>Estado</th><th>Premio</th></tr></thead>
                <tbody>
                  {lista.map((x) => (
                    <tr key={x.id}>
                      <td>{dia(x.createdAt)}</td>
                      <td><strong>{x.nombre}</strong></td>
                      <td>{x.busqueda}</td>
                      <td>{x.por}{x.relacion && <span style={{ color: "#6b727b", fontSize: "0.82rem" }}><br />{x.relacion}</span>}</td>
                      <td style={{ color: COLOR_ETAPA[x.etapa] ?? "#163A5C", fontWeight: 600 }}>{NOMBRE_ETAPA[x.etapa] ?? x.etapa}</td>
                      <td>{!x.premio ? <span style={{ color: "#6b727b" }}>—</span> : x.etapa !== "contratado" ? <span style={{ color: "#6b727b" }}>{x.premio}</span> : <label><input type="checkbox" checked={!!x.premioEntregadoEn} onChange={(e) => premio(x, e.target.checked)} style={{ marginRight: 5 }} />{x.premio}{x.premioEntregadoEn && <span style={{ color: "#2F6F5E" }}> · entregado el {dia(x.premioEntregadoEn)}</span>}</label>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </main>
  );
}
