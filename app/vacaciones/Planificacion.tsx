"use client";
// FM RRHH — app/vacaciones/Planificacion.tsx
// "¿Cómo queda este rango de fechas?": gente afuera a la vez y costo
// estimado contra un presupuesto. Es la pantalla para decidir si se aprueba
// un pedido de vacaciones.
import { useEffect, useState } from "react";

const pesos = (n: number) => n.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
const dia = (iso: string) => new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
const caja: React.CSSProperties = { background: "#F5F7F9", border: "1px solid #dfe4e8", padding: "0.7rem 0.9rem", minWidth: "170px", flex: 1 };
const rotulo: React.CSSProperties = { fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.04em", color: "#6b727b" };
const numero: React.CSSProperties = { fontSize: "1.5rem", fontWeight: 700, color: "#163A5C", fontVariantNumeric: "tabular-nums" };
const CLAVE_PRESUPUESTO = "fm-presupuesto-planificacion";

export default function Planificacion({ centros }: { centros: { id: string; nombre: string }[] }) {
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [centro, setCentro] = useState("");
  const [presupuesto, setPresupuesto] = useState("");
  const [conPendientes, setConPendientes] = useState(true);
  const [datos, setDatos] = useState<any>(null);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  async function calcular(d = desde, h = hasta, c = centro) {
    if (!d || !h) { setError("Completá las dos fechas."); return; }
    setCargando(true);
    setError("");
    try {
      const res = await fetch(`/api/vacaciones/planificacion?desde=${d}&hasta=${h}${c ? `&centroCostoId=${c}` : ""}`);
      const data = await res.json().catch(() => ({ error: "El servidor no devolvió una respuesta válida." }));
      if (!res.ok) { setError(data.error ?? "No se pudo calcular."); setDatos(null); } else setDatos(data);
    } catch {
      setError("No hay conexión. Probá de nuevo.");
    }
    setCargando(false);
  }

  // Desde Solicitudes se llega con las fechas del pedido ya puestas. Si no,
  // arranca con el mes que viene, que es lo que normalmente se planifica.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const hoy = new Date();
    const d = q.get("desde") ?? new Date(Date.UTC(hoy.getFullYear(), hoy.getMonth() + 1, 1)).toISOString().slice(0, 10);
    const h = q.get("hasta") ?? new Date(Date.UTC(hoy.getFullYear(), hoy.getMonth() + 2, 0)).toISOString().slice(0, 10);
    setDesde(d);
    setHasta(h);
    try { setPresupuesto(localStorage.getItem(CLAVE_PRESUPUESTO) ?? ""); } catch {}
    calcular(d, h, "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function cambiarPresupuesto(v: string) {
    setPresupuesto(v);
    try { localStorage.setItem(CLAVE_PRESUPUESTO, v); } catch {}
  }

  const campo = conPendientes ? "conPendientes" : "firmes";
  const pico = datos?.pico[campo];
  const costo = datos?.costos?.[campo];
  const tope = Number(presupuesto) || 0;
  const diasVac = datos ? datos.diasVacaciones.firmes + (conPendientes ? datos.diasVacaciones.pendientes : 0) : 0;
  const liquidadoTotal = (datos?.liquidado ?? []).reduce((a: number, p: any) => a + p.bruto, 0);

  return (
    <div id="planificacion" style={{ background: "white", border: "1px solid #dfe4e8", padding: "1rem", marginBottom: "1.5rem", maxWidth: "900px" }}>
      <h3 style={{ marginTop: 0 }}>Planificación entre fechas</h3>
      <p style={{ fontSize: "0.85rem", marginTop: 0 }}>Cuánta gente hay afuera a la vez y cuánto cuesta el rango, para decidir un pedido.</p>

      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "flex-end" }}>
        <label>Desde<br /><input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} /></label>
        <label>Hasta<br /><input type="date" value={hasta} min={desde} onChange={(e) => setHasta(e.target.value)} /></label>
        <label>Centro de costo<br />
          <select value={centro} onChange={(e) => setCentro(e.target.value)}>
            <option value="">Todos</option>
            {centros.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </label>
        <button onClick={() => calcular()} disabled={cargando}>{cargando ? "Calculando…" : "Calcular"}</button>
        <label style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.85rem" }}>
          <input type="checkbox" checked={conPendientes} onChange={(e) => setConPendientes(e.target.checked)} />
          Contar también los pedidos sin responder
        </label>
      </div>
      {error && <p style={{ color: "#B23A3A" }}>{error}</p>}

      {datos && (
        <>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginTop: "1rem" }}>
            <div style={caja}>
              <div style={rotulo}>Dotación</div>
              <div style={numero}>{datos.dotacion}</div>
              <div style={{ fontSize: "0.8rem" }}>personas activas</div>
            </div>
            <div style={caja}>
              <div style={rotulo}>Máximo afuera a la vez</div>
              <div style={{ ...numero, color: datos.dotacion && pico.cantidad / datos.dotacion >= 0.3 ? "#B23A3A" : "#163A5C" }}>
                {pico.cantidad}{datos.dotacion > 0 && pico.cantidad > 0 ? <span style={{ fontSize: "0.9rem", fontWeight: 400 }}> · {Math.round((pico.cantidad / datos.dotacion) * 100)}%</span> : null}
              </div>
              <div style={{ fontSize: "0.8rem" }}>{pico.fecha ? `desde el ${dia(pico.fecha)}` : "nadie de vacaciones"}</div>
            </div>
            <div style={caja}>
              <div style={rotulo}>Días de vacaciones</div>
              <div style={numero}>{diasVac}</div>
              <div style={{ fontSize: "0.8rem" }}>
                {datos.diasVacaciones.firmes} aprobados{datos.diasVacaciones.pendientes > 0 ? ` · ${datos.diasVacaciones.pendientes} sin responder` : ""}
              </div>
            </div>
          </div>

          {costo ? (
            <div style={{ marginTop: "1rem", borderTop: "1px solid #EEF1F4", paddingTop: "0.9rem" }}>
              <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "stretch" }}>
                <div style={caja}>
                  <div style={rotulo}>Masa salarial del rango</div>
                  <div style={numero}>{pesos(costo.masa)}</div>
                  <div style={{ fontSize: "0.8rem" }}>bruta, estimada, {datos.diasDelRango} días</div>
                </div>
                <div style={caja}>
                  <div style={rotulo}>Vacaciones del rango</div>
                  <div style={numero}>{pesos(costo.vacaciones)}</div>
                  <div style={{ fontSize: "0.8rem" }}>lo que se paga por esos {diasVac} días</div>
                </div>
                <div style={caja}>
                  <div style={rotulo}>Total con vacaciones</div>
                  <div style={numero}>{pesos(costo.total)}</div>
                  <div style={{ fontSize: "0.8rem" }}>masa + {pesos(costo.adicional)} de plus vacacional</div>
                </div>
              </div>

              <div style={{ marginTop: "0.9rem", display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
                <label>Presupuesto aprobado para el rango: $ <input type="number" min="0" value={presupuesto} onChange={(e) => cambiarPresupuesto(e.target.value)} style={{ width: "150px" }} /></label>
                {tope > 0 && (
                  <strong style={{ color: costo.total > tope ? "#B23A3A" : "#2F6F5E" }}>
                    {costo.total > tope ? `Se pasa por ${pesos(costo.total - tope)}` : `Dentro del presupuesto: quedan ${pesos(tope - costo.total)}`}
                    {" "}({Math.round((costo.total / tope) * 100)}% usado)
                  </strong>
                )}
              </div>

              {datos.liquidado.length > 0 && (
                <p style={{ fontSize: "0.85rem", marginBottom: 0 }}>
                  <strong>Ya liquidado</strong> en períodos cerrados que tocan el rango: <strong>{pesos(liquidadoTotal)}</strong>{" "}
                  ({datos.liquidado.map((p: any) => `${p.nombre}: ${pesos(p.bruto)}`).join(" · ")}).
                </p>
              )}
              <p style={{ fontSize: "0.75rem", color: "#6b727b", marginBottom: 0 }}>
                Importes brutos, sin contribuciones patronales. Es una estimación: toma la última liquidación cerrada de cada persona como sueldo de referencia
                y paga el día de vacaciones a sueldo ÷ 25. No reemplaza a la liquidación.
                {datos.costos.sinSueldo > 0 ? ` ${datos.costos.sinSueldo} ${datos.costos.sinSueldo === 1 ? "persona no tiene" : "personas no tienen"} liquidaciones cerradas y no ${datos.costos.sinSueldo === 1 ? "entra" : "entran"} en los importes.` : ""}
              </p>
            </div>
          ) : (
            <p style={{ fontSize: "0.8rem", color: "#6b727b" }}>Los importes los ve quien tiene acceso a Liquidaciones.</p>
          )}

          {datos.personas.length > 0 && (
            <table style={{ marginTop: "1rem" }}>
              <thead><tr><th>Legajo</th><th>Empleado</th><th>Sector</th><th>Días aprobados</th><th>Días sin responder</th>{costo && <th>Costo de sus vacaciones</th>}</tr></thead>
              <tbody>
                {datos.personas.map((p: any) => (
                  <tr key={p.id}>
                    <td>{p.numero}</td><td>{p.apellido}, {p.nombre}</td><td>{p.sector}</td><td>{p.diasFirmes || ""}</td><td>{p.diasPendientes || ""}</td>
                    {costo && <td>{p.costo ? pesos(p.costo[campo].vacaciones) : "sin sueldo de referencia"}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
}
