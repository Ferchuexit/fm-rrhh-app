"use client";
// FM RRHH — app/indicadores/page.tsx
// Tablero de indicadores de Gestión Humana. No se carga nada acá: cada
// número sale de lo que ya está en los otros módulos, y cada bloque lleva
// al módulo donde se resuelve.
//
// Criterios de los gráficos: un solo eje por gráfico (nunca dos escalas),
// leyenda siempre que hay más de una serie, colores fijos por tipo, los
// colores de estado (bien / atención / crítico) reservados para el semáforo
// y siempre con ícono y palabra, y "Ver datos" con la tabla detrás.
import { useEffect, useState } from "react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend, ResponsiveContainer, ReferenceLine } from "recharts";

type Conteo = { clave: string; nombre: string; cantidad: number };
type Estado = "bien" | "atencion" | "critico" | "sin_dato";
type Ref = { bien: number; atencion: number; mayorEsMejor: boolean; texto: string };
type D = any; // la forma completa está en lib/indicadores.ts

// Serie 1..5 de la paleta categórica (validada para daltonismo) y un azul
// único para magnitudes.
const SERIE = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4"];
const AZUL = "#2a78d6";
const TINTA = "#12202e", SUAVE = "#6b727b", GRILLA = "#e6eaee";
const ESTADO: Record<Estado, { color: string; icono: string; texto: string }> = {
  bien: { color: "#0ca30c", icono: "●", texto: "Bien" },
  atencion: { color: "#fab219", icono: "▲", texto: "Atención" },
  critico: { color: "#d03b3b", icono: "◆", texto: "Crítico" },
  sin_dato: { color: "#9aa3ab", icono: "○", texto: "Sin datos" },
};
const AUSENCIAS = [["injustificada", "Sin aviso"], ["aviso", "Con aviso"], ["enfermedad", "Enfermedad"], ["art", "Accidente (ART)"], ["suspension", "Suspensión"]] as const;

const semaforo = (v: number | null, r: Ref): Estado => (v === null ? "sin_dato" : r.mayorEsMejor ? (v >= r.bien ? "bien" : v >= r.atencion ? "atencion" : "critico") : v <= r.bien ? "bien" : v <= r.atencion ? "atencion" : "critico");
const num = (v: number | null | undefined, sufijo = "") => (v === null || v === undefined ? "—" : `${v.toLocaleString("es-AR")}${sufijo}`);
const caja: React.CSSProperties = { background: "white", border: "1px solid #dfe4e8", padding: "1rem 1.1rem", marginBottom: "1rem" };
const btnSec: React.CSSProperties = { background: "white", color: "#163A5C", border: "1px solid #163A5C" };
const ejes = { tick: { fontSize: 12, fill: SUAVE }, axisLine: { stroke: GRILLA }, tickLine: false } as const;

// En la leyenda, el color lo lleva el cuadradito; el texto va en tinta.
const leyenda = (valor: string) => <span style={{ color: TINTA }}>{valor}</span>;

function Chip({ estado }: { estado: Estado }) {
  const e = ESTADO[estado];
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: "0.75rem", fontWeight: 700, color: TINTA, whiteSpace: "nowrap" }}><span aria-hidden="true" style={{ color: e.color, fontSize: "0.9rem" }}>{e.icono}</span>{e.texto}</span>;
}
// Un número grande con su semáforo (si tiene referencia) y una línea de contexto.
function Dato({ titulo, valor, estado, nota, href }: { titulo: string; valor: string; estado?: Estado; nota?: React.ReactNode; href?: string }) {
  const adentro = (
    <>
      <div style={{ fontSize: "0.8rem", color: SUAVE, display: "flex", justifyContent: "space-between", gap: 8 }}><span>{titulo}</span>{estado && <Chip estado={estado} />}</div>
      <div style={{ fontSize: "1.75rem", fontWeight: 700, color: valor === "—" ? "#9aa3ab" : "#163A5C", lineHeight: 1.2 }}>{valor}</div>
      {nota && <div style={{ fontSize: "0.8rem", color: SUAVE }}>{nota}</div>}
    </>
  );
  const estilo: React.CSSProperties = { flex: "1 1 170px", minWidth: 160, background: "white", border: "1px solid #dfe4e8", borderTop: `3px solid ${estado ? ESTADO[estado].color : "#c3d0da"}`, padding: "0.7rem 0.9rem", textDecoration: "none", display: "block" };
  return href ? <a href={href} style={estilo}>{adentro}</a> : <div style={estilo}>{adentro}</div>;
}
// Barras horizontales para rankings: el nombre a la izquierda, la barra y el número.
function Barras({ datos, color = AZUL, sufijo = "", max }: { datos: { nombre: string; valor: number; detalle?: string }[]; color?: string; sufijo?: string; max?: number }) {
  const tope = max ?? Math.max(1, ...datos.map((d) => d.valor));
  if (datos.length === 0) return <p style={{ color: SUAVE, margin: "0.3rem 0 0", fontSize: "0.9rem" }}>Sin datos en el período.</p>;
  return (
    <div style={{ marginTop: "0.4rem" }}>
      {datos.map((d) => (
        <div key={d.nombre} title={`${d.nombre}: ${d.valor}${sufijo}${d.detalle ? ` · ${d.detalle}` : ""}`} style={{ display: "flex", alignItems: "center", gap: "0.6rem", fontSize: "0.88rem", marginBottom: 5 }}>
          <span style={{ width: 190, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: TINTA }}>{d.nombre}</span>
          <span style={{ flex: 1, background: "#f1f4f6", height: 14, borderRadius: 4 }}><span style={{ display: "block", width: `${Math.max(1.5, (d.valor / tope) * 100)}%`, background: color, height: 14, borderRadius: "0 4px 4px 0" }} /></span>
          <span style={{ width: 92, flexShrink: 0, textAlign: "right", color: TINTA, fontVariantNumeric: "tabular-nums" }}>{d.valor.toLocaleString("es-AR")}{sufijo}{d.detalle && <span style={{ color: SUAVE }}> {d.detalle}</span>}</span>
        </div>
      ))}
    </div>
  );
}
// Un gráfico con título, y la tabla de los mismos datos a un clic.
function Grafico({ titulo, sub, filas, columnas, alto = 230, children }: { titulo: string; sub?: string; filas: Record<string, any>[]; columnas: [string, string][]; alto?: number; children: React.ReactElement }) {
  const [tabla, setTabla] = useState(false);
  return (
    <div style={{ flex: "1 1 420px", minWidth: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
        <div><strong style={{ color: TINTA, fontSize: "0.95rem" }}>{titulo}</strong>{sub && <div style={{ fontSize: "0.8rem", color: SUAVE }}>{sub}</div>}</div>
        <button onClick={() => setTabla(!tabla)} className="no-imprimir" style={{ ...btnSec, padding: "0.1rem 0.5rem", fontSize: "0.75rem" }}>{tabla ? "Ver gráfico" : "Ver datos"}</button>
      </div>
      {tabla ? (
        <table style={{ marginTop: "0.5rem", fontSize: "0.85rem" }}><thead><tr>{columnas.map(([, n]) => <th key={n}>{n}</th>)}</tr></thead><tbody>{filas.map((f, i) => <tr key={i}>{columnas.map(([k]) => <td key={k}>{f[k] ?? "—"}</td>)}</tr>)}</tbody></table>
      ) : <div style={{ height: alto, marginTop: "0.4rem" }}><ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer></div>}
    </div>
  );
}
function Seccion({ titulo, href, enlace, children }: { titulo: string; href?: string; enlace?: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: "1.6rem", breakInside: "avoid" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, borderBottom: "2px solid #163A5C", marginBottom: "0.7rem" }}>
        <h2 style={{ margin: 0, fontSize: "1.15rem" }}>{titulo}</h2>
        {href && <a href={href} className="no-imprimir" style={{ fontSize: "0.85rem" }}>{enlace ?? "Ir al módulo"} ›</a>}
      </div>
      {children}
    </section>
  );
}
const SinDatos = ({ children }: { children: React.ReactNode }) => <p style={{ ...caja, color: SUAVE, margin: 0 }}>{children}</p>;
const fila: React.CSSProperties = { display: "flex", gap: "0.7rem", flexWrap: "wrap", marginBottom: "0.8rem" };
const dos: React.CSSProperties = { ...caja, display: "flex", gap: "2rem", flexWrap: "wrap" };

export default function IndicadoresPage() {
  const [datos, setDatos] = useState<D | null>(null);
  const [error, setError] = useState("");
  const [meses, setMeses] = useState(12);
  const [sector, setSector] = useState("");
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    setCargando(true);
    fetch(`/api/indicadores?meses=${meses}${sector ? `&sector=${sector}` : ""}`).then(async (res) => {
      const d = await res.json().catch(() => ({ error: "El servidor no devolvió una respuesta válida." }));
      if (!res.ok) setError(d.error ?? "No se pudo cargar."); else { setError(""); setDatos(d); }
      setCargando(false);
    });
  }, [meses, sector]);

  const d = datos, R = d?.referencias as Record<string, Ref> | undefined;
  const periodo = meses === 12 ? "últimos 12 meses" : `últimos ${meses} meses`;
  const fecha = (iso: string) => new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "long", timeZone: "UTC" });
  const lista = (c: Conteo[] | undefined) => (c ?? []).map((x) => ({ nombre: x.nombre, valor: x.cantidad }));

  return (
    <main>
      <style>{`@media print { .no-imprimir, nav, aside, header { display: none !important; } main { padding: 0 !important; } }`}</style>
      <h1>Tablero de Gestión Humana</h1>
      <p style={{ maxWidth: "900px" }}>
        Los indicadores de RR.HH. en un solo lugar, calculados con lo que ya se carga en cada módulo. El semáforo compara contra una referencia orientativa; cada bloque lleva a donde se resuelve.
      </p>
      <div className="no-imprimir" style={{ display: "flex", gap: "0.8rem", alignItems: "center", flexWrap: "wrap", marginBottom: "1rem" }}>
        <label>Período <select value={meses} onChange={(e) => setMeses(Number(e.target.value))}><option value={3}>Últimos 3 meses</option><option value={6}>Últimos 6 meses</option><option value={12}>Últimos 12 meses</option></select></label>
        <label>Sector <select value={sector} onChange={(e) => setSector(e.target.value)}><option value="">Toda la empresa</option>{(d?.sectores ?? []).map((s: any) => <option key={s.id} value={s.id}>{s.nombre}</option>)}</select></label>
        <button onClick={() => window.print()} style={btnSec}>Imprimir / guardar en PDF</button>
        {cargando && <span style={{ color: SUAVE }}>Calculando…</span>}
      </div>
      {error && <p style={{ color: "#B23A3A" }}>{error}</p>}

      {d && R && (
        <>
          {/* ── Lo principal, de un vistazo ── */}
          <div style={fila}>
            <Dato titulo="Dotación" valor={num(d.dotacion?.activos)} nota={d.reclutamiento?.vacantes ? `${d.reclutamiento.vacantes} ${d.reclutamiento.vacantes === 1 ? "vacante" : "vacantes"}` : "sin vacantes"} href="/organigrama" />
            <Dato titulo="Rotación anualizada" valor={num(d.dotacion?.rotacion.anualizada, " %")} estado={semaforo(d.dotacion?.rotacion.anualizada ?? null, R.rotacionAnual)} nota={`${d.dotacion?.rotacion.bajas ?? 0} bajas · ref. ${R.rotacionAnual.texto}`} href="/offboarding" />
            <Dato titulo="Ausentismo" valor={num(d.ausentismo?.tasa, " %")} estado={semaforo(d.ausentismo?.tasa ?? null, R.ausentismo)} nota={`ref. ${R.ausentismo.texto}`} href="/kpis" />
            <Dato titulo="Clima (favorable)" valor={num(d.clima?.ultima?.favorable, " %")} estado={semaforo(d.clima?.ultima?.favorable ?? null, R.clima)} nota={d.clima?.ultima ? `eNPS ${d.clima.ultima.enps ?? "—"} · ${d.clima.ultima.titulo}` : "sin encuestas cerradas"} href="/encuestas" />
            <Dato titulo="Legajos completos" valor={num(d.documentacion?.pctLegajos, " %")} estado={semaforo(d.documentacion?.pctLegajos ?? null, R.documentacion)} nota={`ref. ${R.documentacion.texto}`} href="/legajo-digital" />
            <Dato titulo="Asistencia a capacitaciones" valor={num(d.capacitacion?.asistencia, " %")} estado={semaforo(d.capacitacion?.asistencia ?? null, R.asistenciaCapacitacion)} nota={`${d.capacitacion?.realizadas ?? 0} realizadas`} href="/capacitaciones" />
          </div>

          {/* ── Para mirar ── */}
          <div style={{ ...caja, borderLeft: `4px solid ${d.alertas.length ? (d.alertas[0].nivel === "critico" ? ESTADO.critico.color : ESTADO.atencion.color) : ESTADO.bien.color}` }}>
            <strong style={{ color: "#163A5C" }}>Para mirar{d.alertas.length > 0 && ` (${d.alertas.length})`}</strong>
            {d.alertas.length === 0 ? <p style={{ margin: "0.3rem 0 0", color: SUAVE }}>Nada fuera de lo esperable en el período.</p> : (
              <ul style={{ margin: "0.4rem 0 0", paddingLeft: 0, listStyle: "none" }}>
                {d.alertas.map((a: any, i: number) => <li key={i} style={{ display: "flex", gap: "0.6rem", alignItems: "baseline", marginBottom: 4 }}><span style={{ flexShrink: 0, width: 82 }}><Chip estado={a.nivel} /></span><span>{a.texto} <a href={a.url} className="no-imprimir" style={{ fontSize: "0.85rem", whiteSpace: "nowrap" }}>Ver ›</a></span></li>)}
              </ul>
            )}
          </div>

          {/* ── Dotación y rotación ── */}
          <Seccion titulo="Dotación y rotación" href="/offboarding" enlace="Offboarding">
            {!d.dotacion ? <SinDatos>No se pudo calcular.</SinDatos> : (
              <>
                <div style={fila}>
                  <Dato titulo="Altas del período" valor={num(d.dotacion.rotacion.altas)} />
                  <Dato titulo="Bajas del período" valor={num(d.dotacion.rotacion.bajas)} nota={`${d.dotacion.rotacion.voluntarias} por decisión de la persona`} />
                  <Dato titulo="Rotación voluntaria" valor={num(d.dotacion.rotacion.tasaVoluntaria, " %")} nota="renuncias y mutuos acuerdos" />
                  <Dato titulo="Bajas antes de los 90 días" valor={num(d.dotacion.rotacion.tempranas)} nota="habla de la selección y el ingreso" />
                  <Dato titulo="Antigüedad promedio" valor={num(d.dotacion.antiguedad, " años")} />
                </div>
                <div style={dos}>
                  <Grafico titulo="Altas y bajas por mes" filas={d.dotacion.movimiento} columnas={[["mes", "Mes"], ["altas", "Altas"], ["bajas", "Bajas"], ["dotacion", "Dotación a fin de mes"]]}>
                    <BarChart data={d.dotacion.movimiento} barGap={2} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                      <CartesianGrid stroke={GRILLA} vertical={false} /><XAxis dataKey="mes" {...ejes} /><YAxis allowDecimals={false} {...ejes} /><Tooltip cursor={{ fill: "#f1f4f6" }} /><Legend wrapperStyle={{ fontSize: 12 }} formatter={leyenda} />
                      <Bar isAnimationActive={false} dataKey="altas" name="Altas" fill={SERIE[0]} maxBarSize={22} radius={[4, 4, 0, 0]} /><Bar isAnimationActive={false} dataKey="bajas" name="Bajas" fill={SERIE[1]} maxBarSize={22} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </Grafico>
                  <Grafico titulo="Dotación a fin de cada mes" filas={d.dotacion.movimiento} columnas={[["mes", "Mes"], ["dotacion", "Personas"]]}>
                    <LineChart data={d.dotacion.movimiento} margin={{ top: 8, right: 12, bottom: 0, left: -18 }}>
                      <CartesianGrid stroke={GRILLA} vertical={false} /><XAxis dataKey="mes" {...ejes} /><YAxis allowDecimals={false} domain={[0, "auto"]} {...ejes} /><Tooltip />
                      <Line dataKey="dotacion" name="Personas" stroke={AZUL} strokeWidth={2} dot={{ r: 4, fill: AZUL, stroke: "white", strokeWidth: 2 }} isAnimationActive={false} />
                    </LineChart>
                  </Grafico>
                </div>
                <div style={dos}>
                  <div style={{ flex: "1 1 380px" }}><strong style={{ fontSize: "0.95rem" }}>Por qué se fueron</strong><Barras datos={lista(d.dotacion.rotacion.porMotivo)} /></div>
                  <div style={{ flex: "1 1 380px" }}><strong style={{ fontSize: "0.95rem" }}>Lo que dijeron en la entrevista de salida</strong>{d.egresos?.motivosReales.length ? <Barras datos={lista(d.egresos.motivosReales)} /> : <p style={{ color: SUAVE, margin: "0.3rem 0 0", fontSize: "0.9rem" }}>Sin entrevistas de salida en el período. Es lo que permite saber el motivo real.</p>}</div>
                  {!sector && <div style={{ flex: "1 1 380px" }}><strong style={{ fontSize: "0.95rem" }}>Dotación por sector</strong><Barras datos={lista(d.dotacion.porSector)} /></div>}
                </div>
                {d.dotacion.bajasSinFecha > 0 && <p style={{ fontSize: "0.85rem", color: "#8a5413" }}>{d.dotacion.bajasSinFecha} {d.dotacion.bajasSinFecha === 1 ? "legajo figura" : "legajos figuran"} de baja sin fecha de egreso: no entran en la rotación. Se corrige en <a href="/legajos">Legajos</a>.</p>}
              </>
            )}
          </Seccion>

          {/* ── Ausentismo ── */}
          <Seccion titulo="Ausentismo, licencias y sanciones" href="/kpis" enlace="KPI's de asistencia">
            {!d.ausentismo?.hayDatos ? <SinDatos>No hay asistencia cargada en el período{sector && " para este sector"}. Los indicadores de ausentismo salen del calendario de <a href="/asistencia">Asistencia</a>.</SinDatos> : (
              <>
                <div style={fila}>
                  <Dato titulo="Tasa de ausentismo" valor={num(d.ausentismo.tasa, " %")} estado={semaforo(d.ausentismo.tasa, R.ausentismo)} nota={`${d.ausentismo.ausencias} días sobre ${d.ausentismo.laborables} laborables`} />
                  <Dato titulo="Faltas sin aviso" valor={num(d.ausentismo.porTipo.injustificada)} nota="días" />
                  <Dato titulo="Enfermedad" valor={num(d.ausentismo.porTipo.enfermedad)} nota="días" />
                  <Dato titulo="Accidentes (ART)" valor={num(d.ausentismo.porTipo.art)} nota={`días · ${d.ausentismo.accidentados} ${d.ausentismo.accidentados === 1 ? "persona" : "personas"}`} />
                  <Dato titulo="Suspensiones" valor={num(d.ausentismo.porTipo.suspension)} nota={`días · ${d.ausentismo.suspendidos} ${d.ausentismo.suspendidos === 1 ? "persona" : "personas"}`} />
                  <Dato titulo="Puntualidad" valor={num(d.ausentismo.puntualidad, " %")} nota={`${d.ausentismo.tardanzas} llegadas tarde`} />
                </div>
                <div style={dos}>
                  <Grafico titulo="Días de ausencia por mes, según el motivo" filas={d.ausentismo.porMes.map((m: any) => ({ mes: m.mes, ...m.porTipo }))} columnas={[["mes", "Mes"], ...AUSENCIAS.map(([k, n]) => [k, n] as [string, string])]}>
                    <BarChart data={d.ausentismo.porMes.map((m: any) => ({ mes: m.mes, ...m.porTipo }))} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                      <CartesianGrid stroke={GRILLA} vertical={false} /><XAxis dataKey="mes" {...ejes} /><YAxis allowDecimals={false} {...ejes} /><Tooltip cursor={{ fill: "#f1f4f6" }} /><Legend wrapperStyle={{ fontSize: 12 }} formatter={leyenda} />
                      {AUSENCIAS.map(([k, n], i) => <Bar isAnimationActive={false} key={k} dataKey={k} name={n} stackId="a" fill={SERIE[i]} stroke="white" strokeWidth={2} maxBarSize={24} />)}
                    </BarChart>
                  </Grafico>
                  <Grafico titulo="Tasa de ausentismo por mes (%)" sub={`La línea punteada es la referencia: ${R.ausentismo.texto}`} filas={d.ausentismo.porMes} columnas={[["mes", "Mes"], ["tasa", "Tasa %"], ["laborables", "Días laborables"]]}>
                    <LineChart data={d.ausentismo.porMes} margin={{ top: 8, right: 12, bottom: 0, left: -18 }}>
                      <CartesianGrid stroke={GRILLA} vertical={false} /><XAxis dataKey="mes" {...ejes} /><YAxis domain={[0, "auto"]} {...ejes} /><Tooltip formatter={(v: any) => [`${v} %`, "Ausentismo"]} />
                      <ReferenceLine y={R.ausentismo.bien} stroke={SUAVE} strokeDasharray="4 4" />
                      <Line dataKey="tasa" name="Ausentismo" stroke={AZUL} strokeWidth={2} connectNulls={false} dot={{ r: 4, fill: AZUL, stroke: "white", strokeWidth: 2 }} isAnimationActive={false} />
                    </LineChart>
                  </Grafico>
                </div>
                <div style={dos}>
                  {d.ausentismo.porSector.length > 1 && <div style={{ flex: "1 1 380px" }}><strong style={{ fontSize: "0.95rem" }}>Ausentismo por sector (%)</strong><Barras sufijo=" %" datos={[...d.ausentismo.porSector].sort((a: any, b: any) => b.tasa - a.tasa).map((s: any) => ({ nombre: s.nombre, valor: s.tasa }))} /></div>}
                  <div style={{ flex: "1 1 380px" }}><strong style={{ fontSize: "0.95rem" }}>Quiénes concentran las faltas</strong><div style={{ fontSize: "0.8rem", color: SUAVE }}>Días sin aviso y con aviso (no cuenta enfermedad ni ART)</div><Barras datos={d.ausentismo.faltas.map((f: any) => ({ nombre: f.nombre, valor: f.cantidad }))} /></div>
                  <div style={{ flex: "1 1 380px" }}>
                    <strong style={{ fontSize: "0.95rem" }}>Licencias prolongadas</strong><div style={{ fontSize: "0.8rem", color: SUAVE }}>10 días corridos o más de enfermedad o ART, y siguen</div>
                    {d.ausentismo.prolongadas.length === 0 ? <p style={{ color: SUAVE, margin: "0.3rem 0 0", fontSize: "0.9rem" }}>Nadie en esta situación.</p> : <table style={{ marginTop: "0.4rem", fontSize: "0.88rem" }}><thead><tr><th>Persona</th><th>Motivo</th><th>Desde</th><th>Días</th></tr></thead><tbody>{d.ausentismo.prolongadas.map((p: any) => <tr key={p.legajoId}><td>{p.nombre}</td><td>{p.tipo === "art" ? "ART" : "Enfermedad"}</td><td>{fecha(p.desde)}</td><td>{p.dias}</td></tr>)}</tbody></table>}
                  </div>
                </div>
              </>
            )}
            {d.vacaciones && (
              <div style={fila}>
                <Dato titulo="De vacaciones hoy" valor={num(d.vacaciones.hoy)} href="/agenda" />
                <Dato titulo="Salen en los próximos 30 días" valor={num(d.vacaciones.enElPlazo)} nota="personas" href="/vacaciones" />
                <Dato titulo="Día con más gente afuera" valor={d.vacaciones.pico.personas > 0 ? `${d.vacaciones.pico.personas}` : "—"} nota={d.vacaciones.pico.personas > 0 ? `el ${fecha(d.vacaciones.pico.fecha)}${d.dotacion?.activos ? ` · ${Math.round((d.vacaciones.pico.personas / d.dotacion.activos) * 100)} % de la dotación` : ""}` : "nadie con vacaciones a la vista"} href="/agenda" />
                <Dato titulo="Pedidos sin responder" valor={num(d.vacaciones.pedidosSinResponder)} nota="vacaciones y permisos" href="/solicitudes" />
              </div>
            )}
          </Seccion>

          {/* ── Clima ── */}
          <Seccion titulo="Clima laboral" href="/encuestas" enlace="Encuestas">
            {!d.clima?.ultima ? <SinDatos>Todavía no hay una encuesta cerrada con respuestas suficientes{d.clima?.abiertas ? ` (hay ${d.clima.abiertas} abierta)` : ""}. El clima se mide con las <a href="/encuestas">Encuestas</a>.</SinDatos> : (
              <>
                <div style={fila}>
                  <Dato titulo="Respuestas favorables" valor={num(d.clima.ultima.favorable, " %")} estado={semaforo(d.clima.ultima.favorable, R.clima)} nota={`"De acuerdo" y "Muy de acuerdo" · ref. ${R.clima.texto}`} />
                  <Dato titulo="eNPS" valor={num(d.clima.ultima.enps)} nota="recomendarían trabajar acá: de −100 a 100" />
                  <Dato titulo="Participación" valor={num(d.clima.ultima.participacion, " %")} nota={`${d.clima.ultima.respuestas} respuestas`} />
                </div>
                <div style={dos}>
                  <div style={{ flex: "1 1 420px" }}><strong style={{ fontSize: "0.95rem" }}>Por tema, de peor a mejor (% favorable)</strong><div style={{ fontSize: "0.8rem", color: SUAVE }}>{d.clima.ultima.titulo}</div><Barras max={100} sufijo=" %" datos={d.clima.ultima.dimensiones.filter((x: any) => x.favorable !== null).map((x: any) => ({ nombre: x.nombre, valor: x.favorable }))} /></div>
                  {d.clima.encuestas.length > 1 && (
                    <Grafico titulo="Evolución entre encuestas (% favorable)" filas={d.clima.encuestas.map((e: any) => ({ ...e, fecha: fecha(e.fecha) }))} columnas={[["titulo", "Encuesta"], ["fecha", "Cierre"], ["favorable", "% favorable"], ["enps", "eNPS"], ["participacion", "% participación"]]}>
                      <LineChart data={d.clima.encuestas.map((e: any) => ({ ...e, cuando: new Date(e.fecha).toLocaleDateString("es-AR", { month: "short", year: "2-digit", timeZone: "UTC" }) }))} margin={{ top: 8, right: 12, bottom: 0, left: -18 }}>
                        <CartesianGrid stroke={GRILLA} vertical={false} /><XAxis dataKey="cuando" {...ejes} /><YAxis domain={[0, 100]} {...ejes} /><Tooltip formatter={(v: any) => [`${v} %`, "Favorable"]} labelFormatter={(_, p) => p?.[0]?.payload?.titulo ?? ""} />
                        <Line dataKey="favorable" name="Favorable" stroke={AZUL} strokeWidth={2} dot={{ r: 4, fill: AZUL, stroke: "white", strokeWidth: 2 }} isAnimationActive={false} />
                      </LineChart>
                    </Grafico>
                  )}
                </div>
                {sector && <p style={{ fontSize: "0.85rem", color: SUAVE }}>El clima no se filtra por sector desde acá: las encuestas son anónimas y el detalle por sector (cuando hay respuestas suficientes) está en Encuestas.</p>}
              </>
            )}
          </Seccion>

          {/* ── Documentación ── */}
          <Seccion titulo="Documentación de los legajos" href="/legajo-digital" enlace="Legajo digital">
            {!d.documentacion ? <SinDatos>No se pudo calcular.</SinDatos> : (
              <>
                <div style={fila}>
                  <Dato titulo="Legajos completos" valor={num(d.documentacion.pctLegajos, " %")} estado={semaforo(d.documentacion.pctLegajos, R.documentacion)} nota={`${d.documentacion.completos} de ${d.documentacion.legajos}`} />
                  <Dato titulo="Avance total" valor={num(d.documentacion.pctItems, " %")} nota="de todos los documentos requeridos" />
                  <Dato titulo="Esperan al empleado" valor={num(d.documentacion.pendientesEmpleado)} nota="documentos por subir o firmar" />
                  <Dato titulo="Esperan a RR.HH." valor={num(d.documentacion.pendientesRrhh)} nota="documentos por revisar o cargar" />
                </div>
                <div style={caja}><strong style={{ fontSize: "0.95rem" }}>Avance por documento, de menos a más completo (%)</strong><Barras max={100} sufijo=" %" datos={d.documentacion.porItem.map((t: any) => ({ nombre: t.nombre, valor: t.pct ?? 0, detalle: `(${t.completos}/${t.total})` }))} /></div>
              </>
            )}
          </Seccion>

          {/* ── Capacitación ── */}
          <Seccion titulo="Capacitación y habilitaciones" href="/capacitaciones" enlace="Capacitaciones">
            {!d.capacitacion ? <SinDatos>No se pudo calcular.</SinDatos> : (
              <>
                <div style={fila}>
                  <Dato titulo="Realizadas" valor={num(d.capacitacion.realizadas)} nota={`${d.capacitacion.programadas} programadas${d.capacitacion.atrasadas ? ` · ${d.capacitacion.atrasadas} sin cerrar` : ""}`} />
                  <Dato titulo="Asistencia" valor={num(d.capacitacion.asistencia, " %")} estado={semaforo(d.capacitacion.asistencia, R.asistenciaCapacitacion)} nota={`de ${d.capacitacion.convocados} convocados`} />
                  <Dato titulo="Dotación capacitada" valor={num(d.capacitacion.capacitados, " %")} nota="fue al menos a una en el período" />
                  <Dato titulo="Horas por empleado" valor={num(d.capacitacion.horasPorEmpleado)} nota={`${num(d.capacitacion.horasPersona)} horas-persona en total`} />
                  <Dato titulo="Constancias sin firmar" valor={num(d.capacitacion.sinFirmar)} nota="pendientes del empleado" />
                  <Dato titulo="Habilitaciones vencidas" valor={num(d.capacitacion.habVencidas)} estado={d.capacitacion.habVencidas > 0 ? "critico" : "bien"} nota={`${d.capacitacion.habPorVencer} vencen en 60 días`} href="/habilidades" />
                </div>
                <div style={dos}>
                  <Grafico titulo="Capacitaciones realizadas por mes" filas={d.capacitacion.porMes} columnas={[["mes", "Mes"], ["realizadas", "Realizadas"]]} alto={200}>
                    <BarChart data={d.capacitacion.porMes} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                      <CartesianGrid stroke={GRILLA} vertical={false} /><XAxis dataKey="mes" {...ejes} /><YAxis allowDecimals={false} {...ejes} /><Tooltip cursor={{ fill: "#f1f4f6" }} />
                      <Bar isAnimationActive={false} dataKey="realizadas" name="Realizadas" fill={AZUL} maxBarSize={24} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </Grafico>
                  <div style={{ flex: "1 1 320px" }}><strong style={{ fontSize: "0.95rem" }}>Por tipo</strong><Barras datos={lista(d.capacitacion.porTipo)} /></div>
                </div>
              </>
            )}
          </Seccion>

          {/* ── EPP ── */}
          <Seccion titulo="Elementos de protección (EPP) y ropa de trabajo" href="/epp" enlace="EPP">
            {!d.epp ? <SinDatos>No se pudo calcular.</SinDatos> : d.epp.catalogo === 0 || d.epp.personas === 0 ? <SinDatos>Todavía no se definió qué elementos le corresponden a cada sector o puesto. Se carga en <a href="/epp">EPP y ropa de trabajo</a> → Catálogo.</SinDatos> : (
              <>
                <div style={fila}>
                  <Dato titulo="Gente protegida" valor={num(d.epp.pctProtegidas, " %")} estado={semaforo(d.epp.pctProtegidas, R.epp)} nota={`${d.epp.protegidas} de ${d.epp.personas} con todo entregado y vigente`} />
                  <Dato titulo="Nunca entregados" valor={num(d.epp.falta)} estado={d.epp.falta > 0 ? "critico" : "bien"} nota="elementos que corresponden" />
                  <Dato titulo="Vencidos" valor={num(d.epp.vencido)} estado={d.epp.vencido > 0 ? "critico" : "bien"} nota="hay que reponerlos" />
                  <Dato titulo="Vencen en 30 días" valor={num(d.epp.porVencer)} estado={d.epp.porVencer > 0 ? "atencion" : "bien"} nota="para anticipar la compra" />
                  <Dato titulo="Sin la firma" valor={num(d.epp.sinFirmar)} estado={d.epp.sinFirmar > 0 ? "atencion" : "bien"} nota="entregas sin confirmar" />
                </div>
                {d.epp.porElemento.some((e: any) => e.falta + e.vencido > 0) && <div style={caja}><strong style={{ fontSize: "0.95rem" }}>Qué falta entregar o reponer</strong><div style={{ fontSize: "0.8rem", color: SUAVE }}>Personas a las que les corresponde y no lo tienen vigente</div><Barras datos={d.epp.porElemento.filter((e: any) => e.falta + e.vencido > 0).sort((a: any, b: any) => b.falta + b.vencido - a.falta - a.vencido).map((e: any) => ({ nombre: e.nombre, valor: e.falta + e.vencido, detalle: `de ${e.corresponde}` }))} /></div>}
              </>
            )}
          </Seccion>

          {/* ── Onboarding y offboarding ── */}
          <Seccion titulo="Ingresos y egresos">
            <div style={dos}>
              <div style={{ flex: "1 1 420px" }}>
                <strong style={{ fontSize: "0.95rem" }}>Onboarding</strong> <a href="/onboarding" className="no-imprimir" style={{ fontSize: "0.82rem" }}>Ver ›</a>
                {!d.ingresos ? <p style={{ color: SUAVE }}>No se pudo calcular.</p> : (
                  <div style={{ ...fila, marginTop: "0.5rem", marginBottom: 0 }}>
                    <Dato titulo="Ingresos en curso" valor={num(d.ingresos.enCurso)} nota={`${d.ingresos.completados} completados`} />
                    <Dato titulo="Tareas a tiempo" valor={num(d.ingresos.aTiempo, " %")} estado={semaforo(d.ingresos.aTiempo, R.tareasATiempo)} nota={`${d.ingresos.hechas} de ${d.ingresos.total} hechas`} />
                    <Dato titulo="Tareas vencidas" valor={num(d.ingresos.vencidas)} estado={d.ingresos.vencidas > 0 ? "atencion" : "bien"} nota={d.ingresos.vencidasPor.map((v: Conteo) => `${v.cantidad} ${v.nombre}`).join(" · ") || "ninguna"} />
                    <Dato titulo="Días para completar" valor={num(d.ingresos.diasPromedio)} nota="promedio, desde el ingreso" />
                  </div>
                )}
              </div>
              <div style={{ flex: "1 1 420px" }}>
                <strong style={{ fontSize: "0.95rem" }}>Offboarding</strong> <a href="/offboarding" className="no-imprimir" style={{ fontSize: "0.82rem" }}>Ver ›</a>
                {!d.egresos ? <p style={{ color: SUAVE }}>No se pudo calcular.</p> : (
                  <div style={{ ...fila, marginTop: "0.5rem", marginBottom: 0 }}>
                    <Dato titulo="Egresos en curso" valor={num(d.egresos.enCurso)} nota={`${d.egresos.procesos} en el período`} />
                    <Dato titulo="Tareas a tiempo" valor={num(d.egresos.aTiempo, " %")} estado={semaforo(d.egresos.aTiempo, R.tareasATiempo)} nota={`${d.egresos.hechas} de ${d.egresos.total} hechas`} />
                    <Dato titulo="Tareas vencidas" valor={num(d.egresos.vencidas)} estado={d.egresos.vencidas > 0 ? "atencion" : "bien"} />
                    <Dato titulo="Con entrevista de salida" valor={num(d.egresos.entrevistas, " %")} nota={`de quienes eligieron irse${d.egresos.recontratables.length ? ` · recontratables: ${d.egresos.recontratables.map((r: Conteo) => `${r.cantidad} ${r.nombre.toLowerCase()}`).join(", ")}` : ""}`} />
                  </div>
                )}
              </div>
            </div>
          </Seccion>

          {/* ── Vacantes y reclutamiento ── */}
          <Seccion titulo="Vacantes y reclutamiento" href="/reclutamiento" enlace="Reclutamiento">
            {!d.reclutamiento ? <SinDatos>No se pudo calcular.</SinDatos> : (
              <>
                <div style={fila}>
                  <Dato titulo="Vacantes" valor={d.reclutamiento.hayPuestos ? num(d.reclutamiento.vacantes) : "—"} nota={d.reclutamiento.hayPuestos ? `dotación prevista: ${d.reclutamiento.dotacionTeorica}` : "falta cargar los puestos"} href="/puestos" />
                  <Dato titulo="Búsquedas abiertas" valor={num(d.reclutamiento.abiertas)} nota={d.reclutamiento.abiertas ? `${num(d.reclutamiento.diasAbiertas)} días abiertas en promedio` : undefined} />
                  <Dato titulo="Tiempo de cobertura" valor={num(d.reclutamiento.diasCobertura, " días")} nota={`${d.reclutamiento.cubiertas} búsquedas cubiertas`} />
                  <Dato titulo="Candidatos" valor={num(d.reclutamiento.candidatos)} nota={`${d.reclutamiento.sinRevisar} sin revisar`} estado={d.reclutamiento.sinRevisar > 0 ? "atencion" : undefined} />
                </div>
                <div style={dos}>
                  <div style={{ flex: "1 1 340px" }}><strong style={{ fontSize: "0.95rem" }}>Vacantes por puesto</strong>{d.reclutamiento.porPuesto.length ? <Barras datos={d.reclutamiento.porPuesto.map((p: any) => ({ nombre: p.nombre, valor: p.vacantes, detalle: `de ${p.dotacion}` }))} /> : <p style={{ color: SUAVE, margin: "0.3rem 0 0", fontSize: "0.9rem" }}>{d.reclutamiento.hayPuestos ? "Todos los puestos están cubiertos." : "Se calcula con la dotación de cada puesto."}</p>}</div>
                  <div style={{ flex: "1 1 340px" }}><strong style={{ fontSize: "0.95rem" }}>Hasta dónde llegan los candidatos</strong><Barras datos={d.reclutamiento.candidatos ? d.reclutamiento.embudo.map((e: any) => ({ nombre: e.etapa, valor: e.cantidad })) : []} /></div>
                  <div style={{ flex: "1 1 340px" }}><strong style={{ fontSize: "0.95rem" }}>De dónde llegan</strong><Barras datos={d.reclutamiento.porFuente.map((f: any) => ({ nombre: f.nombre, valor: f.cantidad, detalle: f.contratados ? `(${f.contratados} contr.)` : undefined }))} /></div>
                </div>
                {sector && <p style={{ fontSize: "0.85rem", color: SUAVE }}>Las búsquedas y los candidatos son de toda la empresa; las vacantes sí son las de los puestos de este sector.</p>}
              </>
            )}
          </Seccion>

          {/* ── Desempeño y cultura ── */}
          <Seccion titulo="Desempeño, objetivos y cultura">
            <div style={fila}>
              <Dato titulo="Evaluaciones completadas" valor={num(d.desempeno?.ciclo?.completadas, " %")} nota={d.desempeno?.ciclo ? `${d.desempeno.ciclo.nombre} · promedio ${num(d.desempeno.ciclo.promedio)} de 5` : "sin ciclos de evaluación"} href="/evaluaciones" />
              <Dato titulo="Evaluaciones firmadas" valor={num(d.desempeno?.ciclo?.firmadas, " %")} nota="devolución entregada y firmada" href="/evaluaciones" />
              <Dato titulo="Objetivos cumplidos" valor={num(d.desempeno?.objetivos.cumplimiento, " %")} nota={`de ${d.desempeno?.objetivos.cerrados ?? 0} cerrados · ${d.desempeno?.objetivos.enCurso ?? 0} en curso`} href="/objetivos" />
              <Dato titulo="Objetivos vencidos" valor={num(d.desempeno?.objetivos.vencidos)} estado={d.desempeno?.objetivos.vencidos > 0 ? "atencion" : undefined} nota={`avance promedio ${num(d.desempeno?.objetivos.avance, " %")}`} href="/objetivos" />
              <Dato titulo="Gente reconocida" valor={num(d.cultura?.reconocidos, " %")} nota={`${d.cultura?.reconocimientos ?? 0} reconocimientos en 90 días`} href="/reconocimientos" />
              <Dato titulo="Usa el portal" valor={num(d.dotacion?.usanPortal, " %")} nota={`entró en los últimos 30 días · ${num(d.dotacion?.conPortal, " %")} tiene acceso`} href="/accesos-portal" />
            </div>
            {d.cultura?.porValor.length > 0 && <div style={caja}><strong style={{ fontSize: "0.95rem" }}>Por qué valores se reconoce</strong><Barras datos={lista(d.cultura.porValor)} /></div>}
          </Seccion>

          <p style={{ fontSize: "0.82rem", color: SUAVE, maxWidth: 900 }}>
            Cómo leerlo: "—" significa que no hay datos cargados para calcularlo (no es un cero). La rotación se anualiza para poder comparar períodos de distinto largo. El ausentismo cuenta los días con falta, enfermedad, ART o suspensión sobre los días que había que trabajar; francos, feriados, vacaciones y licencias pagas no entran.
            Las referencias del semáforo son orientativas y se pueden ajustar. Calculado el {fecha(d.hoy)} para {d.empresa}, {periodo}.
          </p>
        </>
      )}
    </main>
  );
}
