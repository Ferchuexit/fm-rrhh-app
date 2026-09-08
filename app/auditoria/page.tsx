"use client";
import { useState, useEffect } from "react";

const ICONO: Record<string, string> = { rojo: "🔴", amarillo: "🟡", verde: "🟢" };
const COLOR: Record<string, string> = { rojo: "#B23A3A", amarillo: "#B8752B", verde: "#2F6F5E" };

function money(n: number) {
  return n.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function Metrica({ etiqueta, valor, variacionPct, formato }: { etiqueta: string; valor: number; variacionPct: number | null; formato: "moneda" | "numero" | "horas" }) {
  const texto = formato === "moneda" ? `$${money(valor)}` : formato === "horas" ? `${money(valor)} hs.` : money(valor);
  const signo = variacionPct === null ? "" : variacionPct > 0 ? "+" : "";
  const color = variacionPct === null ? "#666" : variacionPct > 0 ? "#B8752B" : variacionPct < 0 ? "#2F6F5E" : "#666";
  return (
    <div style={{ minWidth: "150px" }}>
      <div style={{ fontSize: "0.75rem", opacity: 0.6 }}>{etiqueta}</div>
      <div style={{ fontSize: "1.1rem", fontWeight: "bold" }}>{texto}</div>
      <div style={{ fontSize: "0.8rem", color }}>
        {variacionPct === null ? "sin período anterior" : `${signo}${variacionPct.toFixed(1)}%`}
      </div>
    </div>
  );
}

function ComparativaResultado({ data }: { data: any }) {
  return (
    <div style={{ marginTop: "0.8rem" }}>
      <p style={{ fontSize: "0.8rem", opacity: 0.7 }}>
        {data.periodoAnterior ? `${data.periodoAnterior.nombre} → ${data.periodoActual.nombre}` : `${data.periodoActual.nombre} (sin período anterior para comparar)`}
      </p>
      <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap" }}>
        <Metrica etiqueta="Dotación" valor={data.dotacion.actual} variacionPct={data.dotacion.variacionPct} formato="numero" />
        <Metrica etiqueta="Costo laboral" valor={data.costoLaboral.actual} variacionPct={data.costoLaboral.variacionPct} formato="moneda" />
        <Metrica etiqueta="Horas extra (importe)" valor={data.horasExtraImporte.actual} variacionPct={data.horasExtraImporte.variacionPct} formato="moneda" />
        <Metrica etiqueta="Horas de ausencia" valor={data.horasAusencia.actual} variacionPct={data.horasAusencia.variacionPct} formato="horas" />
      </div>
    </div>
  );
}

export default function AuditoriaPage() {
  const [periodoId, setPeriodoId] = useState("");
  const [periodos, setPeriodos] = useState<any[]>([]);
  const [resultado, setResultado] = useState<any>(null);
  const [cargando, setCargando] = useState(false);
  const [justificaciones, setJustificaciones] = useState<Record<string, string>>({});
  const [cierre, setCierre] = useState<any>(null);
  const [cerrando, setCerrando] = useState(false);
  const [estadoPeriodo, setEstadoPeriodo] = useState<string | null>(null);
  const [reabriendo, setReabriendo] = useState(false);

  const [resultadoPre, setResultadoPre] = useState<any>(null);
  const [cargandoPre, setCargandoPre] = useState(false);

  const [comparativa, setComparativa] = useState<any>(null);
  const [cargandoComparativa, setCargandoComparativa] = useState(false);

  const [aprobaciones, setAprobaciones] = useState<any[]>([]);
  const [observacionesAprobacion, setObservacionesAprobacion] = useState("");
  const [aprobando, setAprobando] = useState(false);

  useEffect(() => {
    fetch("/api/periodos").then((r) => r.json()).then((ps) => {
      setPeriodos(ps);
      const desdeUrl = new URLSearchParams(window.location.search).get("periodoId");
      setPeriodoId(desdeUrl && ps.some((p: any) => p.id === desdeUrl) ? desdeUrl : ps[0]?.id ?? "");
    });
  }, []);

  useEffect(() => {
    if (periodoId) cargarAprobaciones();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodoId]);

  async function auditarPreliquidacion() {
    if (!periodoId) return;
    setCargandoPre(true);
    const res = await fetch("/api/auditar-preliquidacion", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ periodoId }) });
    const data = await res.json().catch(() => null);
    setCargandoPre(false);
    if (!res.ok) { alert(data?.error ?? "No se pudo auditar."); return; }
    setResultadoPre(data);
  }

  async function cargarComparativa() {
    if (!periodoId) return;
    setCargandoComparativa(true);
    const res = await fetch(`/api/auditoria-comparativa?periodoId=${periodoId}`);
    const data = await res.json().catch(() => null);
    setCargandoComparativa(false);
    if (!res.ok) { alert(data?.error ?? "No se pudo calcular la comparación."); return; }
    setComparativa(data);
  }

  function cargarAprobaciones() {
    if (!periodoId) return;
    fetch(`/api/aprobar?periodoId=${periodoId}`).then((r) => r.json()).then(setAprobaciones);
  }

  async function registrarAprobacion(estado: string) {
    if ((estado === "aprobado_con_observaciones" || estado === "rechazado") && !observacionesAprobacion.trim()) {
      alert("Escribí el motivo antes de continuar.");
      return;
    }
    setAprobando(true);
    const res = await fetch("/api/aprobar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ periodoId, estado, observaciones: observacionesAprobacion }),
    });
    const data = await res.json().catch(() => null);
    setAprobando(false);
    if (!res.ok) { alert(data?.error ?? "No se pudo registrar."); return; }
    setObservacionesAprobacion("");
    cargarAprobaciones();
  }

  async function auditar() {
    if (!periodoId) return;
    setCargando(true);
    setCierre(null);
    setJustificaciones({});
    const res = await fetch("/api/auditar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ periodoId }) });
    let data;
    try {
      data = await res.json();
    } catch {
      setCargando(false);
      alert("El servidor no devolvió una respuesta válida.");
      return;
    }
    if (!res.ok) {
      setCargando(false);
      alert(data.error);
      return;
    }
    setResultado(data);
    const periodo = periodos.find((p: any) => p.id === periodoId);
    setEstadoPeriodo(periodo?.estado ?? null);
    setCargando(false);
  }

  async function cerrar() {
    setCerrando(true);
    const gruposRojos = resultado.resumen.filter((r: any) => r.severidad === "rojo");
    const justificacionesArray = gruposRojos.map((r: any) => ({ tipo: r.tipo, motivo: justificaciones[r.tipo] ?? "" }));
    const res = await fetch("/api/cerrar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ periodoId, justificaciones: justificacionesArray }),
    });
    const data = await res.json();
    setCierre(data);
    if (data.cerrado) setEstadoPeriodo("cerrada");
    setCerrando(false);
  }

  async function reabrir() {
    if (!confirm("¿Reabrir este período? Vas a poder volver a liquidar o borrar liquidaciones — usalo solo si necesitás corregir algo a propósito.")) return;
    setReabriendo(true);
    const res = await fetch("/api/cerrar", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ periodoId }),
    });
    const data = await res.json();
    setReabriendo(false);
    if (!res.ok) { alert(data.error); return; }
    setEstadoPeriodo("validada");
    setCierre(null);
  }

  return (
    <main>
      <h1>Auditoría del período</h1>

      <select
        value={periodoId}
        onChange={(e) => { setPeriodoId(e.target.value); setResultadoPre(null); setComparativa(null); }}
        style={{ marginRight: "0.5rem" }}
      >
        {periodos.length === 0 && <option value="">No hay períodos cargados todavía</option>}
        {periodos.map((p) => (
          <option key={p.id} value={p.id}>{p.nombre} ({p.estado})</option>
        ))}
      </select>

      {/* ── Preliquidación: reglas que NO necesitan liquidar todavía ── */}
      <div style={{ marginTop: "1rem", background: "white", padding: "1rem", border: "1px solid #dfe4e8" }}>
        <h3 style={{ marginTop: 0 }}>1. Preliquidación</h3>
        <p style={{ fontSize: "0.82rem", opacity: 0.7, marginTop: 0 }}>
          Corré esto <strong>antes</strong> de liquidar — chequea datos faltantes, CUIL, obra social y novedades, sin
          necesitar ningún resultado calculado todavía.
        </p>
        <button onClick={auditarPreliquidacion} disabled={cargandoPre}>
          {cargandoPre ? "Auditando..." : "Auditar preliquidación"}
        </button>
        {resultadoPre && (
          <div style={{ marginTop: "0.8rem" }}>
            <strong style={{ color: COLOR[resultadoPre.estadoGeneral] }}>
              {ICONO[resultadoPre.estadoGeneral]} {resultadoPre.mensajeGeneral}.
            </strong>
            {resultadoPre.resumen.length > 0 && (
              <ul style={{ fontSize: "0.85rem", paddingLeft: "1.2rem", marginTop: "0.5rem" }}>
                {resultadoPre.resumen.map((r: any, i: number) => (
                  <li key={i} style={{ color: COLOR[r.severidad] }}>{ICONO[r.severidad]} {r.mensaje}.</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* ── Post-liquidación: el motor completo, ya existía ── */}
      <div style={{ marginTop: "1rem", background: "white", padding: "1rem", border: "1px solid #dfe4e8" }}>
        <h3 style={{ marginTop: 0 }}>2. Post-liquidación</h3>
        <p style={{ fontSize: "0.82rem", opacity: 0.7, marginTop: 0 }}>
          Corré esto <strong>después</strong> de liquidar en <a href="/liquidacion-masiva">/liquidacion-masiva</a> — audita las
          liquidaciones que ya existen, no calcula nada nuevo.
        </p>
        <button onClick={auditar} disabled={cargando}>
          {cargando ? "Auditando..." : "Auditar período (motor real)"}
        </button>
      </div>

      {resultado && (
        <div style={{ marginTop: "1.5rem" }}>
          <div
            style={{
              border: `2px solid ${COLOR[resultado.estadoGeneral]}`,
              background: "white",
              padding: "1rem",
              marginBottom: "1rem",
            }}
          >
            <strong style={{ color: COLOR[resultado.estadoGeneral], fontSize: "1.1rem" }}>
              {ICONO[resultado.estadoGeneral]} {resultado.mensajeGeneral}.
            </strong>
          </div>

          {resultado.resumen.length === 0 ? (
            <p>Sin ninguna observación — nada para mostrar acá.</p>
          ) : (
            <ul style={{ paddingLeft: "1.2rem" }}>
              {resultado.resumen.map((r: any, i: number) => (
                <li key={i} style={{ marginBottom: "0.8rem" }}>
                  <div style={{ color: COLOR[r.severidad], fontWeight: "bold" }}>
                    {ICONO[r.severidad]} {r.mensaje}.
                  </div>
                  <ul style={{ fontSize: "0.85rem", opacity: 0.8 }}>
                    {r.detalle.map((d: any, j: number) => (
                      <li key={j}>{d.mensaje}</li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}

          <div style={{ marginTop: "1.5rem", background: "white", padding: "1rem", border: "1px solid #ddd" }}>
            <h3 style={{ marginTop: 0 }}>3. Auditoría comparativa</h3>
            <p style={{ fontSize: "0.82rem", opacity: 0.7, marginTop: 0 }}>
              Este período contra el anterior — dotación, costo laboral, horas extra, y horas de ausencia cargadas.
            </p>
            <button onClick={cargarComparativa} disabled={cargandoComparativa}>
              {cargandoComparativa ? "Calculando..." : "Comparar contra el período anterior"}
            </button>
            {comparativa && <ComparativaResultado data={comparativa} />}
          </div>

          <div style={{ marginTop: "1.5rem", background: "white", padding: "1rem", border: "1px solid #ddd" }}>
            <h3 style={{ marginTop: 0 }}>4. Aprobación</h3>
            <p style={{ fontSize: "0.82rem", opacity: 0.7, marginTop: 0 }}>
              Un rechazo bloquea el cierre hasta que se vuelva a aprobar. Si nunca usás este paso, no cambia nada de
              cómo cerrabas antes.
            </p>

            {aprobaciones.length > 0 && (
              <div style={{ marginBottom: "0.8rem", fontSize: "0.82rem" }}>
                <strong>Última:</strong>{" "}
                {aprobaciones[0].estado === "aprobado" && <span style={{ color: "#2F6F5E" }}>✔ Aprobado</span>}
                {aprobaciones[0].estado === "aprobado_con_observaciones" && <span style={{ color: "#B8752B" }}>⚠ Aprobado con observaciones</span>}
                {aprobaciones[0].estado === "rechazado" && <span style={{ color: "#B23A3A" }}>✕ Rechazado</span>}
                {" — "}{new Date(aprobaciones[0].fecha).toLocaleString("es-AR")}
                {aprobaciones[0].usuario && ` — ${aprobaciones[0].usuario}`}
                {aprobaciones[0].observaciones && <div style={{ opacity: 0.8, marginTop: "0.2rem" }}>"{aprobaciones[0].observaciones}"</div>}
              </div>
            )}

            <textarea
              value={observacionesAprobacion}
              onChange={(e) => setObservacionesAprobacion(e.target.value)}
              rows={2}
              placeholder="Observaciones (obligatorio para aprobar con observaciones o rechazar)"
              style={{ width: "100%", maxWidth: "500px", padding: "0.4rem", marginBottom: "0.5rem" }}
            />
            <div>
              <button onClick={() => registrarAprobacion("aprobado")} disabled={aprobando} style={{ marginRight: "0.5rem" }}>
                ✔ Aprobar
              </button>
              <button onClick={() => registrarAprobacion("aprobado_con_observaciones")} disabled={aprobando} style={{ marginRight: "0.5rem", background: "white", color: "#B8752B", border: "1px solid #B8752B" }}>
                ⚠ Aprobar con observaciones
              </button>
              <button onClick={() => registrarAprobacion("rechazado")} disabled={aprobando} style={{ background: "white", color: "#B23A3A", border: "1px solid #B23A3A" }}>
                ✕ Rechazar
              </button>
            </div>

            {aprobaciones.length > 1 && (
              <details style={{ marginTop: "0.8rem" }}>
                <summary style={{ fontSize: "0.78rem", opacity: 0.6, cursor: "pointer" }}>Historial ({aprobaciones.length})</summary>
                {aprobaciones.slice(1).map((a) => (
                  <div key={a.id} style={{ fontSize: "0.78rem", opacity: 0.6, padding: "0.2rem 0" }}>
                    {a.estado} — {new Date(a.fecha).toLocaleString("es-AR")}{a.usuario && ` — ${a.usuario}`}
                    {a.observaciones && ` — "${a.observaciones}"`}
                  </div>
                ))}
              </details>
            )}
          </div>

          <div style={{ marginTop: "1.5rem", background: "white", padding: "1rem", border: "1px solid #ddd" }}>
            {estadoPeriodo === "cerrada" ? (
              <div>
                <p style={{ color: "#2F6F5E", fontWeight: "bold" }}>
                  ✔ Período cerrado{cierre?.salvedadesAplicadas?.length ? " con salvedad" : ""}.
                </p>
                {cierre?.salvedadesAplicadas?.length > 0 && (
                  <ul style={{ fontWeight: "normal", fontSize: "0.85rem", marginTop: "0.5rem" }}>
                    {cierre.salvedadesAplicadas.map((s: any, i: number) => (
                      <li key={i}>
                        <strong>{s.tipo}</strong>: {s.motivo}
                      </li>
                    ))}
                  </ul>
                )}
                <p style={{ fontSize: "0.85rem", opacity: 0.7, marginTop: "0.5rem" }}>
                  Ya se puede exportar LSD y F.931 para este período en <a href="/exportar">/exportar</a>. Si
                  necesitás corregir algo, reabrilo primero — vas a poder volver a liquidar o borrar liquidaciones.
                </p>
                <button
                  onClick={reabrir}
                  disabled={reabriendo}
                  style={{ background: "white", color: "#B23A3A", border: "1px solid #B23A3A", marginTop: "0.5rem" }}
                >
                  {reabriendo ? "Reabriendo..." : "Reabrir período"}
                </button>
              </div>
            ) : resultado.puedeCerrar ? (
              <>
                <button onClick={cerrar} disabled={cerrando}>
                  {cerrando ? "Cerrando..." : "Cerrar período"}
                </button>
                {cierre && cierre.cerrado === false && cierre.error && (
                  <p style={{ color: "#B23A3A", fontSize: "0.85rem" }}>{cierre.error}</p>
                )}
              </>
            ) : (
              <>
                <p style={{ color: "#B23A3A" }}>
                  Hay alertas rojas — para cerrar igual, justificá cada una (mínimo 15 caracteres, "ok" no alcanza):
                </p>
                {resultado.resumen
                  .filter((r: any) => r.severidad === "rojo")
                  .map((r: any) => (
                    <div key={r.tipo} style={{ marginBottom: "0.75rem" }}>
                      <label style={{ display: "block", fontSize: "0.85rem", color: "#B23A3A", marginBottom: "0.25rem" }}>
                        🔴 {r.mensaje}.
                      </label>
                      <textarea
                        value={justificaciones[r.tipo] ?? ""}
                        onChange={(e) => setJustificaciones({ ...justificaciones, [r.tipo]: e.target.value })}
                        rows={2}
                        style={{ width: "100%", maxWidth: "500px", padding: "0.4rem" }}
                        placeholder="Explicá por qué esta alerta no impide cerrar el período..."
                      />
                    </div>
                  ))}
                <button onClick={cerrar} disabled={cerrando}>
                  {cerrando ? "Cerrando..." : "Cerrar con salvedad"}
                </button>
                {cierre && cierre.cerrado === false && cierre.error && (
                  <p style={{ color: "#B23A3A", fontSize: "0.85rem" }}>{cierre.error}</p>
                )}
                {cierre && cierre.cerrado === false && cierre.pendientes && (
                  <p style={{ color: "#B23A3A", fontSize: "0.85rem" }}>
                    Faltan justificar: {cierre.pendientes?.map((p: any) => p.tipo).join(", ")}
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
