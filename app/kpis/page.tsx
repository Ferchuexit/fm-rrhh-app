// FM RRHH — app/kpis/page.tsx
// KPIs de asistencia (ausentismo, puntualidad, motivos, ranking) — vivía
// como panel colapsable dentro de /asistencia, se mudó acá a pedido de
// Fernando para que quede junto al resto de Reportes (Dashboard, Costo
// laboral, Protecciones). El endpoint (/api/asistencia/kpis) no cambió.
"use client";
import { useState, useEffect, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

function fechaISO(d: Date) {
  return d.toISOString().substring(0, 10);
}
function primerYUltimoDiaMes(anio: number, mes: number) {
  const primero = new Date(Date.UTC(anio, mes - 1, 1));
  const ultimo = new Date(Date.UTC(anio, mes, 0));
  return { desde: fechaISO(primero), hasta: fechaISO(ultimo) };
}

export default function KpisPage() {
  const hoy = new Date();

  const [modo, setModo] = useState<"quincena" | "mes" | "rango">("mes");
  const [periodos, setPeriodos] = useState<any[]>([]);
  const [periodoId, setPeriodoId] = useState("");
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [mes, setMes] = useState(hoy.getMonth() + 1);
  const [rangoDesde, setRangoDesde] = useState(fechaISO(hoy));
  const [rangoHasta, setRangoHasta] = useState(fechaISO(hoy));
  const [convenios, setConvenios] = useState<any[]>([]);
  const [convenioId, setConvenioId] = useState("");

  const [kpis, setKpis] = useState<any>(null);
  const [cargando, setCargando] = useState(false);

  // ── Reporte de asistencia diaria por mail ──
  const [panelReporteAbierto, setPanelReporteAbierto] = useState(false);
  const [fechaReporte, setFechaReporte] = useState(fechaISO(hoy));
  const [destinatarios, setDestinatarios] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [resultadoEnvio, setResultadoEnvio] = useState<any>(null);

  async function enviarReporte() {
    setEnviando(true);
    setResultadoEnvio(null);
    const lista = destinatarios.split(",").map((s) => s.trim()).filter(Boolean);
    try {
      const res = await fetch("/api/reportes/asistencia-diaria", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fecha: fechaReporte, destinatarios: lista }),
      });
      const data = await res.json();
      setResultadoEnvio(res.ok ? { ok: true, ...data } : { ok: false, error: data.error });
    } catch {
      setResultadoEnvio({ ok: false, error: "El servidor no devolvió una respuesta válida." });
    } finally {
      setEnviando(false);
    }
  }

  useEffect(() => {
    fetch("/api/periodos").then((r) => r.json()).then(setPeriodos);
    fetch("/api/convenios").then((r) => r.json()).then(setConvenios);
  }, []);

  const { desde, hasta } = useMemo(() => {
    if (modo === "quincena") {
      const p = periodos.find((p) => p.id === periodoId);
      if (!p) return { desde: "", hasta: "" };
      return { desde: p.fechaDesde.substring(0, 10), hasta: p.fechaHasta.substring(0, 10) };
    }
    if (modo === "mes") return primerYUltimoDiaMes(anio, mes);
    return { desde: rangoDesde, hasta: rangoHasta };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modo, periodoId, anio, mes, rangoDesde, rangoHasta, periodos.length]);

  useEffect(() => {
    if (!desde || !hasta) { setKpis(null); return; }
    setCargando(true);
    const params = new URLSearchParams({ desde, hasta });
    if (convenioId) params.set("convenioId", convenioId);
    fetch(`/api/asistencia/kpis?${params}`)
      .then((r) => r.json())
      .then(setKpis)
      .catch(() => setKpis({ error: "El servidor no devolvió una respuesta válida." }))
      .finally(() => setCargando(false));
  }, [desde, hasta, convenioId]);

  return (
    <main>
      <h1>KPIs de asistencia</h1>
      <p style={{ opacity: 0.7, marginTop: "-0.5rem" }}>
        Ausentismo, puntualidad y motivos, calculados desde el calendario de <a href="/asistencia">/asistencia</a>.
      </p>

      <div style={{ background: "white", border: "1px solid #dfe4e8", padding: "1rem", marginBottom: "1.25rem", display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "flex-end" }}>
        <label>Ver por<br />
          <select value={modo} onChange={(e) => setModo(e.target.value as any)}>
            <option value="mes">Mes completo</option>
            <option value="quincena">Quincena (período existente)</option>
            <option value="rango">Rango personalizado</option>
          </select>
        </label>

        {modo === "mes" && (
          <>
            <label>Mes<br />
              <select value={mes} onChange={(e) => setMes(Number(e.target.value))}>
                {["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"].map((n, i) => (
                  <option key={i} value={i + 1}>{n}</option>
                ))}
              </select>
            </label>
            <label>Año<br /><input type="number" value={anio} onChange={(e) => setAnio(Number(e.target.value))} style={{ width: "80px" }} /></label>
          </>
        )}

        {modo === "quincena" && (
          <label>Período<br />
            <select value={periodoId} onChange={(e) => setPeriodoId(e.target.value)}>
              <option value="">Elegir...</option>
              {periodos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </label>
        )}

        {modo === "rango" && (
          <>
            <label>Desde<br /><input type="date" value={rangoDesde} onChange={(e) => setRangoDesde(e.target.value)} /></label>
            <label>Hasta<br /><input type="date" value={rangoHasta} onChange={(e) => setRangoHasta(e.target.value)} /></label>
          </>
        )}

        <label>Convenio<br />
          <select value={convenioId} onChange={(e) => setConvenioId(e.target.value)}>
            <option value="">Todos</option>
            {convenios.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </label>
      </div>

      {/* ── Reporte de asistencia diaria por mail ── */}
      <div style={{ marginBottom: "1.25rem" }}>
        <button onClick={() => setPanelReporteAbierto(!panelReporteAbierto)} style={{ background: "white", color: "var(--azul-oscuro)", border: "1px solid #dfe4e8" }}>
          {panelReporteAbierto ? "▾" : "▸"} 📧 Reporte de asistencia diaria (PDF por mail)
        </button>
        {panelReporteAbierto && (
          <div style={{ background: "white", border: "1px solid #dfe4e8", borderTop: "none", padding: "1rem" }}>
            <p style={{ fontSize: "0.85rem", opacity: 0.7, marginTop: 0 }}>
              Pensado para Dirección/Producción: cuánta gente hay disponible hoy, quién falta, y por qué convenio. Necesita <code>RESEND_API_KEY</code> configurado en <code>.env.local</code> — ver el comentario en <code>lib/email.ts</code>.
            </p>
            <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "flex-end" }}>
              <label>Fecha<br /><input type="date" value={fechaReporte} onChange={(e) => setFechaReporte(e.target.value)} /></label>
              <label>Destinatarios (separados por coma)<br />
                <input type="text" placeholder="direccion@empresa.com, produccion@empresa.com" value={destinatarios} onChange={(e) => setDestinatarios(e.target.value)} style={{ width: "320px" }} />
              </label>
              <a href={`/api/reportes/asistencia-diaria?fecha=${fechaReporte}`} target="_blank" rel="noreferrer">
                <button type="button">Ver PDF</button>
              </a>
              <button onClick={enviarReporte} disabled={enviando || !destinatarios.trim()}>
                {enviando ? "Enviando..." : "Enviar por mail"}
              </button>
            </div>
            {resultadoEnvio && (
              resultadoEnvio.ok
                ? <p style={{ color: "var(--verde)", fontSize: "0.85rem", marginTop: "0.6rem" }}>✔ Enviado correctamente.</p>
                : <p style={{ color: "var(--rojo)", fontSize: "0.85rem", marginTop: "0.6rem" }}>{resultadoEnvio.error}</p>
            )}
          </div>
        )}
      </div>

      {cargando && <p style={{ opacity: 0.6 }}>Calculando...</p>}
      {kpis?.error && <p style={{ color: "var(--rojo)" }}>{kpis.error}</p>}
      {kpis?.sinDatos && <p style={{ opacity: 0.7, fontStyle: "italic" }}>No hay asistencia clasificada todavía para este rango — cargala en <a href="/asistencia">/asistencia</a> primero.</p>}

      {kpis && !kpis.sinDatos && !kpis.error && (
        <>
          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginBottom: "1.5rem" }}>
            <TarjetaKpi
              titulo="Ausentismo"
              valor={kpis.ausentismo.pct !== null ? `${kpis.ausentismo.pct.toFixed(1)}%` : "—"}
              detalle={`${kpis.ausentismo.diasAusencia} de ${kpis.ausentismo.diasLaborables} días laborables`}
              color={kpis.ausentismo.pct !== null && kpis.ausentismo.pct > 10 ? "var(--rojo)" : "var(--verde)"}
            />
            <TarjetaKpi
              titulo="Puntualidad"
              valor={kpis.puntualidad.pctPuntual !== null ? `${kpis.puntualidad.pctPuntual.toFixed(1)}%` : "—"}
              detalle={`${kpis.puntualidad.diasTarde} llegadas tarde, ${kpis.puntualidad.diasSalidaAnticipada} salidas antes`}
              color="var(--azul-oscuro)"
            />
            <TarjetaKpi
              titulo="Ausencias con aviso"
              valor={kpis.aviso.pctConAviso !== null ? `${kpis.aviso.pctConAviso.toFixed(1)}%` : "—"}
              detalle={`${kpis.aviso.diasAA} avisadas, ${kpis.aviso.diasA} sin aviso`}
              color="var(--ambar)"
            />
            {kpis.puntualidad.promedioMinutosTarde !== null && (
              <TarjetaKpi titulo="Promedio de tardanza" valor={`${kpis.puntualidad.promedioMinutosTarde} min`} detalle="cuando llega tarde" color="var(--ambar)" />
            )}
          </div>

          {(kpis.calidadDatos.diasImpar > 0 || kpis.calidadDatos.diasSinTurno > 0) && (
            <p style={{ fontSize: "0.85rem", color: "var(--rojo)", marginBottom: "1.5rem" }}>
              ⚠ Antes de confiar del todo en estos números: {kpis.calidadDatos.diasImpar > 0 && `${kpis.calidadDatos.diasImpar} día(s) con fichada impar (${kpis.calidadDatos.legajosConImpar} legajo(s))`}
              {kpis.calidadDatos.diasImpar > 0 && kpis.calidadDatos.diasSinTurno > 0 && " y "}
              {kpis.calidadDatos.diasSinTurno > 0 && `${kpis.calidadDatos.diasSinTurno} día(s) sin turno cargado (${kpis.calidadDatos.legajosConSinTurno} legajo(s))`} — revisalos en <a href="/asistencia">/asistencia</a>.
            </p>
          )}

          <div style={{ display: "flex", gap: "2rem", flexWrap: "wrap" }}>
            {kpis.motivos.length > 0 && (
              <div>
                <h4 style={{ marginBottom: "0.5rem" }}>Motivos (días)</h4>
                <BarChart width={340} height={Math.max(140, kpis.motivos.length * 34)} data={kpis.motivos} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" fontSize={11} allowDecimals={false} />
                  <YAxis type="category" dataKey="tipo" width={120} fontSize={11} />
                  <Tooltip />
                  <Bar dataKey="dias" fill="#B8752B" />
                </BarChart>
              </div>
            )}

            <div>
              <h4 style={{ marginBottom: "0.5rem" }}>Ausentismo por día de semana</h4>
              <BarChart width={340} height={200} data={kpis.porDiaSemana}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="dia" fontSize={10} tickFormatter={(d: string) => d.substring(0, 3)} />
                <YAxis fontSize={11} unit="%" />
                <Tooltip formatter={(v: number) => `${v.toFixed(1)}%`} />
                <Bar dataKey="pct" fill="#163A5C" />
              </BarChart>
            </div>

            {kpis.porConvenio && kpis.porConvenio.length > 1 && (
              <div>
                <h4 style={{ marginBottom: "0.5rem" }}>Ausentismo por convenio</h4>
                <BarChart width={340} height={Math.max(140, kpis.porConvenio.length * 40)} data={kpis.porConvenio} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" fontSize={11} unit="%" />
                  <YAxis type="category" dataKey="convenio" width={140} fontSize={11} />
                  <Tooltip formatter={(v: number) => `${v.toFixed(1)}%`} />
                  <Bar dataKey="pct" fill="#B23A3A" />
                </BarChart>
              </div>
            )}
          </div>

          {kpis.rankingAusencias.length > 0 && (
            <div style={{ marginTop: "1.5rem" }}>
              <h4 style={{ marginBottom: "0.5rem" }}>Legajos con más ausencias (sin aviso + con aviso)</h4>
              <table style={{ fontSize: "0.85rem", maxWidth: "420px" }}>
                <thead><tr><th>Legajo</th><th>Días ausente</th></tr></thead>
                <tbody>
                  {kpis.rankingAusencias.map((r: any) => (
                    <tr key={r.numero}>
                      <td>{r.numero} — {r.apellido}, {r.nombre}</td>
                      <td style={{ textAlign: "center" }}>{r.dias}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </main>
  );
}

function TarjetaKpi({ titulo, valor, detalle, color }: { titulo: string; valor: string; detalle: string; color: string }) {
  return (
    <div style={{ background: "var(--gris-claro)", padding: "0.8rem 1.1rem", minWidth: "180px" }}>
      <p style={{ margin: 0, fontSize: "0.78rem", opacity: 0.7 }}>{titulo}</p>
      <p style={{ margin: "0.2rem 0", fontSize: "1.6rem", fontWeight: 700, color }}>{valor}</p>
      <p style={{ margin: 0, fontSize: "0.75rem", opacity: 0.6 }}>{detalle}</p>
    </div>
  );
}
