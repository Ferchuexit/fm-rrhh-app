"use client";
import { useState, useEffect } from "react";
import { picoPorSemana } from "@/lib/planificacion-reglas";
import Planificacion from "./Planificacion";

const ANIO_ACTUAL = new Date().getFullYear();

function diasPorAntiguedad(antiguedadAnios: number) {
  if (antiguedadAnios < 5) return 14;
  if (antiguedadAnios < 10) return 21;
  if (antiguedadAnios < 20) return 28;
  return 35;
}

export default function VacacionesPage() {
  const [legajos, setLegajos] = useState<any[]>([]);
  const [vacaciones, setVacaciones] = useState<any[]>([]);
  const [pendientes, setPendientes] = useState<any[]>([]);
  const [centros, setCentros] = useState<any[]>([]);
  const [error, setError] = useState("");

  const [f, setF] = useState({ legajoId: "", anioCorresponde: ANIO_ACTUAL, fechaDesde: "", fechaHasta: "", diasCorresponden: "" });

  // ── Gantt ──
  const [ganttAnio, setGanttAnio] = useState(ANIO_ACTUAL);
  const [ganttCentro, setGanttCentro] = useState("");
  const [ganttData, setGanttData] = useState<any>(null);

  async function cargarTodo() {
    const [lRes, vRes, pRes, cRes] = await Promise.all([
      fetch("/api/legajos").then((r) => r.json()),
      fetch("/api/vacaciones").then((r) => r.json()),
      fetch(`/api/vacaciones/pendientes?anio=${ANIO_ACTUAL}`).then((r) => r.json()),
      fetch("/api/centros-costo").then((r) => r.json()),
    ]);
    setLegajos(lRes);
    setVacaciones(vRes);
    setPendientes(pRes.pendientes ?? []);
    setCentros(cRes);
  }

  useEffect(() => {
    cargarTodo();
  }, []);

  async function cargarGantt() {
    const url = `/api/vacaciones/gantt?anio=${ganttAnio}${ganttCentro ? `&centroCostoId=${ganttCentro}` : ""}`;
    const res = await fetch(url);
    setGanttData(await res.json());
  }

  useEffect(() => {
    cargarGantt();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ganttAnio, ganttCentro]);

  async function onLegajoChange(legajoId: string) {
    setF({ ...f, legajoId });
    if (!legajoId) return;
    const legajo = await fetch(`/api/legajos/${legajoId}`).then((r) => r.json());
    const fechaBase = legajo.antiguedadReconocida ?? legajo.fechaIngreso;
    const antiguedadAnios = (new Date(f.fechaDesde || Date.now()).getTime() - new Date(fechaBase).getTime()) / (365.25 * 24 * 3600 * 1000);
    setF((prev) => ({ ...prev, legajoId, diasCorresponden: String(diasPorAntiguedad(antiguedadAnios)) }));
  }

  async function registrar() {
    setError("");
    const res = await fetch("/api/vacaciones", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...f, diasCorresponden: f.diasCorresponden ? Number(f.diasCorresponden) : undefined }),
    });
    let data;
    try {
      data = await res.json();
    } catch {
      setError("El servidor no devolvió una respuesta válida — mirá la terminal donde corre npm run dev para ver el error real.");
      return;
    }
    if (!res.ok) {
      setError(data.error);
      return;
    }
    setF({ legajoId: "", anioCorresponde: ANIO_ACTUAL, fechaDesde: "", fechaHasta: "", diasCorresponden: "" });
    cargarTodo();
    cargarGantt();
  }

  // ── Render del Gantt: barras posicionadas por % del año ──
  function posicionEnAnio(fecha: string, anio: number) {
    const inicio = Date.UTC(anio, 0, 1);
    const fin = Date.UTC(anio + 1, 0, 1); // el 31/12 entero entra en el dibujo
    const pct = ((new Date(fecha).getTime() - inicio) / (fin - inicio)) * 100;
    return Math.min(100, Math.max(0, pct));
  }

  return (
    <main>
      <h1>Vacaciones</h1>

      {/* ── Alta ── */}
      <div style={{ background: "white", border: "1px solid #dfe4e8", padding: "1rem", marginBottom: "1.5rem", maxWidth: "700px" }}>
        <h3 style={{ marginTop: 0 }}>Otorgar / registrar período vacacional</h3>
        <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", alignItems: "flex-end" }}>
          <label>
            Legajo<br />
            <select value={f.legajoId} onChange={(e) => onLegajoChange(e.target.value)}>
              <option value="">Elegir...</option>
              {legajos.map((l) => <option key={l.id} value={l.id}>{l.numero} — {l.apellido}, {l.nombre}</option>)}
            </select>
          </label>
          <label>
            Año corresponde<br />
            <input type="number" value={f.anioCorresponde} onChange={(e) => setF({ ...f, anioCorresponde: Number(e.target.value) })} style={{ width: "90px" }} />
          </label>
          <label>
            Fecha desde<br />
            <input type="date" value={f.fechaDesde} onChange={(e) => setF({ ...f, fechaDesde: e.target.value })} />
          </label>
          <label>
            Fecha hasta<br />
            <input type="date" value={f.fechaHasta} onChange={(e) => setF({ ...f, fechaHasta: e.target.value })} />
          </label>
          <label>
            Días<br />
            <input type="number" value={f.diasCorresponden} onChange={(e) => setF({ ...f, diasCorresponden: e.target.value })} style={{ width: "70px" }} />
          </label>
          <button onClick={registrar}>Registrar</button>
        </div>
        <p style={{ fontSize: "0.75rem", opacity: 0.6, marginBottom: 0 }}>
          Los días se sugieren solos según la antigüedad (Art. 150 LCT — 14/21/28/35 según corresponda), editables antes de guardar.
        </p>
        {error && <p style={{ color: "#B23A3A" }}>{error}</p>}
      </div>

      {/* ── Pendientes ── */}
      <div style={{ marginBottom: "1.5rem" }}>
        <h3>Pendientes ({ANIO_ACTUAL})</h3>
        {pendientes.length === 0 ? (
          <p style={{ opacity: 0.6 }}>Nadie tiene vacaciones pendientes de registrar para {ANIO_ACTUAL}.</p>
        ) : (
          <table>
            <thead><tr><th>Legajo</th><th>Centro de costo</th><th>Corresponden</th><th>Registrados</th><th>Pendientes</th></tr></thead>
            <tbody>
              {pendientes.map((p) => (
                <tr key={p.legajoId}>
                  <td>{p.numero} — {p.apellido}, {p.nombre}</td>
                  <td>{p.centroCosto ?? "—"}</td>
                  <td>{p.diasCorresponden}</td>
                  <td>{p.diasRegistrados}</td>
                  <td style={{ color: "#B8752B", fontWeight: "bold" }}>{p.diasPendientes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Histórico ── */}
      <div style={{ marginBottom: "2rem" }}>
        <h3>Histórico</h3>
        <table>
          <thead><tr><th>Legajo</th><th>Año</th><th>Desde</th><th>Hasta</th><th>Días</th><th>Notificación</th></tr></thead>
          <tbody>
            {vacaciones.map((v) => (
              <tr key={v.id}>
                <td>{v.legajo.numeroLegajo} — {v.legajo.apellido}, {v.legajo.nombre}</td>
                <td>{v.anioCorresponde}</td>
                <td>{v.fechaDesde.slice(0, 10)}</td>
                <td>{v.fechaHasta.slice(0, 10)}</td>
                <td>{v.diasCorresponden}</td>
                <td><a href={`/api/vacaciones/notificacion?vacacionId=${v.id}`}>Descargar PDF</a></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Planificacion centros={centros} />

      {/* ── Gantt ── */}
      <div>
        <h3>Diagrama de Gantt</h3>
        <div style={{ marginBottom: "0.75rem" }}>
          <label>
            Año:{" "}
            <input type="number" value={ganttAnio} onChange={(e) => setGanttAnio(Number(e.target.value))} style={{ width: "80px" }} />
          </label>{" "}
          <label>
            Centro de costo:{" "}
            <select value={ganttCentro} onChange={(e) => setGanttCentro(e.target.value)}>
              <option value="">Todos</option>
              {centros.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </label>
        </div>

        {ganttData && (() => {
          const dotacion = ganttData.legajos.length;
          const ausencias = ganttData.legajos.flatMap((l: any) => [
            ...l.vacaciones.map((v: any) => ({ legajoId: l.id, desde: new Date(v.fechaDesde), hasta: new Date(v.fechaHasta) })),
            ...(l.pendientes ?? []).map((v: any) => ({ legajoId: l.id, desde: new Date(v.fechaDesde), hasta: new Date(v.fechaHasta), pendiente: true })),
          ]);
          const semanas = picoPorSemana(ganttAnio, ausencias);
          const peor = Math.max(0, ...semanas.map((x) => x.firmes));
          const corta = (d: Date) => d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", timeZone: "UTC" });
          const barra = (v: any, i: number, pendiente: boolean) => {
            const izq = posicionEnAnio(v.fechaDesde, ganttAnio);
            const der = posicionEnAnio(new Date(new Date(v.fechaHasta).getTime() + 24 * 3600 * 1000).toISOString(), ganttAnio);
            return (
              <div
                key={(pendiente ? "p" : "v") + i}
                title={`${pendiente ? "Pedido sin responder · " : ""}${v.dias} días — ${v.fechaDesde.slice(0, 10)} a ${v.fechaHasta.slice(0, 10)}`}
                style={{
                  position: "absolute", left: `${izq}%`, width: `${Math.max(0.5, der - izq)}%`, height: "100%", borderRadius: "2px",
                  background: pendiente ? "repeating-linear-gradient(45deg, #E8B36B, #E8B36B 4px, #fdf1e1 4px, #fdf1e1 8px)" : "#7FA8C6",
                }}
              />
            );
          };
          return (
            <div style={{ background: "white", border: "1px solid #dfe4e8", padding: "1rem", maxWidth: "900px" }}>
              <p style={{ margin: "0 0 0.75rem", fontSize: "0.85rem" }}>
                <strong>{dotacion}</strong> {dotacion === 1 ? "persona" : "personas"} en este filtro · semana con más gente afuera: <strong>{peor}</strong>
                {dotacion > 0 && peor > 0 ? ` (${Math.round((peor / dotacion) * 100)}% de la dotación)` : ""}
                <span style={{ marginLeft: "1rem", color: "#6b727b" }}>
                  <span style={{ display: "inline-block", width: 12, height: 10, background: "#7FA8C6", marginRight: 4 }} />aprobadas
                  <span style={{ display: "inline-block", width: 12, height: 10, background: "repeating-linear-gradient(45deg, #E8B36B, #E8B36B 3px, #fdf1e1 3px, #fdf1e1 6px)", margin: "0 4px 0 12px" }} />pedidos sin responder
                </span>
              </p>

              {/* Meses */}
              <div style={{ display: "flex", alignItems: "center" }}>
                <div style={{ width: "180px", flexShrink: 0 }} />
                <div style={{ display: "flex", flex: 1, fontSize: "0.68rem", color: "#6b727b" }}>
                  {["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"].map((m, i) => (
                    <div key={m} style={{ width: `${(new Date(Date.UTC(ganttAnio, i + 1, 0)).getUTCDate() / (ganttAnio % 4 === 0 ? 366 : 365)) * 100}%`, borderLeft: "1px solid #dfe4e8", paddingLeft: 2 }}>{m}</div>
                  ))}
                </div>
              </div>

              {/* Cuánta gente hay afuera cada semana (el peor día de la semana) */}
              <div style={{ display: "flex", alignItems: "center", margin: "0.2rem 0 0.6rem" }}>
                <div style={{ width: "180px", fontSize: "0.8rem", flexShrink: 0, fontWeight: 600, color: "#163A5C" }}>Gente afuera por semana</div>
                <div style={{ display: "flex", flex: 1, height: "22px" }}>
                  {semanas.map((x, i) => {
                    const parte = dotacion ? x.firmes / dotacion : 0;
                    const fondo = x.firmes === 0 ? "#EEF1F4" : parte >= 0.3 ? "#B23A3A" : parte >= 0.15 ? "#B8752B" : "#2F6F5E";
                    const mas = x.conPendientes - x.firmes;
                    return (
                      <div
                        key={i}
                        title={`Semana del ${corta(x.desde)} al ${corta(x.hasta)}: hasta ${x.firmes} afuera a la vez${mas > 0 ? `; ${x.conPendientes} si se aprueban los pedidos sin responder` : ""}`}
                        style={{
                          flex: 1, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.68rem", fontWeight: 700,
                          color: x.firmes === 0 ? "#8a5413" : "white", background: fondo, borderRight: "1px solid white",
                          boxShadow: mas > 0 ? "inset 0 -3px 0 #E8B36B" : undefined,
                        }}
                      >
                        {x.firmes > 0 ? x.firmes : mas > 0 ? `+${mas}` : ""}
                      </div>
                    );
                  })}
                </div>
              </div>

              {ganttData.legajos.map((l: any) => (
                <div key={l.id} style={{ display: "flex", alignItems: "center", marginBottom: "0.4rem" }}>
                  <div style={{ width: "180px", fontSize: "0.8rem", flexShrink: 0 }}>
                    {l.numero} — {l.apellido} <span style={{ opacity: 0.5 }}>({l.centroCosto})</span>
                  </div>
                  <div style={{ position: "relative", flex: 1, height: "18px", background: "#EEF1F4" }}>
                    {(l.pendientes ?? []).map((v: any, i: number) => barra(v, i, true))}
                    {l.vacaciones.map((v: any, i: number) => barra(v, i, false))}
                  </div>
                </div>
              ))}
              {dotacion === 0 && <p style={{ opacity: 0.6 }}>No hay legajos para este filtro.</p>}
              <p style={{ margin: "0.75rem 0 0", fontSize: "0.75rem", color: "#6b727b" }}>
                El número de cada semana es el máximo de personas afuera el mismo día. Verde: menos del 15% de la dotación · naranja: 15% o más · rojo: 30% o más.
                La raya naranja debajo marca semanas con pedidos sin responder.
              </p>
            </div>
          );
        })()}
      </div>
    </main>
  );
}
