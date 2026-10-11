"use client";
// FM RRHH — app/reclutamiento/page.tsx
// Reclutamiento: abrir una búsqueda (con el aviso armado desde el perfil
// del puesto), publicarla, seguir a los candidatos por etapa y volver a
// encontrar a los de búsquedas anteriores.
import { useEffect, useState } from "react";
import { PESOS, TIPOS_FILTRO, UMBRAL_FINALISTA, detalleRespuestas, type PreguntaFiltro, type RespuestasFiltro, type TipoFiltro } from "@/lib/reclutamiento-filtros";
import { ETAPAS, ESTADOS_BUSQUEDA, FUENTES, FUENTES_PARA_ENLACE, MOTIVOS_DESCARTE, avisoDesdePuesto, textoParaPortal } from "@/lib/reclutamiento-reglas";
import { RELACIONES } from "@/lib/referidos-reglas";

type Resumen = { total: number; porEtapa: Record<string, number>; enProceso: number; sinRevisar: number; cubiertas: number; dias: number | null; fuentes: { fuente: string; nombre: string; total: number; avanzaron: number; contratados: number }[] };
type Busqueda = { id: string; puestoId: string | null; titulo: string; descripcion: string; requisitos: string | null; ofrecemos: string | null; lugar: string | null; vacantes: number; publica: boolean; interna: boolean; referidos: boolean; premioReferido: string | null; estado: string; motivoCierre: string | null; preguntas: PreguntaFiltro[]; palabrasClave: string[]; puesto: { nombre: string } | null; resumen: Resumen };
type Puesto = { id: string; nombre: string; mision: string | null; tareas: string | null; requisitos: string | null; condiciones: string | null; centroCosto: { nombre: string } | null };
type Candidato = { id: string; busquedaId: string; apellido: string; nombre: string; email: string | null; telefono: string | null; localidad: string | null; mensaje: string | null; fuente: string; empleadoId: string | null; referidoPorNombre: string | null; relacionReferido: string | null; cvNombre: string | null; etapa: string; etapaDesde: string; motivoDescarte: string | null; puntaje: number | null; notas: string | null; createdAt: string; respuestas: RespuestasFiltro | null; puntajeFiltro: number | null; cumpleExcluyentes: boolean | null; noCumple: string[]; palabrasHalladas: string[]; finalista?: boolean; busqueda?: { titulo: string; estado: string } };
type Detalle = { busqueda: Busqueda; candidatos: Candidato[]; resumen: Resumen; enlace: string; empresa: string };
type Form = { id: string; puestoId: string; titulo: string; descripcion: string; requisitos: string; ofrecemos: string; lugar: string; vacantes: string; publica: boolean; interna: boolean; referidos: boolean; premioReferido: string; preguntas: PreguntaFiltro[]; palabrasClave: string };

const dia = (iso: string) => new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" });
const caja: React.CSSProperties = { background: "white", border: "1px solid #dfe4e8", padding: "1rem", marginBottom: "1rem", maxWidth: "1100px" };
const btnSec: React.CSSProperties = { background: "white", color: "#163A5C", border: "1px solid #163A5C" };
const chico: React.CSSProperties = { padding: "0.2rem 0.6rem", fontSize: "0.8rem" };
const rotulo: React.CSSProperties = { fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.04em", color: "#6b727b", margin: "1rem 0 0.4rem" };
const COLOR_ESTADO: Record<string, string> = { borrador: "#9aa5b1", abierta: "#2F6F5E", pausada: "#B8752B", cerrada: "#6b727b" };
const VACIA: Form = { id: "", puestoId: "", titulo: "", descripcion: "", requisitos: "", ofrecemos: "", lugar: "", vacantes: "1", publica: true, interna: false, referidos: false, premioReferido: "", preguntas: [], palabrasClave: "" };

async function enviar(url: string, cuerpo: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo) });
  const d = await res.json().catch(() => ({ error: "El servidor no devolvió una respuesta válida." }));
  return { ok: res.ok, d };
}

export default function ReclutamientoPage() {
  const [datos, setDatos] = useState<{ empresa: string; busquedas: Busqueda[]; puestos: Puesto[] } | null>(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState<Form | null>(null);
  const [errorForm, setErrorForm] = useState("");
  const [abierta, setAbierta] = useState<string | null>(null);
  const [detalle, setDetalle] = useState<Detalle | null>(null);
  const [candidato, setCandidato] = useState<string | null>(null);
  const [notas, setNotas] = useState("");
  const [descarte, setDescarte] = useState<{ id: string; motivo: string } | null>(null);
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);
  const [copiado, setCopiado] = useState("");
  const [manual, setManual] = useState(false);
  const [verCerradas, setVerCerradas] = useState(false);
  const [soloCumplen, setSoloCumplen] = useState(false);
  const [q, setQ] = useState("");
  const [banco, setBanco] = useState<Candidato[] | null>(null);

  async function cargar() {
    const res = await fetch("/api/reclutamiento");
    const d = await res.json().catch(() => ({ error: "El servidor no devolvió una respuesta válida." }));
    if (!res.ok) { setError(d.error ?? "No se pudo cargar."); return null; }
    setError("");
    setDatos(d);
    return d as { busquedas: Busqueda[]; puestos: Puesto[] };
  }
  async function cargarDetalle(id: string) {
    const res = await fetch(`/api/reclutamiento/${id}`);
    const d = await res.json().catch(() => ({}));
    if (res.ok) setDetalle(d); else setAviso({ ok: false, texto: d.error ?? "No se pudo cargar la búsqueda." });
  }
  function desdePuesto(p: Puesto, vacantes = "1") {
    const a = avisoDesdePuesto(p, p.centroCosto?.nombre ?? null);
    setErrorForm("");
    setForm({ ...VACIA, puestoId: p.id, titulo: a.titulo, descripcion: a.descripcion, requisitos: a.requisitos ?? "", ofrecemos: a.ofrecemos ?? "", vacantes });
  }
  // Se llega desde el organigrama con ?puesto=… (abrir búsqueda para esa
  // vacante) o con ?b=… (ver una búsqueda).
  useEffect(() => {
    cargar().then((d) => {
      if (!d) return;
      const p = new URLSearchParams(window.location.search);
      const puesto = d.puestos.find((x) => x.id === p.get("puesto"));
      if (puesto) desdePuesto(puesto, p.get("vacantes") ?? "1");
      const b = p.get("b");
      if (b && d.busquedas.some((x) => x.id === b)) { setAbierta(b); cargarDetalle(b); }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function guardar() {
    if (!form) return;
    setErrorForm("");
    const r = await enviar("/api/reclutamiento", form);
    if (!r.ok) { setErrorForm(r.d.error ?? "No se pudo guardar."); return; }
    setForm(null);
    window.history.replaceState(null, "", "/reclutamiento");
    await cargar();
    setAbierta(r.d.id); setDetalle(null); cargarDetalle(r.d.id);
  }
  async function accion(b: Busqueda, cuerpo: Record<string, unknown>, ok: string) {
    setAviso(null);
    const r = await enviar(`/api/reclutamiento/${b.id}`, cuerpo);
    setAviso({ ok: r.ok, texto: r.ok ? ok : r.d.error ?? "No se pudo completar." });
    await cargar();
    if (r.ok && cuerpo.accion === "borrar") { setAbierta(null); setDetalle(null); } else cargarDetalle(b.id);
  }
  async function cambiarCandidato(c: Candidato, cuerpo: Record<string, unknown>) {
    setAviso(null);
    const r = await enviar(`/api/reclutamiento/candidatos/${c.id}`, cuerpo);
    if (!r.ok) { setAviso({ ok: false, texto: r.d.error ?? "No se pudo guardar." }); return; }
    setDescarte(null);
    cargar();
    if (abierta) cargarDetalle(abierta);
    if (banco) buscar();
  }
  function ver(b: Busqueda) {
    setAviso(null); setCandidato(null); setDetalle(null); setManual(false);
    if (abierta === b.id) { setAbierta(null); return; }
    setAbierta(b.id);
    cargarDetalle(b.id);
  }
  async function copiar(texto: string, cual: string) {
    try { await navigator.clipboard.writeText(texto); setCopiado(cual); setTimeout(() => setCopiado(""), 2500); } catch { setAviso({ ok: false, texto: "El navegador no dejó copiar. Seleccioná el texto a mano." }); }
  }
  async function cargarManual(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!abierta) return;
    setAviso(null);
    const el = e.currentTarget;
    const res = await fetch(`/api/reclutamiento/${abierta}`, { method: "POST", body: new FormData(el) });
    const d = await res.json().catch(() => ({ error: "El servidor no devolvió una respuesta válida." }));
    if (!res.ok) { setAviso({ ok: false, texto: d.error ?? "No se pudo cargar." }); return; }
    el.reset(); setManual(false);
    cargar(); cargarDetalle(abierta);
  }
  async function buscar() {
    const res = await fetch(`/api/reclutamiento/banco?q=${encodeURIComponent(q)}`);
    const d = await res.json().catch(() => ({}));
    setBanco(res.ok ? d.candidatos : []);
  }

  // En el tablero de una búsqueda, cada candidato es una tarjeta chica y su
  // ficha se abre abajo, a lo ancho (fija = true). En la base de
  // candidatos, la ficha se despliega en el lugar.
  function fichaCandidato(c: Candidato, b: Busqueda | null, fija = false) {
    const abierto = fija || candidato === c.id;
    return (
      <div key={c.id} style={{ border: "1px solid #dfe4e8", background: "white", marginBottom: 6, padding: "0.4rem 0.6rem", fontSize: "0.88rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem", alignItems: "center", cursor: "pointer" }} onClick={() => { setCandidato(abierto ? null : c.id); setNotas(c.notas ?? ""); setDescarte(null); }} title={fija ? "Cerrar la ficha" : undefined}>
          <div>
            <strong>{c.apellido}, {c.nombre}</strong>{c.empleadoId && <span style={{ color: "#163A5C", fontSize: "0.75rem", fontWeight: 700 }}> · EMPLEADO</span>}
            <div style={{ fontSize: "0.78rem", color: "#6b727b" }}>{FUENTES[c.fuente] ?? c.fuente}{c.referidoPorNombre && <strong style={{ color: "#163A5C" }}> por {c.referidoPorNombre}{c.relacionReferido && RELACIONES[c.relacionReferido] ? ` (${RELACIONES[c.relacionReferido].toLowerCase()})` : ""}</strong>} · {dia(c.createdAt)}{c.localidad && ` · ${c.localidad}`}{c.busqueda && ` · ${c.busqueda.titulo}`}</div>
          </div>
          <span style={{ color: "#B8752B", whiteSpace: "nowrap" }} aria-label={c.puntaje ? `${c.puntaje} de 5` : "sin puntuar"}>{c.puntaje ? "★".repeat(c.puntaje) : ""}</span>
        </div>
        {abierto && (
          <div style={{ marginTop: "0.5rem", borderTop: "1px solid #EEF1F4", paddingTop: "0.5rem" }}>
            <div>{c.telefono && <>📞 <a href={`tel:${c.telefono}`}>{c.telefono}</a> </>}{c.email && <>· ✉ <a href={`mailto:${c.email}`}>{c.email}</a> </>}{c.empleadoId && !c.telefono && !c.email && <>Es empleado: sus datos están en su <a href={`/legajos/${c.empleadoId}/editar`}>legajo</a>. </>}{c.cvNombre && <>· <a href={`/api/reclutamiento/candidatos/${c.id}/cv`} target="_blank" rel="noreferrer"><strong>Ver CV</strong></a></>}</div>
            {c.mensaje && <div style={{ whiteSpace: "pre-wrap", color: "#4A4F58", margin: "0.3rem 0" }}>«{c.mensaje}»</div>}
            {b && (c.puntajeFiltro !== null || c.respuestas) && (
              <div style={{ background: "#F5F7F9", padding: "0.4rem 0.6rem", margin: "0.4rem 0" }}>
                <strong>Filtro: {c.puntajeFiltro === null ? "sin evaluar" : `${c.puntajeFiltro}%`}</strong>{c.cumpleExcluyentes === false && <span style={{ color: "#B23A3A", fontWeight: 700 }}> · no cumple un excluyente</span>}
                {c.respuestas && detalleRespuestas(b.preguntas, c.respuestas).map((x, i) => (
                  <div key={i} style={{ color: x.cumple ? "#215446" : x.excluyente ? "#B23A3A" : "#6b727b" }}>{x.cumple ? "✓" : "✗"} {x.pregunta} <strong>{x.respuesta}</strong>{!x.cumple && x.excluyente && " (excluyente)"}</div>
                ))}
                {b.palabrasClave.length > 0 && <div style={{ marginTop: 2 }}>Palabras clave en el CV: {c.palabrasHalladas.length === 0 ? <span style={{ color: "#6b727b" }}>ninguna{!c.cvNombre && " (no subió CV)"}</span> : b.palabrasClave.map((w) => <span key={w} style={{ marginRight: 8, color: c.palabrasHalladas.includes(w) ? "#215446" : "#9aa5b1", fontWeight: c.palabrasHalladas.includes(w) ? 700 : 400 }}>{c.palabrasHalladas.includes(w) ? "✓" : "·"} {w}</span>)}</div>}
              </div>
            )}
            {c.etapa === "descartado" && c.motivoDescarte && <div style={{ color: "#B23A3A" }}>Descartado: {MOTIVOS_DESCARTE[c.motivoDescarte] ?? c.motivoDescarte}</div>}
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center", marginTop: "0.4rem" }}>
              <span>Valoración:</span>
              {[1, 2, 3, 4, 5].map((n) => <button key={n} onClick={() => cambiarCandidato(c, { puntaje: c.puntaje === n ? null : n })} aria-label={`${n} de 5`} style={{ ...btnSec, ...chico, color: (c.puntaje ?? 0) >= n ? "#B8752B" : "#cfd6dc", borderColor: "#cfd6dc", fontSize: "1rem", padding: "0 0.35rem" }}>★</button>)}
              {b && b.estado !== "cerrada" && (
                <label style={{ marginLeft: "0.5rem" }}>Pasar a{" "}
                  <select value={c.etapa} onChange={(e) => (e.target.value === "descartado" ? setDescarte({ id: c.id, motivo: "" }) : cambiarCandidato(c, { etapa: e.target.value }))}>{ETAPAS.map((et) => <option key={et.clave} value={et.clave}>{et.nombre}</option>)}</select>
                </label>
              )}
            </div>
            {descarte?.id === c.id && (
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginTop: "0.4rem" }}>
                <select value={descarte.motivo} onChange={(e) => setDescarte({ ...descarte, motivo: e.target.value })}><option value="">¿Por qué se descarta?</option>{Object.entries(MOTIVOS_DESCARTE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                <button onClick={() => cambiarCandidato(c, { etapa: "descartado", motivoDescarte: descarte.motivo })} style={chico}>Descartar</button>
                <button onClick={() => setDescarte(null)} style={{ ...btnSec, ...chico }}>Cancelar</button>
              </div>
            )}
            <textarea rows={2} maxLength={3000} value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Notas de la entrevista, pretensión, disponibilidad…" style={{ width: "100%", marginTop: "0.4rem" }} aria-label="Notas" />
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.3rem", alignItems: "center" }}>
              <button onClick={() => cambiarCandidato(c, { notas })} style={{ ...btnSec, ...chico }}>Guardar notas</button>
              {c.etapa === "contratado" && !c.empleadoId && <a href={`/legajos/nuevo?${new URLSearchParams({ apellido: c.apellido, nombre: c.nombre, ...(c.email ? { email: c.email } : {}), ...(c.telefono ? { telefono: c.telefono } : {}), ...(c.localidad ? { localidad: c.localidad } : {}) })}`} style={{ fontWeight: 700 }}>Cargar su legajo →</a>}
              <button onClick={() => { if (window.confirm(`¿Borrar a ${c.nombre} ${c.apellido} y su CV? No se puede deshacer. Usalo si pidió que no guardemos sus datos.`)) cambiarCandidato(c, { accion: "borrar" }); }} style={{ ...btnSec, ...chico, color: "#B23A3A", borderColor: "#B23A3A", marginLeft: "auto" }}>Borrar sus datos</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  function verDetalle(d: Detalle) {
    const b = d.busqueda;
    const enlace = (f?: string) => `${d.enlace}${f ? `?f=${f}` : ""}`;
    return (
      <div style={{ marginTop: "0.75rem", borderTop: "1px solid #EEF1F4", paddingTop: "0.6rem" }}>
        <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
          {b.estado === "borrador" && <button onClick={() => accion(b, { accion: "abrir" }, b.interna ? "Búsqueda abierta. Se les avisó a los empleados." : "Búsqueda abierta: ya se puede postular.")}>Abrir la búsqueda</button>}
          {b.estado === "abierta" && <button onClick={() => accion(b, { accion: "pausar" }, "Pausada: no recibe postulaciones hasta que la reanudes.")} style={btnSec}>Pausar</button>}
          {b.estado === "pausada" && <button onClick={() => accion(b, { accion: "reanudar" }, "Reanudada.")}>Reanudar</button>}
          {(b.estado === "abierta" || b.estado === "pausada") && <button onClick={() => accion(b, { accion: "cerrar", motivo: "cubierta" }, "Búsqueda cerrada como cubierta.")} style={btnSec}>Cerrar: se cubrió</button>}
          {(b.estado === "abierta" || b.estado === "pausada") && <button onClick={() => accion(b, { accion: "cerrar", motivo: "cancelada" }, "Búsqueda cancelada.")} style={{ ...btnSec, color: "#B23A3A", borderColor: "#B23A3A" }}>Cancelar la búsqueda</button>}
          {b.estado !== "cerrada" && <button onClick={() => { setErrorForm(""); setForm({ id: b.id, puestoId: b.puestoId ?? "", titulo: b.titulo, descripcion: b.descripcion, requisitos: b.requisitos ?? "", ofrecemos: b.ofrecemos ?? "", lugar: b.lugar ?? "", vacantes: String(b.vacantes), publica: b.publica, interna: b.interna, referidos: b.referidos, premioReferido: b.premioReferido ?? "", preguntas: b.preguntas.map((x) => ({ ...x })), palabrasClave: b.palabrasClave.join(", ") }); window.scrollTo({ top: 0, behavior: "smooth" }); }} style={btnSec}>Editar el aviso</button>}
          {b.estado === "borrador" && <button onClick={() => accion(b, { accion: "borrar" }, "Borrada.")} style={{ ...btnSec, color: "#B23A3A", borderColor: "#B23A3A" }}>Borrar</button>}
        </div>
        {aviso && <p style={{ color: aviso.ok ? "#2F6F5E" : "#B23A3A", margin: "0.5rem 0 0" }}>{aviso.texto}</p>}

        {b.publica && b.estado !== "cerrada" && (
          <>
            <div style={rotulo}>Publicar</div>
            {b.estado === "borrador" && <p style={{ fontSize: "0.85rem", color: "#8a5413", margin: "0 0 0.4rem" }}>Todavía es un borrador: el enlace empieza a funcionar cuando la abrís.</p>}
            <div style={{ fontSize: "0.88rem" }}>Página de postulación: <a href={enlace()} target="_blank" rel="noreferrer">{enlace()}</a> <button onClick={() => copiar(enlace(), "enlace")} style={{ ...btnSec, ...chico }}>{copiado === "enlace" ? "Copiado ✓" : "Copiar enlace"}</button></div>
            <div style={{ fontSize: "0.88rem", marginTop: "0.5rem" }}>Aviso listo para pegar en cada portal (lleva su enlace, así después sabés de dónde llegó cada candidato):</div>
            <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap", marginTop: "0.3rem" }}>
              {FUENTES_PARA_ENLACE.map((f) => <button key={f} onClick={() => copiar(textoParaPortal(b, d.empresa, enlace(f)), f)} style={{ ...btnSec, ...chico }}>{copiado === f ? "Copiado ✓" : FUENTES[f]}</button>)}
            </div>
          </>
        )}
        {b.referidos && <p style={{ fontSize: "0.85rem", color: "#4A4F58", margin: "0.6rem 0 0" }}>Acepta <strong>referidos</strong>: los empleados recomiendan gente desde el portal{b.premioReferido && <> · premio: {b.premioReferido}</>}. Se siguen en <a href="/referidos">Programa de referidos</a>.</p>}
        {b.interna && <p style={{ fontSize: "0.85rem", color: "#4A4F58", margin: "0.6rem 0 0" }}>Es <strong>interna</strong>: los empleados la ven en el portal (Empleos) y se postulan con un toque.</p>}

        {d.resumen.fuentes.length > 0 && (
          <>
            <div style={rotulo}>De dónde llegan</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem 1.2rem", fontSize: "0.88rem" }}>
              {d.resumen.fuentes.map((f) => <span key={f.fuente}>{f.nombre}: <strong>{f.total}</strong>{f.avanzaron > 0 && <span style={{ color: "#6b727b" }}> ({f.avanzaron} {f.avanzaron === 1 ? "avanzó" : "avanzaron"}{f.contratados > 0 && `, ${f.contratados} ${f.contratados === 1 ? "contratado" : "contratados"}`})</span>}</span>)}
            </div>
          </>
        )}

        <div style={{ ...rotulo, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>Candidatos ({d.candidatos.length})</span>
          {b.estado !== "cerrada" && !manual && <button onClick={() => setManual(true)} style={{ ...btnSec, ...chico, textTransform: "none", letterSpacing: 0 }}>+ Cargar uno a mano</button>}
        </div>
        {manual && (
          <form onSubmit={cargarManual} style={{ background: "#F5F7F9", padding: "0.6rem", marginBottom: "0.6rem", display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "flex-end", fontSize: "0.88rem" }}>
            <label>Apellido<br /><input name="apellido" required maxLength={60} style={{ width: 130 }} /></label>
            <label>Nombre<br /><input name="nombre" required maxLength={60} style={{ width: 130 }} /></label>
            <label>Teléfono<br /><input name="telefono" maxLength={40} style={{ width: 130 }} /></label>
            <label>Mail<br /><input name="email" type="email" maxLength={120} style={{ width: 170 }} /></label>
            <label>Llegó por<br /><select name="fuente" defaultValue="manual">{Object.entries(FUENTES).filter(([k]) => k !== "interno" && k !== "web").map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
            <label>CV (PDF)<br /><input name="cv" type="file" accept="application/pdf" style={{ width: 200 }} /></label>
            <button type="submit" style={chico}>Cargar</button>
            <button type="button" onClick={() => setManual(false)} style={{ ...btnSec, ...chico }}>Cancelar</button>
          </form>
        )}
        {d.candidatos.length === 0 && <p style={{ color: "#6b727b", fontSize: "0.9rem" }}>Todavía no se postuló nadie.</p>}
        {(b.preguntas.length > 0 || b.palabrasClave.length > 0) && d.candidatos.length > 0 && (() => {
          const postulados = d.candidatos.filter((c) => c.etapa === "postulado");
          const sugeridos = postulados.filter((c) => c.finalista).length;
          const noCumplen = postulados.filter((c) => c.cumpleExcluyentes === false).length;
          return (
            <div style={{ background: "#e8f0f6", border: "1px solid #c3d6e5", padding: "0.5rem 0.75rem", marginBottom: "0.6rem", fontSize: "0.88rem", display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
              <span>Ordenados por el filtro: arriba, los que mejor encajan. <strong style={{ color: "#2F6F5E" }}>{sugeridos}</strong> {sugeridos === 1 ? "postulado llega" : "postulados llegan"} a {UMBRAL_FINALISTA}% cumpliendo los excluyentes{noCumplen > 0 && <> · <strong style={{ color: "#B23A3A" }}>{noCumplen}</strong> no {noCumplen === 1 ? "cumple" : "cumplen"} algún excluyente</>}.</span>
              {sugeridos > 0 && b.estado !== "cerrada" && <button onClick={() => accion(b, { accion: "preseleccionar" }, `${sugeridos === 1 ? "Pasó 1 candidato" : `Pasaron ${sugeridos} candidatos`} a Preselección.`)} style={chico}>Pasar {sugeridos === 1 ? "ese" : `esos ${sugeridos}`} a Preselección</button>}
              {noCumplen > 0 && <label><input type="checkbox" checked={soloCumplen} onChange={(e) => setSoloCumplen(e.target.checked)} style={{ marginRight: 4 }} />Ocultar los que no cumplen</label>}
            </div>
          );
        })()}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "0.5rem", alignItems: "start" }}>
          {ETAPAS.filter((et) => d.candidatos.some((c) => c.etapa === et.clave) || !["contratado", "descartado"].includes(et.clave)).map((et) => {
            const lista = d.candidatos.filter((c) => c.etapa === et.clave && !(soloCumplen && c.cumpleExcluyentes === false && et.clave === "postulado"));
            return (
              <div key={et.clave} style={{ background: "#F5F7F9", padding: "0.4rem", minHeight: 70 }}>
                <div style={{ fontSize: "0.8rem", fontWeight: 700, color: et.clave === "descartado" ? "#B23A3A" : et.clave === "contratado" ? "#2F6F5E" : "#163A5C", marginBottom: 6 }}>{et.nombre} <span style={{ fontWeight: 400, color: "#6b727b" }}>{lista.length}</span></div>
                {lista.map((c) => (
                  <button key={c.id} onClick={() => { setCandidato(candidato === c.id ? null : c.id); setNotas(c.notas ?? ""); setDescarte(null); }} style={{ display: "block", width: "100%", textAlign: "left", background: "white", color: "#2b2f36", border: candidato === c.id ? "2px solid #163A5C" : "1px solid #dfe4e8", padding: "0.35rem 0.5rem", marginBottom: 5, fontSize: "0.85rem", fontWeight: 400 }}>
                    <strong>{c.apellido}, {c.nombre}</strong>{c.empleadoId && <span style={{ color: "#163A5C", fontSize: "0.7rem", fontWeight: 700 }}> · EMPL.</span>}
                    <span style={{ display: "block", fontSize: "0.75rem", color: "#6b727b" }}>{FUENTES[c.fuente] ?? c.fuente}{c.cvNombre && " · CV"}{c.puntajeFiltro !== null && <strong style={{ color: c.cumpleExcluyentes === false ? "#B23A3A" : c.finalista ? "#2F6F5E" : "#4A4F58" }}> · {c.puntajeFiltro}%{c.cumpleExcluyentes === false && " ✗"}</strong>}{c.puntaje ? <span style={{ color: "#B8752B" }}> {"★".repeat(c.puntaje)}</span> : ""}</span>
                  </button>
                ))}
              </div>
            );
          })}
        </div>
        {d.candidatos.filter((c) => c.id === candidato).map((c) => <div key={c.id} style={{ marginTop: "0.6rem", maxWidth: 760 }}>{fichaCandidato(c, b, true)}</div>)}
        {d.candidatos.length > 0 && !d.candidatos.some((c) => c.id === candidato) && <p style={{ fontSize: "0.78rem", color: "#6b727b", margin: "0.5rem 0 0" }}>Tocá un candidato para ver sus datos, el CV, puntuarlo y pasarlo de etapa.</p>}
      </div>
    );
  }

  function tarjeta(b: Busqueda) {
    const r = b.resumen;
    return (
      <div key={b.id} style={{ ...caja, borderLeft: `4px solid ${COLOR_ESTADO[b.estado]}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <strong style={{ color: "#163A5C" }}>{b.titulo}</strong> <span style={{ color: COLOR_ESTADO[b.estado], fontWeight: 700, fontSize: "0.85rem" }}>· {b.estado === "cerrada" ? (b.motivoCierre === "cancelada" ? "Cancelada" : "Cubierta") : ESTADOS_BUSQUEDA[b.estado]}</span>
            <div style={{ fontSize: "0.85rem", color: "#4A4F58" }}>
              {b.vacantes} {b.vacantes === 1 ? "vacante" : "vacantes"}{r.cubiertas > 0 && ` (${r.cubiertas} ${r.cubiertas === 1 ? "cubierta" : "cubiertas"})`}{b.lugar && ` · ${b.lugar}`} · {[b.publica && "página de empleos", b.interna && "interna", b.referidos && "referidos"].filter(Boolean).join(" + ")}
              {r.dias !== null && <> · {b.estado === "cerrada" ? `se cerró a los ${r.dias} días` : `${r.dias} ${r.dias === 1 ? "día" : "días"} abierta`}</>}
            </div>
          </div>
          <div style={{ display: "flex", gap: "0.9rem", alignItems: "center" }}>
            <div style={{ textAlign: "right", fontSize: "0.85rem" }}><strong>{r.total}</strong> {r.total === 1 ? "candidato" : "candidatos"}{r.sinRevisar > 0 && b.estado !== "cerrada" && <div style={{ color: "#8a5413", fontWeight: 700 }}>{r.sinRevisar} sin revisar</div>}</div>
            <button onClick={() => ver(b)} style={{ ...btnSec, ...chico }}>{abierta === b.id ? "Cerrar" : "Ver"}</button>
          </div>
        </div>
        {abierta === b.id && !detalle && <p style={{ marginBottom: 0 }}>Cargando…</p>}
        {abierta === b.id && detalle && verDetalle(detalle)}
      </div>
    );
  }

  const activas = (datos?.busquedas ?? []).filter((b) => b.estado !== "cerrada");
  const cerradas = (datos?.busquedas ?? []).filter((b) => b.estado === "cerrada");

  return (
    <main>
      <h1>Reclutamiento</h1>
      <p style={{ maxWidth: "860px" }}>
        Abrí una búsqueda desde el perfil de un <a href="/puestos">puesto</a>, publicá el enlace de postulación donde quieras y seguí a los candidatos por etapa. Los candidatos entran solos al
        sistema, con su CV, y quedan guardados para la próxima búsqueda.
      </p>
      {error && <p style={{ color: "#B23A3A" }}>{error}</p>}
      {!datos && !error && <p>Cargando…</p>}

      {datos && (
        <>
          {!form && (
            <p>
              <button onClick={() => { setErrorForm(""); setForm({ ...VACIA }); }}>+ Nueva búsqueda</button>{" "}
              {datos.puestos.length === 0 && <span style={{ fontSize: "0.85rem", color: "#6b727b" }}>Si antes cargás el <a href="/puestos">perfil del puesto</a>, el aviso sale armado.</span>}
            </p>
          )}
          {form && (
            <div style={caja}>
              <strong style={{ color: "#163A5C" }}>{form.id ? "Editar la búsqueda" : "Nueva búsqueda"}</strong>
              <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "flex-end", marginTop: "0.6rem" }}>
                {datos.puestos.length > 0 && (
                  <label>Puesto<br />
                    <select value={form.puestoId} onChange={(e) => { const p = datos.puestos.find((x) => x.id === e.target.value); if (p && !form.id) desdePuesto(p, form.vacantes); else setForm({ ...form, puestoId: e.target.value }); }}>
                      <option value="">— sin puesto del organigrama —</option>
                      {datos.puestos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                    </select>
                  </label>
                )}
                <label style={{ flex: 1, minWidth: 260 }}>Título del aviso<br /><input value={form.titulo} maxLength={100} onChange={(e) => setForm({ ...form, titulo: e.target.value })} style={{ width: "100%" }} /></label>
                <label>Vacantes<br /><input type="number" min={1} max={200} value={form.vacantes} onChange={(e) => setForm({ ...form, vacantes: e.target.value })} style={{ width: 70 }} /></label>
                <label>Lugar<br /><input value={form.lugar} maxLength={100} onChange={(e) => setForm({ ...form, lugar: e.target.value })} placeholder="Benavídez, Tigre" /></label>
              </div>
              <label style={{ display: "block", marginTop: "0.6rem" }}>Qué va a hacer<br /><textarea rows={5} maxLength={3000} value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} style={{ width: "100%", maxWidth: 800 }} /></label>
              <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginTop: "0.6rem" }}>
                <label style={{ flex: 1, minWidth: 300 }}>Requisitos<br /><textarea rows={4} maxLength={2000} value={form.requisitos} onChange={(e) => setForm({ ...form, requisitos: e.target.value })} style={{ width: "100%" }} /></label>
                <label style={{ flex: 1, minWidth: 300 }}>Qué ofrecemos <span style={{ color: "#6b727b" }}>(horario, beneficios)</span><br /><textarea rows={4} maxLength={1500} value={form.ofrecemos} onChange={(e) => setForm({ ...form, ofrecemos: e.target.value })} style={{ width: "100%" }} /></label>
              </div>
              <div style={{ marginTop: "0.9rem", borderTop: "1px solid #EEF1F4", paddingTop: "0.7rem" }}>
                <strong style={{ color: "#163A5C" }}>Filtros de preselección</strong> <span style={{ fontSize: "0.85rem", color: "#6b727b" }}>(opcional) — ordenan a los candidatos del que mejor encaja al que menos. No descartan a nadie solos.</span>
                {form.preguntas.map((q, i) => {
                  const cambiar = (c: Partial<PreguntaFiltro>) => setForm({ ...form, preguntas: form.preguntas.map((x, k) => (k === i ? { ...x, ...c } : x)) });
                  return (
                    <div key={i} style={{ background: "#F5F7F9", padding: "0.5rem", marginTop: "0.4rem", display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "flex-end", fontSize: "0.88rem" }}>
                      <label style={{ flex: 1, minWidth: 260 }}>Pregunta al candidato<br /><input value={q.texto} maxLength={200} onChange={(e) => cambiar({ texto: e.target.value })} placeholder="¿Tenés experiencia con seccionadora?" style={{ width: "100%" }} /></label>
                      <label>Tipo<br /><select value={q.tipo} onChange={(e) => { const t = e.target.value as TipoFiltro; cambiar(t === "si_no" ? { tipo: t, esperado: "si" } : t === "numero" ? { tipo: t, minimo: 1 } : { tipo: t, opciones: ["", ""], aceptadas: [0] }); }}>{Object.entries(TIPOS_FILTRO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
                      {q.tipo === "si_no" && <label>Suma si responde<br /><select value={q.esperado ?? "si"} onChange={(e) => cambiar({ esperado: e.target.value as "si" | "no" })}><option value="si">Sí</option><option value="no">No</option></select></label>}
                      {q.tipo === "numero" && <label>Suma desde<br /><input type="number" min={0} step="0.5" value={q.minimo ?? 0} onChange={(e) => cambiar({ minimo: Number(e.target.value) })} style={{ width: 70 }} /></label>}
                      <label>Peso<br /><select value={q.puntos} onChange={(e) => cambiar({ puntos: Number(e.target.value) })}>{Object.entries(PESOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
                      <label title="Si no la cumple, queda marcado y va al fondo de la lista" style={{ paddingBottom: 4 }}><input type="checkbox" checked={q.excluyente} onChange={(e) => cambiar({ excluyente: e.target.checked })} style={{ marginRight: 4 }} />Excluyente</label>
                      <button onClick={() => setForm({ ...form, preguntas: form.preguntas.filter((_, k) => k !== i) })} style={{ ...btnSec, ...chico, marginBottom: 2 }} aria-label={`Quitar la pregunta ${i + 1}`}>✕</button>
                      {q.tipo === "opcion" && (
                        <div style={{ flexBasis: "100%" }}>
                          {(q.opciones ?? []).map((o, k) => (
                            <div key={k} style={{ display: "flex", gap: "0.4rem", alignItems: "center", marginTop: 3 }}>
                              <input value={o} maxLength={80} placeholder={`Opción ${k + 1}`} onChange={(e) => cambiar({ opciones: q.opciones!.map((x, j) => (j === k ? e.target.value : x)) })} style={{ width: 240 }} />
                              <label><input type="checkbox" checked={(q.aceptadas ?? []).includes(k)} onChange={() => cambiar({ aceptadas: (q.aceptadas ?? []).includes(k) ? q.aceptadas!.filter((x) => x !== k) : [...(q.aceptadas ?? []), k] })} style={{ marginRight: 4 }} />suma</label>
                              {q.opciones!.length > 2 && <button onClick={() => cambiar({ opciones: q.opciones!.filter((_, j) => j !== k), aceptadas: (q.aceptadas ?? []).filter((x) => x !== k).map((x) => (x > k ? x - 1 : x)) })} style={{ ...btnSec, ...chico }}>✕</button>}
                            </div>
                          ))}
                          {q.opciones!.length < 8 && <button onClick={() => cambiar({ opciones: [...q.opciones!, ""] })} style={{ ...btnSec, ...chico, marginTop: 4 }}>+ Opción</button>}
                        </div>
                      )}
                    </div>
                  );
                })}
                {form.preguntas.length < 10 && <button onClick={() => setForm({ ...form, preguntas: [...form.preguntas, { texto: "", tipo: "si_no", excluyente: false, puntos: 1, esperado: "si" }] })} style={{ ...btnSec, ...chico, marginTop: "0.5rem" }}>+ Pregunta de filtro</button>}
                <label style={{ display: "block", marginTop: "0.6rem" }}>Palabras clave para buscar en el CV <span style={{ color: "#6b727b" }}>(separadas por coma)</span><br /><input value={form.palabrasClave} onChange={(e) => setForm({ ...form, palabrasClave: e.target.value })} placeholder="seccionadora, escuadradora, autoelevador" style={{ width: "100%", maxWidth: 800 }} /></label>
                <p style={{ fontSize: "0.78rem", color: "#6b727b", margin: "0.4rem 0 0" }}>El candidato ve las preguntas, pero no cuál respuesta suma ni cuál es excluyente. Las palabras clave solo se pueden buscar en CV con texto (un CV escaneado como foto no suma ni resta). Preguntá por lo que el puesto necesita de verdad: no por edad, sexo, estado civil, hijos ni lugar de nacimiento.</p>
              </div>
              <div style={{ marginTop: "0.9rem" }}>
                <strong>Dónde se publica:</strong>{" "}
                <label style={{ marginRight: 14 }}><input type="checkbox" checked={form.publica} onChange={(e) => setForm({ ...form, publica: e.target.checked })} style={{ marginRight: 4 }} />Página de empleos (gente de afuera)</label>
                <label><input type="checkbox" checked={form.interna} onChange={(e) => setForm({ ...form, interna: e.target.checked })} style={{ marginRight: 4 }} />Búsqueda interna (la ven los empleados en el portal)</label>
                <div style={{ marginTop: "0.4rem" }}>
                  <label style={{ marginRight: 14 }}><input type="checkbox" checked={form.referidos} onChange={(e) => setForm({ ...form, referidos: e.target.checked })} style={{ marginRight: 4 }} />Aceptar referidos de los empleados (recomiendan gente desde el portal)</label>
                  {form.referidos && <label>Premio si el recomendado queda <span style={{ color: "#6b727b" }}>(opcional)</span>{" "}<input value={form.premioReferido} maxLength={120} onChange={(e) => setForm({ ...form, premioReferido: e.target.value })} placeholder="Un día libre, una orden de compra…" style={{ width: 280 }} /></label>}
                </div>
              </div>
              {errorForm && <p style={{ color: "#B23A3A", margin: "0.5rem 0 0" }}>{errorForm}</p>}
              <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}>
                <button onClick={guardar}>{form.id ? "Guardar cambios" : "Guardar borrador"}</button>
                <button onClick={() => { setForm(null); window.history.replaceState(null, "", "/reclutamiento"); }} style={btnSec}>Cancelar</button>
              </div>
              <p style={{ fontSize: "0.78rem", color: "#6b727b", margin: "0.5rem 0 0" }}>No pongas el sueldo si no querés publicarlo: el aviso es público. Evitá pedir edad, sexo, estado civil o foto como requisito: puede considerarse discriminatorio.</p>
            </div>
          )}

          <h2>Búsquedas en curso ({activas.length})</h2>
          {activas.length === 0 && <p>No hay búsquedas abiertas.</p>}
          {activas.map(tarjeta)}

          {cerradas.length > 0 && (
            <>
              <h2 style={{ marginTop: "1.5rem" }}>Cerradas ({cerradas.length}) <button onClick={() => setVerCerradas(!verCerradas)} style={{ ...btnSec, ...chico, marginLeft: 8 }}>{verCerradas ? "Ocultar" : "Ver"}</button></h2>
              {verCerradas && cerradas.map(tarjeta)}
            </>
          )}

          <h2 style={{ marginTop: "1.5rem" }}>Base de candidatos</h2>
          <div style={caja}>
            <p style={{ margin: "0 0 0.5rem", fontSize: "0.9rem" }}>Todos los que se postularon alguna vez. Antes de publicar una búsqueda nueva, fijate si ya tenés a alguien: buscá por nombre, localidad, búsqueda anterior o algo que hayas anotado («autoelevador», «tornero»).</p>
            <form onSubmit={(e) => { e.preventDefault(); buscar(); }} style={{ display: "flex", gap: "0.5rem" }}>
              <input value={q} onChange={(e) => setQ(e.target.value)} maxLength={60} placeholder="tornero, Pacheco, Gómez…" style={{ width: 300 }} aria-label="Buscar candidatos" />
              <button type="submit">Buscar</button>
            </form>
            {banco && banco.length === 0 && <p style={{ color: "#6b727b", marginBottom: 0 }}>No hay candidatos que coincidan.</p>}
            {banco && banco.length > 0 && <div style={{ marginTop: "0.75rem", maxWidth: 700 }}>{banco.map((c) => fichaCandidato(c, null))}{banco.length === 100 && <p style={{ fontSize: "0.8rem", color: "#6b727b" }}>Se muestran los primeros 100: afiná la búsqueda.</p>}</div>}
          </div>
        </>
      )}
    </main>
  );
}
