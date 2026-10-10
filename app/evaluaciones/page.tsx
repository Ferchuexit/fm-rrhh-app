"use client";
// FM RRHH — app/evaluaciones/page.tsx
// Evaluación de desempeño: abrir un ciclo, seguir el avance, revisar lo que
// cargó cada jefe, entregarle la evaluación al empleado y ver quién firmó.
import { useEffect, useMemo, useState } from "react";
import { ESCALA, ESTADOS, type Competencia } from "@/lib/evaluaciones-reglas";

type Resumen = { total: number; pendientes: number; completadas: number; entregadas: number; firmadas: number; promedioGeneral: number | null; porCompetencia: { nombre: string; promedio: number | null }[] };
type Ciclo = { id: string; nombre: string; formulario: string; fechaLimite: string; estado: "abierto" | "cerrado"; resumen: Resumen };
type Formulario = { id: string; nombre: string; competencias: Competencia[] };
type Legajo = { id: string; numero: number; apellido: string; nombre: string; centroCostoId: string | null; sector: string; conJefe: boolean };
type Evaluacion = {
  id: string; estado: keyof typeof ESTADOS; evaluadorId: string | null; puntajes: Record<string, number> | null; fortalezas: string | null; aMejorar: string | null; promedio: number | null;
  completadaPor: string | null; firma: string | null; comentarioEmpleado: string | null; firmadoEn: string | null;
  legajo: { numeroLegajo: number; apellido: string; nombre: string; centroCosto: { nombre: string } | null }; evaluador: { apellido: string; nombre: string } | null;
};
type Detalle = { ciclo: { id: string; competencias: Competencia[]; estado: string }; evaluaciones: Evaluacion[]; resumen: Resumen };

const dia = (iso: string) => new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
const nota = (n: number | null) => (n === null ? "—" : n.toFixed(2).replace(".", ","));
const colorNota = (n: number | null) => (n === null ? "#9aa5b1" : ESCALA[Math.max(1, Math.min(5, Math.round(n)))].color);
const caja: React.CSSProperties = { background: "white", border: "1px solid #dfe4e8", padding: "1rem", marginBottom: "1rem", maxWidth: "1000px" };
const btnSec: React.CSSProperties = { background: "white", color: "#163A5C", border: "1px solid #163A5C" };
const chico: React.CSSProperties = { padding: "0.2rem 0.6rem", fontSize: "0.8rem" };
const COLOR_ESTADO: Record<string, string> = { pendiente: "#B8752B", completada: "#7FA8C6", entregada: "#163A5C", firmada: "#2F6F5E" };

async function enviar(url: string, cuerpo: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo) });
  const d = await res.json().catch(() => ({ error: "El servidor no devolvió una respuesta válida." }));
  return { ok: res.ok, d };
}

export default function EvaluacionesPage() {
  const [datos, setDatos] = useState<{ hoy: string; ciclos: Ciclo[]; formularios: Formulario[]; legajos: Legajo[] } | null>(null);
  const [error, setError] = useState("");
  const [nuevo, setNuevo] = useState<{ nombre: string; formularioId: string; fechaLimite: string; legajoIds: string[] } | null>(null);
  const [errorNuevo, setErrorNuevo] = useState("");
  const [abierto, setAbierto] = useState<string | null>(null);
  const [detalle, setDetalle] = useState<Detalle | null>(null);
  const [fila, setFila] = useState<string | null>(null);
  const [edicion, setEdicion] = useState<{ puntajes: Record<string, number>; fortalezas: string; aMejorar: string } | null>(null);
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);
  const [formEdit, setFormEdit] = useState<{ id: string | null; nombre: string; competencias: Competencia[] } | null>(null);
  const [errorForm, setErrorForm] = useState("");

  async function cargar() {
    const res = await fetch("/api/evaluaciones");
    const d = await res.json().catch(() => ({ error: "El servidor no devolvió una respuesta válida." }));
    if (!res.ok) { setError(d.error ?? "No se pudo cargar."); return; }
    setError("");
    setDatos(d);
  }
  async function cargarDetalle(id: string) {
    const res = await fetch(`/api/evaluaciones/${id}`);
    const d = await res.json().catch(() => ({}));
    if (res.ok) setDetalle(d); else setAviso({ ok: false, texto: d.error ?? "No se pudo cargar el ciclo." });
  }
  useEffect(() => { cargar(); }, []);

  const sectores = useMemo(() => [...new Map((datos?.legajos ?? []).filter((l) => l.centroCostoId).map((l) => [l.centroCostoId!, l.sector])).entries()].sort((a, b) => a[1].localeCompare(b[1])), [datos]);
  const sinJefeElegidos = nuevo ? (datos?.legajos ?? []).filter((l) => nuevo.legajoIds.includes(l.id) && !l.conJefe).length : 0;

  function abrir(c: Ciclo) {
    setAviso(null); setFila(null); setEdicion(null); setDetalle(null);
    if (abierto === c.id) { setAbierto(null); return; }
    setAbierto(c.id);
    cargarDetalle(c.id);
  }
  async function crear() {
    if (!nuevo) return;
    setErrorNuevo("");
    const r = await enviar("/api/evaluaciones", nuevo);
    if (!r.ok) { setErrorNuevo(r.d.error ?? "No se pudo abrir el ciclo."); return; }
    setNuevo(null);
    await cargar();
    setAbierto(r.d.id); setDetalle(null); cargarDetalle(r.d.id);
    setAviso({ ok: true, texto: `Ciclo abierto: ${r.d.evaluaciones} ${r.d.evaluaciones === 1 ? "evaluación" : "evaluaciones"}. ${r.d.jefes ? `Se avisó a ${r.d.jefes} ${r.d.jefes === 1 ? "jefe" : "jefes"}.` : ""}${r.d.sinJefe ? ` ${r.d.sinJefe} no ${r.d.sinJefe === 1 ? "tiene" : "tienen"} jefe cargado: las completa RR.HH. desde acá.` : ""}` });
  }
  async function accionCiclo(id: string, cuerpo: Record<string, unknown>, ok: (d: any) => string) {
    setAviso(null);
    const r = await enviar(`/api/evaluaciones/${id}`, cuerpo);
    setAviso({ ok: r.ok, texto: r.ok ? ok(r.d) : r.d.error ?? "No se pudo completar." });
    if (r.ok) { cargar(); cargarDetalle(id); }
  }
  async function accionEvaluacion(e: Evaluacion, accion: "guardar" | "completar" | "devolver") {
    setAviso(null);
    const r = await enviar(`/api/evaluaciones/evaluacion/${e.id}`, { accion, ...(edicion ?? {}) });
    setAviso({ ok: r.ok, texto: r.ok ? (accion === "guardar" ? "Borrador guardado." : accion === "completar" ? "Evaluación completada: ya se puede entregar." : "Volvió a «sin completar».") : r.d.error ?? "No se pudo guardar." });
    if (r.ok) { if (accion !== "guardar") { setEdicion(null); } cargar(); if (abierto) cargarDetalle(abierto); }
  }
  async function guardarFormulario(borrar = false) {
    if (!formEdit) return;
    setErrorForm("");
    const r = await enviar("/api/evaluaciones/formularios", borrar ? { accion: "borrar", id: formEdit.id } : formEdit);
    if (!r.ok) { setErrorForm(r.d.error ?? "No se pudo guardar."); return; }
    setFormEdit(null);
    cargar();
  }

  const alternar = (id: string) => nuevo && setNuevo({ ...nuevo, legajoIds: nuevo.legajoIds.includes(id) ? nuevo.legajoIds.filter((x) => x !== id) : [...nuevo.legajoIds, id] });
  const sumar = (cc: string) => nuevo && setNuevo({ ...nuevo, legajoIds: [...new Set([...nuevo.legajoIds, ...(datos?.legajos ?? []).filter((l) => !cc || l.centroCostoId === cc).map((l) => l.id)])] });

  function barra(r: Resumen) {
    const partes: [number, string][] = [[r.firmadas, COLOR_ESTADO.firmada], [r.entregadas, COLOR_ESTADO.entregada], [r.completadas, COLOR_ESTADO.completada], [r.pendientes, "#E6EAEE"]];
    return <div style={{ display: "flex", height: 8, width: 220, background: "#E6EAEE" }}>{partes.map(([n, color], i) => n > 0 && <div key={i} style={{ width: `${(n / r.total) * 100}%`, background: color }} />)}</div>;
  }

  function puntos(competencias: Competencia[], e: Evaluacion) {
    const editable = !!edicion && fila === e.id;
    const p = editable ? edicion!.puntajes : e.puntajes ?? {};
    return (
      <div style={{ background: "#F7F9FA", padding: "0.75rem", fontSize: "0.88rem" }}>
        <table style={{ marginBottom: "0.6rem" }}>
          <tbody>
            {competencias.map((c, i) => (
              <tr key={i}>
                <td style={{ border: 0, padding: "0.2rem 0.75rem 0.2rem 0" }}><strong>{c.nombre}</strong>{c.descripcion && <div style={{ color: "#6b727b", fontSize: "0.8rem" }}>{c.descripcion}</div>}</td>
                <td style={{ border: 0, padding: "0.2rem 0", whiteSpace: "nowrap" }}>
                  {editable
                    ? [1, 2, 3, 4, 5].map((n) => <button key={n} title={ESCALA[n].nombre} onClick={() => setEdicion({ ...edicion!, puntajes: { ...edicion!.puntajes, [i]: n } })} style={{ ...chico, marginRight: 3, minWidth: 30, background: p[i] === n ? ESCALA[n].color : "white", color: p[i] === n && n === 5 ? "white" : "#12202e", border: "1px solid #b9c4cd" }}>{n}</button>)
                    : p[i] ? <span style={{ background: ESCALA[p[i]].color, color: p[i] === 5 ? "white" : "#12202e", padding: "0.1rem 0.5rem", fontWeight: 700 }}>{p[i]} · {ESCALA[p[i]].nombre}</span> : <span style={{ color: "#9aa5b1" }}>sin puntuar</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {editable ? (
          <>
            <label style={{ display: "block" }}>Fortalezas<br /><textarea rows={2} maxLength={1500} value={edicion!.fortalezas} onChange={(ev) => setEdicion({ ...edicion!, fortalezas: ev.target.value })} style={{ width: "100%", maxWidth: 700 }} /></label>
            <label style={{ display: "block", marginTop: "0.4rem" }}>A mejorar<br /><textarea rows={2} maxLength={1500} value={edicion!.aMejorar} onChange={(ev) => setEdicion({ ...edicion!, aMejorar: ev.target.value })} style={{ width: "100%", maxWidth: 700 }} /></label>
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.6rem" }}>
              <button onClick={() => accionEvaluacion(e, "completar")}>Completar</button>
              <button onClick={() => accionEvaluacion(e, "guardar")} style={btnSec}>Guardar borrador</button>
              <button onClick={() => setEdicion(null)} style={btnSec}>Cancelar</button>
            </div>
          </>
        ) : (
          <>
            {e.fortalezas && <p style={{ margin: "0 0 0.4rem", whiteSpace: "pre-wrap" }}><strong>Fortalezas:</strong> {e.fortalezas}</p>}
            {e.aMejorar && <p style={{ margin: "0 0 0.4rem", whiteSpace: "pre-wrap" }}><strong>A mejorar:</strong> {e.aMejorar}</p>}
            {e.completadaPor && <p style={{ margin: "0 0 0.4rem", color: "#6b727b" }}>La completó {e.completadaPor.replace(/^jefe: /, "su jefe, ")}.</p>}
            {e.firma && <p style={{ margin: "0 0 0.4rem", color: e.firma === "conforme" ? "#2F6F5E" : "#B23A3A" }}><strong>Firmó {e.firma === "conforme" ? "conforme" : "en disconformidad"}</strong> el {new Date(e.firmadoEn!).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })}{e.comentarioEmpleado ? <>: <span style={{ color: "#12202e", whiteSpace: "pre-wrap" }}>«{e.comentarioEmpleado}»</span></> : "."}</p>}
            {(e.estado === "pendiente" || e.estado === "completada") && (
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                {e.estado === "completada" && <button onClick={() => accionCiclo(abierto!, { accion: "entregar", ids: [e.id] }, () => "Entregada: el empleado ya la ve en el portal y recibió el aviso.")} style={chico}>Entregar al empleado</button>}
                <button onClick={() => setEdicion({ puntajes: { ...(e.puntajes ?? {}) }, fortalezas: e.fortalezas ?? "", aMejorar: e.aMejorar ?? "" })} style={{ ...btnSec, ...chico }}>{e.estado === "pendiente" ? (e.evaluadorId ? "Completarla yo" : "Completar") : "Corregir"}</button>
                {e.estado === "completada" && e.evaluadorId && <button onClick={() => accionEvaluacion(e, "devolver")} style={{ ...btnSec, ...chico }}>Devolver al jefe</button>}
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <main>
      <h1>Evaluación de desempeño</h1>
      <p style={{ maxWidth: "860px" }}>
        Abrís un ciclo y <strong>cada jefe evalúa a su gente desde el portal</strong>. Vos revisás lo que cargaron y se lo <strong>entregás al empleado</strong>, que la lee y la firma
        (conforme o en disconformidad). Mientras no la entregues, el empleado no la ve.
      </p>
      {error && <p style={{ color: "#B23A3A" }}>{error}</p>}
      {!datos && !error && <p>Cargando…</p>}

      {datos && (
        <>
          {!nuevo && <p><button onClick={() => { setNuevo({ nombre: "", formularioId: datos.formularios[0]?.id ?? "", fechaLimite: "", legajoIds: [] }); setErrorNuevo(""); }}>+ Abrir ciclo de evaluación</button></p>}
          {nuevo && (
            <div style={caja}>
              <strong style={{ color: "#163A5C" }}>Nuevo ciclo</strong>
              <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "flex-end", marginTop: "0.6rem" }}>
                <label>Nombre<br /><input value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} maxLength={80} placeholder="Evaluación anual 2026" style={{ width: 300 }} /></label>
                <label>Formulario<br /><select value={nuevo.formularioId} onChange={(e) => setNuevo({ ...nuevo, formularioId: e.target.value })}>{datos.formularios.map((f) => <option key={f.id} value={f.id}>{f.nombre} ({f.competencias.length} competencias)</option>)}</select></label>
                <label>Los jefes tienen hasta el<br /><input type="date" min={datos.hoy.slice(0, 10)} value={nuevo.fechaLimite} onChange={(e) => setNuevo({ ...nuevo, fechaLimite: e.target.value })} /></label>
              </div>
              <div style={{ marginTop: "0.8rem" }}>
                <strong>A quién se evalúa ({nuevo.legajoIds.length})</strong>{" "}
                <button onClick={() => sumar("")} style={{ ...btnSec, ...chico }}>+ Todos</button>{" "}
                {sectores.map(([id, nombre]) => <button key={id} onClick={() => sumar(id)} style={{ ...btnSec, ...chico, marginRight: 4 }}>+ {nombre}</button>)}
                {nuevo.legajoIds.length > 0 && <button onClick={() => setNuevo({ ...nuevo, legajoIds: [] })} style={{ ...btnSec, ...chico, color: "#B23A3A", borderColor: "#B23A3A" }}>Quitar todos</button>}
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.2rem 1rem", marginTop: "0.4rem", maxHeight: 180, overflowY: "auto", border: "1px solid #EEF1F4", padding: "0.5rem" }}>
                  {datos.legajos.map((l) => <label key={l.id} style={{ minWidth: 260, fontSize: "0.88rem" }}><input type="checkbox" checked={nuevo.legajoIds.includes(l.id)} onChange={() => alternar(l.id)} style={{ marginRight: 5 }} />{l.apellido}, {l.nombre} <span style={{ color: "#6b727b" }}>· {l.sector}{!l.conJefe && " · sin jefe"}</span></label>)}
                </div>
              </div>
              {sinJefeElegidos > 0 && <p style={{ fontSize: "0.85rem", color: "#8a5413", margin: "0.5rem 0 0" }}>{sinJefeElegidos} de los elegidos no {sinJefeElegidos === 1 ? "tiene" : "tienen"} jefe cargado («Reporta a» en el legajo): esas evaluaciones las completa RR.HH. desde esta pantalla.</p>}
              {errorNuevo && <p style={{ color: "#B23A3A", margin: "0.5rem 0 0" }}>{errorNuevo}</p>}
              <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}>
                <button onClick={crear}>Abrir ciclo y avisar a los jefes</button>
                <button onClick={() => setNuevo(null)} style={btnSec}>Cancelar</button>
              </div>
              <p style={{ fontSize: "0.78rem", color: "#6b727b", margin: "0.5rem 0 0" }}>Evalúa el jefe que cada uno tiene hoy. El ciclo guarda su copia del formulario: si después lo editás, este ciclo no cambia.</p>
            </div>
          )}
          {aviso && !abierto && <p style={{ color: aviso.ok ? "#2F6F5E" : "#B23A3A" }}>{aviso.texto}</p>}

          <h2>Ciclos ({datos.ciclos.length})</h2>
          {datos.ciclos.length === 0 && <p>Todavía no abriste ningún ciclo.</p>}
          {datos.ciclos.map((c) => {
            const r = c.resumen;
            const vencido = c.estado === "abierto" && r.pendientes > 0 && c.fechaLimite < datos.hoy;
            return (
              <div key={c.id} style={{ ...caja, borderLeft: `4px solid ${c.estado === "cerrado" ? "#9aa5b1" : vencido ? "#B23A3A" : "#7FA8C6"}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap", alignItems: "center" }}>
                  <div>
                    <strong style={{ color: "#163A5C" }}>{c.nombre}</strong> <span style={{ color: "#6b727b" }}>· {c.formulario}{c.estado === "cerrado" && " · cerrado"}</span>
                    <div style={{ fontSize: "0.85rem", color: vencido ? "#B23A3A" : "#4A4F58" }}>{c.estado === "abierto" ? `Los jefes tienen hasta el ${dia(c.fechaLimite)}${vencido ? " — ya venció" : ""}` : `Límite: ${dia(c.fechaLimite)}`}</div>
                  </div>
                  <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
                    <div style={{ fontSize: "0.82rem" }}>
                      {barra(r)}
                      <div style={{ marginTop: 3 }}>{r.total - r.pendientes} de {r.total} completadas · {r.firmadas} firmadas</div>
                    </div>
                    <div style={{ textAlign: "center", minWidth: 60 }}><div style={{ fontSize: "1.3rem", fontWeight: 700, color: "#163A5C" }}>{nota(r.promedioGeneral)}</div><div style={{ fontSize: "0.7rem", color: "#6b727b" }}>promedio</div></div>
                    <button onClick={() => abrir(c)} style={{ ...btnSec, ...chico }}>{abierto === c.id ? "Cerrar" : "Ver"}</button>
                  </div>
                </div>

                {abierto === c.id && !detalle && <p style={{ marginBottom: 0 }}>Cargando…</p>}
                {abierto === c.id && detalle && (
                  <div style={{ marginTop: "0.75rem", borderTop: "1px solid #EEF1F4", paddingTop: "0.75rem" }}>
                    {detalle.resumen.promedioGeneral !== null && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginBottom: "0.75rem" }}>
                        {detalle.resumen.porCompetencia.map((pc) => <span key={pc.nombre} style={{ border: "1px solid #dfe4e8", borderLeft: `4px solid ${colorNota(pc.promedio)}`, padding: "0.2rem 0.5rem", fontSize: "0.82rem" }}>{pc.nombre} <strong>{nota(pc.promedio)}</strong></span>)}
                      </div>
                    )}
                    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.6rem" }}>
                      {detalle.resumen.completadas > 0 && <button onClick={() => accionCiclo(c.id, { accion: "entregar" }, (d) => `${d.entregadas === 1 ? "Se entregó 1 evaluación" : `Se entregaron ${d.entregadas} evaluaciones`}: cada empleado recibió el aviso para leerla y firmarla.`)}>Entregar las {detalle.resumen.completadas} completadas</button>}
                      {c.estado === "abierto"
                        ? <button onClick={() => accionCiclo(c.id, { accion: "cerrar" }, () => "Ciclo cerrado: los jefes ya no pueden cargar ni corregir.")} style={btnSec}>Cerrar ciclo</button>
                        : <button onClick={() => accionCiclo(c.id, { accion: "reabrir" }, () => "Ciclo reabierto.")} style={btnSec}>Reabrir ciclo</button>}
                    </div>
                    {aviso && <p style={{ color: aviso.ok ? "#2F6F5E" : "#B23A3A", margin: "0 0 0.6rem" }}>{aviso.texto}</p>}
                    <table>
                      <thead><tr><th>Legajo</th><th>Empleado</th><th>Sector</th><th>Evalúa</th><th>Estado</th><th>Promedio</th><th></th></tr></thead>
                      <tbody>
                        {detalle.evaluaciones.map((e) => (
                          <FilaEvaluacion key={e.id} e={e} abierta={fila === e.id} alAbrir={() => { setFila(fila === e.id ? null : e.id); setEdicion(null); }}>{puntos(detalle.ciclo.competencias, e)}</FilaEvaluacion>
                        ))}
                      </tbody>
                    </table>
                    {detalle.evaluaciones.length < r.total && <p style={{ fontSize: "0.78rem", color: "#6b727b" }}>Ves solo a la gente de tus sectores.</p>}
                  </div>
                )}
              </div>
            );
          })}

          <h2 style={{ marginTop: "1.5rem" }}>Formularios</h2>
          <p style={{ maxWidth: 860, fontSize: "0.9rem" }}>Qué se puntúa (de 1 «{ESCALA[1].nombre.toLowerCase()}» a 5 «{ESCALA[5].nombre.toLowerCase()}»). Podés tener uno para planta, otro para administración, otro para mandos medios.</p>
          {!formEdit && (
            <div style={caja}>
              {datos.formularios.map((f) => (
                <div key={f.id} style={{ display: "flex", justifyContent: "space-between", gap: "1rem", padding: "0.4rem 0", borderBottom: "1px solid #EEF1F4" }}>
                  <span><strong>{f.nombre}</strong> <span style={{ color: "#6b727b", fontSize: "0.85rem" }}>· {f.competencias.map((c) => c.nombre).join(" · ")}</span></span>
                  <button onClick={() => { setFormEdit({ id: f.id, nombre: f.nombre, competencias: f.competencias.map((c) => ({ ...c })) }); setErrorForm(""); }} style={{ ...btnSec, ...chico }}>Editar</button>
                </div>
              ))}
              <button onClick={() => { setFormEdit({ id: null, nombre: "", competencias: [{ nombre: "", descripcion: "" }] }); setErrorForm(""); }} style={{ ...btnSec, marginTop: "0.6rem" }}>+ Nuevo formulario</button>
            </div>
          )}
          {formEdit && (
            <div style={caja}>
              <label>Nombre del formulario<br /><input value={formEdit.nombre} onChange={(e) => setFormEdit({ ...formEdit, nombre: e.target.value })} maxLength={60} style={{ width: 300 }} /></label>
              <div style={{ marginTop: "0.6rem" }}>
                {formEdit.competencias.map((c, i) => (
                  <div key={i} style={{ display: "flex", gap: "0.5rem", marginBottom: "0.35rem" }}>
                    <input value={c.nombre} placeholder="Competencia" maxLength={60} onChange={(e) => setFormEdit({ ...formEdit, competencias: formEdit.competencias.map((x, j) => (j === i ? { ...x, nombre: e.target.value } : x)) })} style={{ width: 220 }} />
                    <input value={c.descripcion ?? ""} placeholder="Qué se mira (opcional)" maxLength={200} onChange={(e) => setFormEdit({ ...formEdit, competencias: formEdit.competencias.map((x, j) => (j === i ? { ...x, descripcion: e.target.value } : x)) })} style={{ flex: 1 }} />
                    <button onClick={() => setFormEdit({ ...formEdit, competencias: formEdit.competencias.filter((_, j) => j !== i) })} style={{ ...btnSec, ...chico }} title="Quitar">✕</button>
                  </div>
                ))}
                <button onClick={() => setFormEdit({ ...formEdit, competencias: [...formEdit.competencias, { nombre: "", descripcion: "" }] })} style={{ ...btnSec, ...chico }}>+ Competencia</button>
              </div>
              {errorForm && <p style={{ color: "#B23A3A", margin: "0.5rem 0 0" }}>{errorForm}</p>}
              <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}>
                <button onClick={() => guardarFormulario()}>Guardar</button>
                <button onClick={() => setFormEdit(null)} style={btnSec}>Cancelar</button>
                {formEdit.id && datos.formularios.length > 1 && <button onClick={() => guardarFormulario(true)} style={{ ...btnSec, color: "#B23A3A", borderColor: "#B23A3A", marginLeft: "auto" }}>Borrar formulario</button>}
              </div>
              <p style={{ fontSize: "0.78rem", color: "#6b727b", margin: "0.5rem 0 0" }}>Los cambios valen para los ciclos que abras de acá en adelante.</p>
            </div>
          )}
        </>
      )}
    </main>
  );
}

function FilaEvaluacion({ e, abierta, alAbrir, children }: { e: Evaluacion; abierta: boolean; alAbrir: () => void; children: React.ReactNode }) {
  return (
    <>
      <tr>
        <td>{e.legajo.numeroLegajo}</td>
        <td>{e.legajo.apellido}, {e.legajo.nombre}</td>
        <td>{e.legajo.centroCosto?.nombre ?? "—"}</td>
        <td>{e.evaluador ? `${e.evaluador.apellido}, ${e.evaluador.nombre}` : <span style={{ color: "#8a5413" }}>RR.HH. (sin jefe)</span>}</td>
        <td><span style={{ color: COLOR_ESTADO[e.estado], fontWeight: 700 }}>{ESTADOS[e.estado]}</span>{e.firma === "disconforme" && <span style={{ color: "#B23A3A" }}> · en disconformidad</span>}</td>
        <td><strong style={{ borderBottom: `3px solid ${colorNota(e.promedio)}` }}>{nota(e.promedio)}</strong></td>
        <td><button onClick={alAbrir} style={{ background: "white", color: "#163A5C", border: "1px solid #163A5C", padding: "0.2rem 0.6rem", fontSize: "0.8rem" }}>{abierta ? "Ocultar" : "Ver"}</button></td>
      </tr>
      {abierta && <tr><td colSpan={7} style={{ padding: 0 }}>{children}</td></tr>}
    </>
  );
}
