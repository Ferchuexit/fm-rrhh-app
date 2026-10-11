"use client";
// FM RRHH — app/encuestas/page.tsx
// Encuestas de clima: armarla, abrirla, seguir la participación y, una vez
// cerrada, leer los resultados por dimensión, por pregunta y por sector.
import { useEffect, useState } from "react";
import { ESCALA_ACUERDO, PLANTILLAS_ENCUESTA, TIPOS_PREGUNTA, type Pregunta, type TipoPregunta } from "@/lib/encuestas-reglas";

type Encuesta = { id: string; titulo: string; descripcion: string | null; preguntas: Pregunta[]; centroCostoIds: string[]; estado: "borrador" | "abierta" | "cerrada"; fechaCierre: string; respuestas: number; destinatarios: number };
type PorPregunta = Pregunta & { indice: number; respondieron?: number; distribucion?: number[]; promedio?: number | null; favorable?: number | null; comentarios?: string[] };
type Resultados = { total: number; suficientes: boolean; minimo: number; promedio?: number | null; favorable?: number | null; enps?: { promotores: number; pasivos: number; detractores: number; puntaje: number } | null; porDimension?: { nombre: string; promedio: number | null; favorable: number | null }[]; porPregunta?: PorPregunta[]; porSector?: { sector: string; respuestas: number; visible: boolean; promedio: number | null; favorable: number | null }[] };
type Detalle = { encuesta: Encuesta; participacion: { sector: string; total: number; respondieron: number }[]; minimo: number; resultados: Resultados | null };
type Form = { id: string; titulo: string; descripcion: string; fechaCierre: string; centroCostoIds: string[]; preguntas: Pregunta[] };

const dia = (iso: string) => new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
const nota = (n: number | null | undefined) => (n === null || n === undefined ? "—" : n.toFixed(2).replace(".", ","));
// Semáforo de un promedio de 1 a 5.
const color = (n: number | null | undefined) => (n === null || n === undefined ? "#9aa5b1" : n >= 4 ? "#2F6F5E" : n >= 3 ? "#B8752B" : "#B23A3A");
const COLORES_ESCALA = ["#D98C8C", "#E8B36B", "#D9DEE3", "#9CCBB3", "#2F6F5E"];
const caja: React.CSSProperties = { background: "white", border: "1px solid #dfe4e8", padding: "1rem", marginBottom: "1rem", maxWidth: "1000px" };
const btnSec: React.CSSProperties = { background: "white", color: "#163A5C", border: "1px solid #163A5C" };
const chico: React.CSSProperties = { padding: "0.2rem 0.6rem", fontSize: "0.8rem" };
const rotulo: React.CSSProperties = { fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.04em", color: "#6b727b", margin: "1rem 0 0.4rem" };

async function enviar(url: string, cuerpo: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo) });
  const d = await res.json().catch(() => ({ error: "El servidor no devolvió una respuesta válida." }));
  return { ok: res.ok, d };
}

export default function EncuestasPage() {
  const [datos, setDatos] = useState<{ hoy: string; encuestas: Encuesta[]; sectores: { id: string; nombre: string }[] } | null>(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState<Form | null>(null);
  const [errorForm, setErrorForm] = useState("");
  const [abierta, setAbierta] = useState<string | null>(null);
  const [detalle, setDetalle] = useState<Detalle | null>(null);
  const [aviso, setAviso] = useState<{ id: string; ok: boolean; texto: string } | null>(null);

  async function cargar() {
    const res = await fetch("/api/encuestas");
    const d = await res.json().catch(() => ({ error: "El servidor no devolvió una respuesta válida." }));
    if (!res.ok) { setError(d.error ?? "No se pudo cargar."); return; }
    setError("");
    setDatos(d);
  }
  async function cargarDetalle(id: string) {
    const res = await fetch(`/api/encuestas/${id}`);
    const d = await res.json().catch(() => ({}));
    if (res.ok) setDetalle(d); else setAviso({ id, ok: false, texto: d.error ?? "No se pudo cargar." });
  }
  useEffect(() => { cargar(); }, []);

  function desdePlantilla(i: number) {
    const p = PLANTILLAS_ENCUESTA[i];
    setErrorForm("");
    setForm({ id: "", titulo: p.titulo, descripcion: p.descripcion, fechaCierre: "", centroCostoIds: [], preguntas: p.preguntas.map((x) => ({ ...x })) });
  }
  async function guardar() {
    if (!form) return;
    setErrorForm("");
    const r = await enviar("/api/encuestas", form);
    if (!r.ok) { setErrorForm(r.d.error ?? "No se pudo guardar."); return; }
    setForm(null);
    cargar();
  }
  async function accion(e: Encuesta, cual: "abrir" | "cerrar" | "borrar") {
    setAviso(null);
    const r = await enviar(`/api/encuestas/${e.id}`, { accion: cual });
    if (!r.ok) { setAviso({ id: e.id, ok: false, texto: r.d.error ?? "No se pudo completar." }); return; }
    if (cual === "abrir") setAviso({ id: e.id, ok: true, texto: `Encuesta abierta: se les avisó a ${r.d.destinatarios} personas.` });
    await cargar();
    if (cual !== "borrar" && abierta === e.id) cargarDetalle(e.id);
    if (cual === "cerrar") { setAbierta(e.id); cargarDetalle(e.id); }
  }
  function ver(e: Encuesta) {
    setDetalle(null);
    if (abierta === e.id) { setAbierta(null); return; }
    setAbierta(e.id);
    cargarDetalle(e.id);
  }
  const cambiar = (i: number, c: Partial<Pregunta>) => form && setForm({ ...form, preguntas: form.preguntas.map((p, k) => (k === i ? { ...p, ...c } : p)) });
  const mover = (i: number, d: number) => { if (!form || i + d < 0 || i + d >= form.preguntas.length) return; const p = [...form.preguntas]; [p[i], p[i + d]] = [p[i + d], p[i]]; setForm({ ...form, preguntas: p }); };

  function barras(dist: number[], colores: string[], etiquetas: string[]) {
    const total = dist.reduce((a, b) => a + b, 0) || 1;
    return (
      <div style={{ display: "flex", height: 16, width: 260, background: "#EEF1F4" }} role="img" aria-label={dist.map((n, i) => `${etiquetas[i]}: ${n}`).join(", ")}>
        {dist.map((n, i) => n > 0 && <div key={i} title={`${etiquetas[i]}: ${n}`} style={{ width: `${(n / total) * 100}%`, background: colores[i % colores.length], fontSize: "0.68rem", textAlign: "center", lineHeight: "16px", color: i === colores.length - 1 ? "white" : "#12202e", overflow: "hidden" }}>{n}</div>)}
      </div>
    );
  }

  function verResultados(d: Detalle) {
    const total = d.participacion.reduce((a, p) => a + p.total, 0);
    const respondieron = d.participacion.reduce((a, p) => a + p.respondieron, 0);
    const r = d.resultados;
    return (
      <div style={{ marginTop: "0.75rem", borderTop: "1px solid #EEF1F4", paddingTop: "0.5rem" }}>
        <div style={rotulo}>Participación</div>
        <div style={{ fontSize: "0.9rem" }}><strong>{respondieron} de {total}</strong> ({total ? Math.round((respondieron / total) * 100) : 0}%)</div>
        {d.participacion.length > 1 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem 1.2rem", fontSize: "0.85rem", marginTop: 4 }}>
            {d.participacion.map((p) => <span key={p.sector}>{p.sector}: <strong>{p.respondieron}</strong> de {p.total}</span>)}
          </div>
        )}

        {d.encuesta.estado === "abierta" && <p style={{ fontSize: "0.85rem", color: "#4A4F58", margin: "0.75rem 0 0" }}>Los resultados se ven cuando la encuesta cierra (el {dia(d.encuesta.fechaCierre)}, o antes si la cerrás vos). Mientras está abierta solo se ve cuántos respondieron: así nadie puede deducir qué contestó cada uno.</p>}
        {d.encuesta.estado === "cerrada" && r && !r.suficientes && <p style={{ color: "#8a5413", margin: "0.75rem 0 0" }}>Respondieron {r.total}. Con menos de {r.minimo} respuestas no se muestran resultados, para cuidar el anonimato.</p>}

        {r?.suficientes && (
          <>
            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginTop: "1rem" }}>
              <div style={{ border: "1px solid #dfe4e8", padding: "0.6rem 1rem", minWidth: 150 }}><div style={{ fontSize: "1.6rem", fontWeight: 700, color: color(r.promedio) }}>{nota(r.promedio)} <span style={{ fontSize: "0.8rem", color: "#6b727b", fontWeight: 400 }}>de 5</span></div><div style={{ fontSize: "0.78rem", color: "#6b727b" }}>promedio general</div></div>
              <div style={{ border: "1px solid #dfe4e8", padding: "0.6rem 1rem", minWidth: 150 }}><div style={{ fontSize: "1.6rem", fontWeight: 700, color: "#163A5C" }}>{r.favorable}%</div><div style={{ fontSize: "0.78rem", color: "#6b727b" }}>respuestas favorables (de acuerdo)</div></div>
              {r.enps && <div style={{ border: "1px solid #dfe4e8", padding: "0.6rem 1rem", minWidth: 230 }}><div style={{ fontSize: "1.6rem", fontWeight: 700, color: r.enps.puntaje >= 30 ? "#2F6F5E" : r.enps.puntaje >= 0 ? "#B8752B" : "#B23A3A" }}>{r.enps.puntaje > 0 ? "+" : ""}{r.enps.puntaje}</div><div style={{ fontSize: "0.78rem", color: "#6b727b" }}>eNPS · {r.enps.promotores} la recomiendan, {r.enps.pasivos} neutros, {r.enps.detractores} no</div></div>}
            </div>

            {r.porDimension && r.porDimension.length > 0 && (
              <>
                <div style={rotulo}>Por dimensión — primero lo que peor está</div>
                {r.porDimension.map((dim) => (
                  <div key={dim.nombre} style={{ display: "flex", alignItems: "center", gap: "0.6rem", fontSize: "0.9rem", marginBottom: 4 }}>
                    <span style={{ width: 200 }}>{dim.nombre}</span>
                    <span style={{ width: 200, height: 10, background: "#EEF1F4" }}><span style={{ display: "block", width: `${((dim.promedio ?? 0) / 5) * 100}%`, height: 10, background: color(dim.promedio) }} /></span>
                    <strong style={{ width: 40 }}>{nota(dim.promedio)}</strong>
                    <span style={{ color: "#6b727b", fontSize: "0.82rem" }}>{dim.favorable}% favorable</span>
                  </div>
                ))}
              </>
            )}

            {r.porSector && r.porSector.length > 1 && (
              <>
                <div style={rotulo}>Por sector</div>
                {r.porSector.every((s) => !s.visible) && <p style={{ fontSize: "0.85rem", color: "#4A4F58", margin: "0 0 0.4rem" }}>No se abre por sector: hay sectores con tan pocas respuestas que, comparando con el general, se podría deducir qué contestó alguien.</p>}
                {r.porSector.map((s) => (
                  <div key={s.sector} style={{ display: "flex", alignItems: "center", gap: "0.6rem", fontSize: "0.9rem", marginBottom: 4 }}>
                    <span style={{ width: 200 }}>{s.sector}</span>
                    {s.visible ? (
                      <>
                        <span style={{ width: 200, height: 10, background: "#EEF1F4" }}><span style={{ display: "block", width: `${((s.promedio ?? 0) / 5) * 100}%`, height: 10, background: color(s.promedio) }} /></span>
                        <strong style={{ width: 40 }}>{nota(s.promedio)}</strong>
                        <span style={{ color: "#6b727b", fontSize: "0.82rem" }}>{s.favorable}% favorable · {s.respuestas} respuestas</span>
                      </>
                    ) : <span style={{ color: "#6b727b", fontSize: "0.82rem" }}>{s.respuestas} {s.respuestas === 1 ? "respuesta" : "respuestas"}: no se muestra aparte (cuentan en el general)</span>}
                  </div>
                ))}
              </>
            )}

            <div style={rotulo}>Pregunta por pregunta</div>
            {r.porPregunta!.map((p) => (
              <div key={p.indice} style={{ padding: "0.45rem 0", borderBottom: "1px solid #F5F7F9", fontSize: "0.9rem" }}>
                <div>{p.texto}{p.dimension && <span style={{ color: "#6b727b", fontSize: "0.78rem" }}> · {p.dimension}</span>}</div>
                {p.tipo === "escala" && <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginTop: 3 }}>{barras(p.distribucion!, COLORES_ESCALA, ESCALA_ACUERDO)}<strong style={{ color: color(p.promedio) }}>{nota(p.promedio)}</strong><span style={{ color: "#6b727b", fontSize: "0.82rem" }}>{p.favorable}% favorable</span></div>}
                {p.tipo === "enps" && <div style={{ marginTop: 3 }}>{barras([p.distribucion!.slice(0, 7).reduce((a, b) => a + b, 0), p.distribucion![7] + p.distribucion![8], p.distribucion![9] + p.distribucion![10]], ["#D98C8C", "#D9DEE3", "#2F6F5E"], ["No la recomiendan (0 a 6)", "Neutros (7 y 8)", "La recomiendan (9 y 10)"])}</div>}
                {p.tipo === "opcion" && p.opciones!.map((o, k) => <div key={k} style={{ display: "flex", gap: "0.5rem", alignItems: "center", fontSize: "0.85rem", marginTop: 2 }}><span style={{ width: 200 }}>{o}</span><span style={{ width: 120, height: 8, background: "#EEF1F4" }}><span style={{ display: "block", width: `${p.respondieron ? (p.distribucion![k] / p.respondieron) * 100 : 0}%`, height: 8, background: "#163A5C" }} /></span><strong>{p.distribucion![k]}</strong></div>)}
                {p.tipo === "texto" && (p.comentarios!.length === 0 ? <div style={{ color: "#9aa5b1", fontSize: "0.85rem" }}>Nadie escribió nada.</div> : <ul style={{ margin: "0.3rem 0 0", paddingLeft: "1.1rem", color: "#2b2f36" }}>{p.comentarios!.map((c, k) => <li key={k} style={{ whiteSpace: "pre-wrap", marginBottom: 3 }}>{c}</li>)}</ul>)}
              </div>
            ))}
            <p style={{ fontSize: "0.78rem", color: "#6b727b", margin: "0.6rem 0 0" }}>Los comentarios salen mezclados, no en el orden en que se escribieron.</p>
          </>
        )}
      </div>
    );
  }

  return (
    <main>
      <h1>Encuestas de clima</h1>
      <p style={{ maxWidth: "860px" }}>
        Encuestas <strong>anónimas</strong> que la gente responde desde el portal. El sistema guarda por separado quién respondió y qué se respondió, sin nada que los una: ni RR.HH. ni
        nadie puede ver qué contestó cada persona. Los resultados aparecen al cerrar la encuesta y solo si respondieron al menos 5.
      </p>
      {error && <p style={{ color: "#B23A3A" }}>{error}</p>}
      {!datos && !error && <p>Cargando…</p>}

      {datos && (
        <>
          {!form && (
            <p>
              Nueva encuesta a partir de:{" "}
              {PLANTILLAS_ENCUESTA.map((p, i) => <button key={p.nombre} onClick={() => desdePlantilla(i)} style={{ marginRight: 6 }}>{p.nombre}</button>)}
              <button onClick={() => { setErrorForm(""); setForm({ id: "", titulo: "", descripcion: "", fechaCierre: "", centroCostoIds: [], preguntas: [{ texto: "", tipo: "escala" }] }); }} style={btnSec}>En blanco</button>
            </p>
          )}

          {form && (
            <div style={caja}>
              <strong style={{ color: "#163A5C" }}>{form.id ? "Editar encuesta" : "Nueva encuesta"}</strong>
              <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "flex-end", marginTop: "0.6rem" }}>
                <label style={{ flex: 1, minWidth: 280 }}>Título<br /><input value={form.titulo} maxLength={100} onChange={(e) => setForm({ ...form, titulo: e.target.value })} style={{ width: "100%" }} /></label>
                <label>Se puede responder hasta el<br /><input type="date" min={datos.hoy.slice(0, 10)} value={form.fechaCierre} onChange={(e) => setForm({ ...form, fechaCierre: e.target.value })} /></label>
              </div>
              <label style={{ display: "block", marginTop: "0.6rem" }}>Presentación (lo que lee el empleado antes de empezar)<br /><textarea rows={2} maxLength={500} value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} style={{ width: "100%", maxWidth: 760 }} /></label>
              <div style={{ marginTop: "0.6rem" }}>
                <strong>Para quién:</strong>{" "}
                <label style={{ marginRight: 12 }}><input type="checkbox" checked={form.centroCostoIds.length === 0} onChange={() => setForm({ ...form, centroCostoIds: [] })} style={{ marginRight: 4 }} />Toda la empresa</label>
                {datos.sectores.map((s) => <label key={s.id} style={{ marginRight: 12 }}><input type="checkbox" checked={form.centroCostoIds.includes(s.id)} onChange={() => setForm({ ...form, centroCostoIds: form.centroCostoIds.includes(s.id) ? form.centroCostoIds.filter((x) => x !== s.id) : [...form.centroCostoIds, s.id] })} style={{ marginRight: 4 }} />{s.nombre}</label>)}
              </div>

              <div style={rotulo}>Preguntas ({form.preguntas.length})</div>
              {form.preguntas.map((p, i) => (
                <div key={i} style={{ display: "flex", gap: "0.4rem", alignItems: "flex-start", marginBottom: "0.4rem", flexWrap: "wrap" }}>
                  <span style={{ width: 22, paddingTop: 5, color: "#6b727b" }}>{i + 1}.</span>
                  <div style={{ flex: 1, minWidth: 300 }}>
                    <input value={p.texto} maxLength={300} onChange={(e) => cambiar(i, { texto: e.target.value })} placeholder={p.tipo === "escala" ? "Una afirmación en positivo: «Mi jefe me escucha»" : "La pregunta"} style={{ width: "100%" }} aria-label={`Texto de la pregunta ${i + 1}`} />
                    {p.tipo === "opcion" && <input value={(p.opciones ?? []).join(" | ")} onChange={(e) => cambiar(i, { opciones: e.target.value.split("|").map((o) => o.trim()) })} placeholder="Opciones separadas por | (Mañana | Tarde | Noche)" style={{ width: "100%", fontSize: "0.85rem", marginTop: 3 }} aria-label={`Opciones de la pregunta ${i + 1}`} />}
                  </div>
                  <select value={p.tipo} onChange={(e) => cambiar(i, { tipo: e.target.value as TipoPregunta })} aria-label={`Tipo de la pregunta ${i + 1}`}>{Object.entries(TIPOS_PREGUNTA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                  {p.tipo === "escala" && <input value={p.dimension ?? ""} maxLength={40} onChange={(e) => cambiar(i, { dimension: e.target.value })} placeholder="Dimensión" list="dimensiones" style={{ width: 170 }} aria-label={`Dimensión de la pregunta ${i + 1}`} />}
                  <button onClick={() => mover(i, -1)} style={{ ...btnSec, ...chico }} aria-label="Subir">↑</button>
                  <button onClick={() => mover(i, 1)} style={{ ...btnSec, ...chico }} aria-label="Bajar">↓</button>
                  <button onClick={() => setForm({ ...form, preguntas: form.preguntas.filter((_, k) => k !== i) })} style={{ ...btnSec, ...chico, color: "#B23A3A", borderColor: "#B23A3A" }} aria-label={`Quitar la pregunta ${i + 1}`}>✕</button>
                </div>
              ))}
              <datalist id="dimensiones">{[...new Set(PLANTILLAS_ENCUESTA[0].preguntas.map((p) => p.dimension).filter(Boolean))].map((d) => <option key={d} value={d} />)}</datalist>
              <button onClick={() => setForm({ ...form, preguntas: [...form.preguntas, { texto: "", tipo: "escala" }] })} style={{ ...btnSec, ...chico }}>+ Pregunta</button>
              <p style={{ fontSize: "0.78rem", color: "#6b727b", margin: "0.6rem 0 0" }}>Las afirmaciones van en positivo («Me siento seguro», no «Me siento inseguro»): así «de acuerdo» siempre es lo bueno y los promedios se leen todos igual. La <strong>dimensión</strong> agrupa preguntas para ver qué tema está mejor y cuál peor.</p>
              {errorForm && <p style={{ color: "#B23A3A", margin: "0.5rem 0 0" }}>{errorForm}</p>}
              <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}>
                <button onClick={guardar}>Guardar borrador</button>
                <button onClick={() => setForm(null)} style={btnSec}>Cancelar</button>
              </div>
              <p style={{ fontSize: "0.78rem", color: "#6b727b", margin: "0.5rem 0 0" }}>Se guarda como borrador: nadie la ve hasta que la abrís. Una vez abierta ya no se pueden cambiar las preguntas.</p>
            </div>
          )}

          <h2>Encuestas ({datos.encuestas.length})</h2>
          {datos.encuestas.length === 0 && <p>Todavía no hay encuestas. Empezá por «Clima laboral»: trae las preguntas armadas.</p>}
          {datos.encuestas.map((e) => {
            const pct = e.destinatarios ? Math.round((e.respuestas / e.destinatarios) * 100) : 0;
            return (
              <div key={e.id} style={{ ...caja, borderLeft: `4px solid ${e.estado === "borrador" ? "#9aa5b1" : e.estado === "abierta" ? "#7FA8C6" : "#2F6F5E"}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap", alignItems: "center" }}>
                  <div>
                    <strong style={{ color: "#163A5C" }}>{e.titulo}</strong> <span style={{ color: "#6b727b" }}>· {e.preguntas.length} preguntas · {e.centroCostoIds.length === 0 ? "toda la empresa" : e.centroCostoIds.map((id) => datos.sectores.find((s) => s.id === id)?.nombre ?? "?").join(", ")}</span>
                    <div style={{ fontSize: "0.85rem", color: "#4A4F58" }}>{e.estado === "borrador" ? `Borrador · cerraría el ${dia(e.fechaCierre)}` : e.estado === "abierta" ? `Abierta hasta el ${dia(e.fechaCierre)}` : "Cerrada"}{e.estado !== "borrador" && <> · respondieron <strong>{e.respuestas} de {e.destinatarios}</strong> ({pct}%)</>}</div>
                  </div>
                  <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                    {e.estado === "borrador" && <button onClick={() => accion(e, "abrir")} style={chico}>Abrir y avisar</button>}
                    {e.estado === "borrador" && <button onClick={() => { setErrorForm(""); setForm({ id: e.id, titulo: e.titulo, descripcion: e.descripcion ?? "", fechaCierre: e.fechaCierre.slice(0, 10), centroCostoIds: e.centroCostoIds, preguntas: e.preguntas.map((p) => ({ ...p })) }); window.scrollTo({ top: 0, behavior: "smooth" }); }} style={{ ...btnSec, ...chico }}>Editar</button>}
                    {e.estado === "borrador" && <button onClick={() => accion(e, "borrar")} style={{ ...btnSec, ...chico, color: "#B23A3A", borderColor: "#B23A3A" }}>Borrar</button>}
                    {e.estado === "abierta" && <button onClick={() => accion(e, "cerrar")} style={{ ...btnSec, ...chico }}>Cerrar ahora</button>}
                    {e.estado !== "borrador" && <button onClick={() => ver(e)} style={{ ...btnSec, ...chico }}>{abierta === e.id ? "Ocultar" : e.estado === "cerrada" ? "Ver resultados" : "Ver participación"}</button>}
                    <button onClick={() => { setErrorForm(""); setForm({ id: "", titulo: `${e.titulo} (copia)`, descripcion: e.descripcion ?? "", fechaCierre: "", centroCostoIds: e.centroCostoIds, preguntas: e.preguntas.map((p) => ({ ...p })) }); window.scrollTo({ top: 0, behavior: "smooth" }); }} style={{ ...btnSec, ...chico }} title="Para repetirla más adelante y comparar">Repetir</button>
                  </div>
                </div>
                {aviso?.id === e.id && <p style={{ color: aviso.ok ? "#2F6F5E" : "#B23A3A", margin: "0.5rem 0 0" }}>{aviso.texto}</p>}
                {abierta === e.id && !detalle && <p style={{ marginBottom: 0 }}>Cargando…</p>}
                {abierta === e.id && detalle && verResultados(detalle)}
              </div>
            );
          })}
        </>
      )}
    </main>
  );
}
