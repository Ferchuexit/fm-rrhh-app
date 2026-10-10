"use client";
// FM RRHH — app/offboarding/page.tsx
// Offboarding: los egresos en curso (quién tiene que hacer qué, y qué está
// vencido), la entrevista de salida, la rotación del último año, iniciar
// un egreso y editar las plantillas.
import { useEffect, useState } from "react";
import { RESPONSABLES_EGRESO as RESPONSABLES, CLAVES_EGRESO as CLAVES_AUTOMATICAS, ETAPAS_EGRESO as ETAPAS, MOTIVOS_EGRESO, MOTIVOS_ENTREVISTA, RECONTRATABLE, type ResponsableEgreso as Responsable } from "@/lib/egresos-reglas";

type Tarea = { id: string; titulo: string; detalle: string | null; responsable: Responsable; vence: string; clave: string | null; estado: "pendiente" | "hecha" | "no_aplica"; hechaPor: string | null; hechaEn: string | null; etapa: string; vencida: boolean };
type Egreso = {
  id: string; plantilla: string; fechaEgreso: string; motivo: string; estado: "en_curso" | "completado" | "cancelado"; legajoId: string;
  entrevistaMotivo: string | null; recontratable: string | null; entrevistaComentario: string | null; entrevistaEn: string | null;
  legajo: { numeroLegajo: number; apellido: string; nombre: string; condicion: string; fechaIngreso: string; centroCosto: { nombre: string } | null; jefe: { nombre: string; apellido: string } | null };
  tareas: Tarea[]; progreso: { total: number; resueltas: number; porcentaje: number; vencidas: number; vencidasDe: Record<string, number>; completo: boolean };
};
type TareaPlantilla = { titulo: string; detalle?: string; responsable: Responsable; dia: number; clave?: string };
type Plantilla = { id: string; nombre: string; tareas: TareaPlantilla[] };
type Candidato = { id: string; numero: number; apellido: string; nombre: string; yaDeBaja: boolean; fechaEgreso: string | null };
type Conteo = { clave: string; nombre: string; cantidad: number };
type Rotacion = { total: number; voluntarios: number; porMotivo: Conteo[]; conEntrevista: number; porMotivoReal: Conteo[]; recontratables: number; dotacion: number };

const dia = (iso: string) => new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
const caja: React.CSSProperties = { background: "white", border: "1px solid #dfe4e8", padding: "1rem", marginBottom: "1rem", maxWidth: "1000px" };
const btnSec: React.CSSProperties = { background: "white", color: "#163A5C", border: "1px solid #163A5C" };
const chico: React.CSSProperties = { padding: "0.2rem 0.6rem", fontSize: "0.8rem" };
const COLOR_RESP: Record<Responsable, string> = { rrhh: "#163A5C", jefe: "#8a5413" };
const quien = (por: string | null) => (por === "sistema" ? "el sistema" : por?.startsWith("jefe: ") ? `${por.slice(6)} (jefe)` : por ?? "");
// Antigüedad al irse, en palabras: sirve para leer la rotación (no es lo
// mismo perder a alguien a los 3 meses que a los 10 años).
function antiguedad(desde: string, hasta: string) {
  const meses = Math.max(0, Math.round((new Date(hasta).getTime() - new Date(desde).getTime()) / (30.44 * 86400000)));
  return meses < 12 ? `${meses} ${meses === 1 ? "mes" : "meses"}` : `${Math.floor(meses / 12)} ${Math.floor(meses / 12) === 1 ? "año" : "años"}`;
}

export default function OffboardingPage() {
  const [datos, setDatos] = useState<{ hoy: string; egresos: Egreso[]; rotacion: Rotacion; plantillas: Plantilla[]; candidatos: Candidato[] } | null>(null);
  const [error, setError] = useState("");
  const [abierto, setAbierto] = useState<string | null>(null);
  const [nuevo, setNuevo] = useState({ legajoId: "", plantillaId: "", fechaEgreso: "", motivo: "" });
  const [entrevista, setEntrevista] = useState<{ id: string; entrevistaMotivo: string; recontratable: string; entrevistaComentario: string } | null>(null);
  const [errorEntrevista, setErrorEntrevista] = useState("");
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);
  const [edit, setEdit] = useState<{ id: string; nombre: string; tareas: TareaPlantilla[] } | null>(null);
  const [errorEdit, setErrorEdit] = useState("");
  const [verCerrados, setVerCerrados] = useState(false);

  async function cargar() {
    const res = await fetch("/api/offboarding");
    const d = await res.json().catch(() => ({ error: "El servidor no devolvió una respuesta válida." }));
    if (!res.ok) { setError(d.error ?? "No se pudo cargar."); return; }
    setError("");
    setDatos(d);
    setNuevo((n) => ({ ...n, plantillaId: n.plantillaId || d.plantillas[0]?.id || "" }));
  }
  useEffect(() => { cargar(); }, []);

  async function enviar(url: string, cuerpo: unknown, metodo = "POST") {
    const res = await fetch(url, { method: metodo, headers: { "Content-Type": "application/json" }, body: metodo === "POST" ? JSON.stringify(cuerpo) : undefined });
    const d = await res.json().catch(() => ({ error: "El servidor no devolvió una respuesta válida." }));
    return { ok: res.ok, error: d.error as string | undefined, id: d.id as string | undefined };
  }

  async function iniciar() {
    setAviso(null);
    const r = await enviar("/api/offboarding", nuevo);
    if (!r.ok) { setAviso({ ok: false, texto: r.error ?? "No se pudo iniciar." }); return; }
    setAviso({ ok: true, texto: "Egreso iniciado. Si el jefe tiene tareas, se le avisó (sin nombrar a la persona). A quien se va no se le avisa nada." });
    setNuevo({ ...nuevo, legajoId: "", fechaEgreso: "", motivo: "" });
    setAbierto(r.id ?? null);
    cargar();
  }
  async function marcar(t: Tarea, estado: Tarea["estado"]) {
    const r = await enviar(`/api/offboarding/tareas/${t.id}`, { estado });
    if (!r.ok) setError(r.error ?? "No se pudo guardar.");
    cargar();
  }
  async function cancelar(i: Egreso) {
    const r = await enviar(`/api/offboarding/${i.id}`, { accion: "cancelar" });
    if (!r.ok) setError(r.error ?? "No se pudo cancelar.");
    cargar();
  }
  async function guardarPlantilla() {
    if (!edit) return;
    setErrorEdit("");
    const r = await enviar("/api/offboarding/plantillas", edit);
    if (!r.ok) { setErrorEdit(r.error ?? "No se pudo guardar."); return; }
    setEdit(null);
    cargar();
  }
  async function borrarPlantilla(p: Plantilla) {
    const r = await enviar(`/api/offboarding/plantillas?id=${p.id}`, null, "DELETE");
    if (!r.ok) setError(r.error ?? "No se pudo borrar.");
    cargar();
  }
  const cambiarTarea = (i: number, cambios: Partial<TareaPlantilla>) => edit && setEdit({ ...edit, tareas: edit.tareas.map((t, k) => (k === i ? { ...t, ...cambios } : t)) });

  const enCurso = (datos?.egresos ?? []).filter((i) => i.estado === "en_curso");
  const cerrados = (datos?.egresos ?? []).filter((i) => i.estado !== "en_curso");
  const recientes = (datos?.candidatos ?? []).filter((l) => l.yaDeBaja);
  async function guardarEntrevista() {
    if (!entrevista) return;
    setErrorEntrevista("");
    const r = await enviar(`/api/offboarding/${entrevista.id}`, { accion: "entrevista", ...entrevista });
    if (!r.ok) { setErrorEntrevista(r.error ?? "No se pudo guardar."); return; }
    setEntrevista(null);
    cargar();
  }

  function tarjeta(i: Egreso) {
    const p = i.progreso;
    const esta = abierto === i.id;
    return (
      <div key={i.id} style={{ ...caja, borderLeft: `4px solid ${i.estado === "cancelado" ? "#9aa5b1" : p.vencidas > 0 ? "#B23A3A" : i.estado === "completado" ? "#2F6F5E" : "#7FA8C6"}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <strong style={{ color: "#163A5C" }}>#{i.legajo.numeroLegajo} {i.legajo.apellido}, {i.legajo.nombre}</strong>
            {i.legajo.centroCosto && <span style={{ color: "#6b727b" }}> · {i.legajo.centroCosto.nombre}</span>}
            <div style={{ fontSize: "0.85rem", color: "#4A4F58" }}>
              <strong>{MOTIVOS_EGRESO[i.motivo] ?? i.motivo}</strong> · último día {dia(i.fechaEgreso)} · {antiguedad(i.legajo.fechaIngreso, i.fechaEgreso)} en la empresa{i.legajo.jefe && ` · jefe: ${i.legajo.jefe.nombre} ${i.legajo.jefe.apellido}`}
              {i.estado !== "cancelado" && (i.entrevistaEn ? <span style={{ color: "#2F6F5E" }}> · entrevista cargada</span> : <span style={{ color: "#8a5413" }}> · sin entrevista de salida</span>)}
            </div>
          </div>
          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
            <div style={{ textAlign: "right", fontSize: "0.85rem" }}>
              <strong>{i.estado === "completado" ? "Completo" : i.estado === "cancelado" ? "Cancelado" : `${p.resueltas} de ${p.total}`}</strong>
              {i.estado === "en_curso" && p.vencidas > 0 && (
                <div style={{ color: "#B23A3A" }}>
                  {p.vencidas} {p.vencidas === 1 ? "vencida" : "vencidas"}: {(Object.keys(RESPONSABLES) as Responsable[]).filter((r) => p.vencidasDe[r] > 0).map((r) => `${RESPONSABLES[r]} ${p.vencidasDe[r]}`).join(" · ")}
                </div>
              )}
            </div>
            <div style={{ width: 120, height: 10, background: "#EEF1F4", borderRadius: 999, overflow: "hidden" }} role="progressbar" aria-valuenow={p.porcentaje} aria-valuemin={0} aria-valuemax={100}>
              <div style={{ width: `${p.porcentaje}%`, height: "100%", background: p.vencidas > 0 ? "#B8752B" : "#2F6F5E" }} />
            </div>
            <button onClick={() => setAbierto(esta ? null : i.id)} style={{ ...btnSec, ...chico }}>{esta ? "Cerrar" : "Ver tareas"}</button>
          </div>
        </div>

        {esta && (
          <div style={{ marginTop: "0.75rem", borderTop: "1px solid #EEF1F4", paddingTop: "0.5rem" }}>
            {/* ── Entrevista de salida ── */}
            {i.estado !== "cancelado" && entrevista?.id !== i.id && (
              <div style={{ background: "#F5F7F9", padding: "0.6rem 0.75rem", fontSize: "0.9rem", display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "flex-start", flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 260 }}>
                  <strong>Entrevista de salida</strong>
                  {i.entrevistaEn ? (
                    <>
                      <div>Se va por: <strong>{MOTIVOS_ENTREVISTA[i.entrevistaMotivo!] ?? i.entrevistaMotivo}</strong> · ¿Se lo volvería a tomar? <strong style={{ color: i.recontratable === "si" ? "#2F6F5E" : i.recontratable === "no" ? "#B23A3A" : "#8a5413" }}>{RECONTRATABLE[i.recontratable!] ?? i.recontratable}</strong></div>
                      {i.entrevistaComentario && <div style={{ whiteSpace: "pre-wrap", color: "#4A4F58" }}>«{i.entrevistaComentario}»</div>}
                    </>
                  ) : <div style={{ color: "#6b727b" }}>Todavía no se cargó. Es lo que después explica la rotación.</div>}
                </div>
                <button onClick={() => { setErrorEntrevista(""); setEntrevista({ id: i.id, entrevistaMotivo: i.entrevistaMotivo ?? "", recontratable: i.recontratable ?? "", entrevistaComentario: i.entrevistaComentario ?? "" }); }} style={{ ...btnSec, ...chico }}>{i.entrevistaEn ? "Corregir" : "Cargar entrevista"}</button>
              </div>
            )}
            {entrevista?.id === i.id && (
              <div style={{ background: "#F5F7F9", border: "1px solid #163A5C", padding: "0.75rem" }}>
                <strong>Entrevista de salida</strong>
                <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "flex-end", marginTop: "0.5rem" }}>
                  <label>Motivo principal por el que se va<br /><select value={entrevista.entrevistaMotivo} onChange={(e) => setEntrevista({ ...entrevista, entrevistaMotivo: e.target.value })}><option value="">Elegir…</option>{Object.entries(MOTIVOS_ENTREVISTA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
                  <label>¿La empresa lo volvería a tomar?<br /><select value={entrevista.recontratable} onChange={(e) => setEntrevista({ ...entrevista, recontratable: e.target.value })}><option value="">Elegir…</option>{Object.entries(RECONTRATABLE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
                </div>
                <label style={{ display: "block", marginTop: "0.5rem" }}>Qué dijo / qué mejoraría (opcional)<br /><textarea rows={3} maxLength={2000} value={entrevista.entrevistaComentario} onChange={(e) => setEntrevista({ ...entrevista, entrevistaComentario: e.target.value })} style={{ width: "100%", maxWidth: 700 }} /></label>
                {errorEntrevista && <p style={{ color: "#B23A3A", margin: "0.4rem 0 0" }}>{errorEntrevista}</p>}
                <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}><button onClick={guardarEntrevista}>Guardar entrevista</button><button onClick={() => setEntrevista(null)} style={btnSec}>Cancelar</button></div>
                <p style={{ fontSize: "0.78rem", color: "#6b727b", margin: "0.4rem 0 0" }}>Solo la ve RR.HH. Ni el jefe ni la persona la ven desde el portal.</p>
              </div>
            )}
            {ETAPAS.filter((e) => i.tareas.some((t) => t.etapa === e)).map((etapa) => (
              <div key={etapa}>
                <div style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.04em", color: "#6b727b", margin: "0.7rem 0 0.2rem" }}>{etapa}</div>
                {i.tareas.filter((t) => t.etapa === etapa).map((t) => (
                  <div key={t.id} style={{ display: "flex", gap: "0.6rem", alignItems: "flex-start", padding: "0.35rem 0", borderBottom: "1px solid #F5F7F9" }}>
                    <input type="checkbox" checked={t.estado === "hecha"} disabled={i.estado !== "en_curso" || t.estado === "no_aplica"} onChange={() => marcar(t, t.estado === "hecha" ? "pendiente" : "hecha")} aria-label={`Marcar: ${t.titulo}`} style={{ marginTop: "0.25rem" }} />
                    <div style={{ flex: 1, opacity: t.estado === "pendiente" ? 1 : 0.6 }}>
                      <span style={{ textDecoration: t.estado === "no_aplica" ? "line-through" : undefined }}>{t.titulo}</span>{" "}
                      <span style={{ fontSize: "0.72rem", fontWeight: 700, color: COLOR_RESP[t.responsable], border: `1px solid ${COLOR_RESP[t.responsable]}`, borderRadius: 999, padding: "0 0.4rem", whiteSpace: "nowrap" }}>{RESPONSABLES[t.responsable]}</span>
                      {t.clave && <span title={`Se tilda sola cuando ${CLAVES_AUTOMATICAS[t.clave]}`} style={{ fontSize: "0.72rem", color: "#6b727b", marginLeft: 6 }}>⚙ automática</span>}
                      {t.detalle && <div style={{ fontSize: "0.8rem", color: "#6b727b" }}>{t.detalle}</div>}
                      <div style={{ fontSize: "0.78rem", color: t.vencida ? "#B23A3A" : "#6b727b" }}>
                        {t.estado === "hecha" ? `Hecha por ${quien(t.hechaPor)}${t.hechaEn ? ` el ${new Date(t.hechaEn).toLocaleDateString("es-AR")}` : ""}` : t.estado === "no_aplica" ? "No aplica" : `${t.vencida ? "Venció" : "Vence"} el ${dia(t.vence)}`}
                      </div>
                    </div>
                    {i.estado === "en_curso" && t.estado !== "hecha" && (
                      <button onClick={() => marcar(t, t.estado === "no_aplica" ? "pendiente" : "no_aplica")} style={{ ...btnSec, ...chico }}>{t.estado === "no_aplica" ? "Sí aplica" : "No aplica"}</button>
                    )}
                  </div>
                ))}
              </div>
            ))}
            {i.estado === "en_curso" && <p style={{ margin: "0.75rem 0 0" }}><button onClick={() => cancelar(i)} style={{ ...btnSec, ...chico, color: "#B23A3A", borderColor: "#B23A3A" }}>Cancelar este egreso (la persona se queda, o se cargó por error)</button></p>}
          </div>
        )}
      </div>
    );
  }

  return (
    <main>
      <h1>Offboarding</h1>
      <p style={{ maxWidth: "860px" }}>
        Los pasos de salida de quien deja la empresa, repartidos entre <strong>RR.HH.</strong> y su <strong>jefe</strong> (que ve y tilda lo suyo desde el portal). Lo que el sistema
        puede comprobar (legajo dado de baja, gente a cargo reasignada, acceso al portal cerrado) se tilda solo. Con la <strong>entrevista de salida</strong> queda registrado por qué se va la gente.
      </p>
      {error && <p style={{ color: "#B23A3A" }}>{error}</p>}
      {!datos && !error && <p>Cargando…</p>}

      {datos && (
        <>
          {/* ── Rotación ── */}
          {datos.rotacion.total > 0 && (
            <div style={caja}>
              <strong style={{ color: "#163A5C" }}>Rotación de los últimos 12 meses</strong>
              <div style={{ display: "flex", gap: "2rem", flexWrap: "wrap", marginTop: "0.5rem" }}>
                <div>
                  <div style={{ fontSize: "1.6rem", fontWeight: 700, color: "#163A5C" }}>{datos.rotacion.total} <span style={{ fontSize: "0.85rem", fontWeight: 400, color: "#6b727b" }}>{datos.rotacion.total === 1 ? "salida" : "salidas"}{datos.rotacion.dotacion > 0 && ` · ${Math.round((datos.rotacion.total / datos.rotacion.dotacion) * 100)}% de la dotación actual (${datos.rotacion.dotacion})`}</span></div>
                  <div style={{ fontSize: "0.85rem" }}>{datos.rotacion.voluntarios} por decisión de la persona · {datos.rotacion.total - datos.rotacion.voluntarios} por decisión de la empresa u otros</div>
                  {datos.rotacion.conEntrevista > 0 && <div style={{ fontSize: "0.85rem" }}>La empresa volvería a tomar a {datos.rotacion.recontratables} de {datos.rotacion.conEntrevista} entrevistados</div>}
                </div>
                {([["Cómo terminó", datos.rotacion.porMotivo, datos.rotacion.total], ["Por qué se fueron (entrevistas)", datos.rotacion.porMotivoReal, datos.rotacion.conEntrevista]] as [string, Conteo[], number][]).filter(([, lista]) => lista.length > 0).map(([titulo, lista, total]) => (
                  <div key={titulo} style={{ minWidth: 280 }}>
                    <div style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.04em", color: "#6b727b", marginBottom: 4 }}>{titulo}</div>
                    {lista.map((m) => (
                      <div key={m.clave} style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem", marginBottom: 3 }}>
                        <span style={{ width: 190 }}>{m.nombre}</span>
                        <span style={{ width: 90, height: 8, background: "#EEF1F4" }}><span style={{ display: "block", width: `${(m.cantidad / total) * 100}%`, height: 8, background: "#163A5C" }} /></span>
                        <strong>{m.cantidad}</strong>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
              {datos.rotacion.conEntrevista < datos.rotacion.total && <p style={{ fontSize: "0.78rem", color: "#6b727b", margin: "0.5rem 0 0" }}>{datos.rotacion.total - datos.rotacion.conEntrevista} {datos.rotacion.total - datos.rotacion.conEntrevista === 1 ? "salida no tiene" : "salidas no tienen"} entrevista cargada: sin eso, el «por qué» queda incompleto.</p>}
            </div>
          )}

          {/* ── Iniciar ── */}
          <div style={caja}>
            <strong style={{ color: "#163A5C" }}>Iniciar un egreso</strong>
            {recientes.length > 0 && (
              <p style={{ fontSize: "0.85rem", margin: "0.4rem 0 0" }}>
                Ya figuran de baja en Legajos y no tienen egreso cargado:{" "}
                {recientes.map((l) => (
                  <button key={l.id} onClick={() => setNuevo({ ...nuevo, legajoId: l.id, fechaEgreso: l.fechaEgreso?.slice(0, 10) ?? nuevo.fechaEgreso })} style={{ ...btnSec, ...chico, marginRight: 6, background: nuevo.legajoId === l.id ? "#e8f0f6" : "white" }}>
                    {l.apellido}, {l.nombre}{l.fechaEgreso && ` · ${dia(l.fechaEgreso)}`}
                  </button>
                ))}
              </p>
            )}
            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "flex-end", marginTop: "0.6rem" }}>
              <label>Quién se va<br />
                <select value={nuevo.legajoId} onChange={(e) => setNuevo({ ...nuevo, legajoId: e.target.value })}>
                  <option value="">Elegir…</option>
                  {datos.candidatos.map((l) => <option key={l.id} value={l.id}>#{l.numero} {l.apellido}, {l.nombre}{l.yaDeBaja ? " (ya de baja)" : ""}</option>)}
                </select>
              </label>
              <label>Último día de trabajo<br /><input type="date" value={nuevo.fechaEgreso} onChange={(e) => setNuevo({ ...nuevo, fechaEgreso: e.target.value })} /></label>
              <label>Motivo<br />
                <select value={nuevo.motivo} onChange={(e) => setNuevo({ ...nuevo, motivo: e.target.value })}>
                  <option value="">Elegir…</option>
                  {Object.entries(MOTIVOS_EGRESO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </label>
              <label>Plantilla<br />
                <select value={nuevo.plantillaId} onChange={(e) => setNuevo({ ...nuevo, plantillaId: e.target.value })}>
                  {datos.plantillas.map((p) => <option key={p.id} value={p.id}>{p.nombre} ({p.tareas.length} tareas)</option>)}
                </select>
              </label>
              <button onClick={iniciar} disabled={!nuevo.legajoId || !nuevo.plantillaId || !nuevo.fechaEgreso || !nuevo.motivo}>Iniciar</button>
            </div>
            <p style={{ fontSize: "0.78rem", color: "#6b727b", margin: "0.5rem 0 0" }}>Iniciar el egreso <strong>no da de baja el legajo</strong> ni cierra su acceso al portal: son tareas de la lista, y se tildan solas cuando las hacés en Legajos y en Accesos al portal. La liquidación final se hace como siempre.</p>
            {aviso && <p style={{ color: aviso.ok ? "#2F6F5E" : "#B23A3A", margin: "0.5rem 0 0" }}>{aviso.texto}</p>}
          </div>

          <h2>En curso ({enCurso.length})</h2>
          {enCurso.length === 0 && <p>No hay egresos en curso.</p>}
          {enCurso.map(tarjeta)}

          {cerrados.length > 0 && (
            <>
              <h2 style={{ marginTop: "1.5rem" }}>Cerrados en los últimos 90 días ({cerrados.length}) <button onClick={() => setVerCerrados(!verCerrados)} style={{ ...btnSec, ...chico, marginLeft: 8 }}>{verCerrados ? "Ocultar" : "Ver"}</button></h2>
              {verCerrados && cerrados.map(tarjeta)}
            </>
          )}

          {/* ── Plantillas ── */}
          <h2 style={{ marginTop: "1.5rem" }}>Plantillas</h2>
          <div style={caja}>
            {datos.plantillas.map((p) => (
              <div key={p.id} style={{ display: "flex", gap: "0.75rem", alignItems: "center", padding: "0.5rem 0", borderBottom: "1px solid #EEF1F4", flexWrap: "wrap" }}>
                <strong style={{ minWidth: 180 }}>{p.nombre}</strong>
                <span style={{ flex: 1, color: "#4A4F58", fontSize: "0.88rem" }}>
                  {p.tareas.length} tareas — {(Object.keys(RESPONSABLES) as Responsable[]).map((r) => `${RESPONSABLES[r]}: ${p.tareas.filter((t) => t.responsable === r).length}`).join(" · ")}
                </span>
                <button onClick={() => { setEdit({ id: p.id, nombre: p.nombre, tareas: p.tareas }); setErrorEdit(""); }} style={{ ...btnSec, ...chico }}>Editar</button>
                <button onClick={() => { setEdit({ id: "", nombre: `${p.nombre} (copia)`, tareas: p.tareas }); setErrorEdit(""); }} style={{ ...btnSec, ...chico }}>Copiar</button>
                <button onClick={() => borrarPlantilla(p)} style={{ ...btnSec, ...chico, color: "#B23A3A", borderColor: "#B23A3A" }}>Borrar</button>
              </div>
            ))}
            <p style={{ fontSize: "0.78rem", color: "#6b727b", margin: "0.6rem 0 0" }}>Cambiar una plantilla no modifica los egresos que ya están en curso. Podés tener una por tipo de salida (renuncia, despido, jubilación) o de puesto.</p>

            {edit && (
              <div style={{ marginTop: "1rem", background: "#F5F7F9", border: "1px solid #dfe4e8", padding: "1rem" }}>
                <label>Nombre de la plantilla<br /><input value={edit.nombre} onChange={(e) => setEdit({ ...edit, nombre: e.target.value })} maxLength={60} style={{ width: 320 }} /></label>
                <table style={{ marginTop: "0.75rem" }}>
                  <thead><tr><th style={{ width: 80 }}>Día</th><th>Tarea</th><th>Quién</th><th>Se tilda sola si…</th><th></th></tr></thead>
                  <tbody>
                    {edit.tareas.map((t, i) => (
                      <tr key={i}>
                        <td><input type="number" value={t.dia} onChange={(e) => cambiarTarea(i, { dia: Number(e.target.value) })} style={{ width: 64 }} aria-label="Día respecto del último día" /></td>
                        <td>
                          <input value={t.titulo} onChange={(e) => cambiarTarea(i, { titulo: e.target.value })} maxLength={120} style={{ width: "100%", minWidth: 260 }} aria-label="Título de la tarea" />
                          <input value={t.detalle ?? ""} onChange={(e) => cambiarTarea(i, { detalle: e.target.value })} maxLength={300} placeholder="Aclaración (opcional)" style={{ width: "100%", fontSize: "0.8rem", marginTop: 3 }} aria-label="Aclaración" />
                        </td>
                        <td>
                          <select value={t.responsable} onChange={(e) => cambiarTarea(i, { responsable: e.target.value as Responsable })} aria-label="Quién la hace">
                            {(Object.keys(RESPONSABLES) as Responsable[]).map((r) => <option key={r} value={r}>{RESPONSABLES[r]}</option>)}
                          </select>
                        </td>
                        <td>
                          <select value={t.clave ?? ""} onChange={(e) => cambiarTarea(i, { clave: e.target.value || undefined })} style={{ maxWidth: 230 }} aria-label="Comprobación automática">
                            <option value="">— se tilda a mano —</option>
                            {Object.entries(CLAVES_AUTOMATICAS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                          </select>
                        </td>
                        <td><button onClick={() => setEdit({ ...edit, tareas: edit.tareas.filter((_, k) => k !== i) })} style={{ ...btnSec, ...chico, color: "#B23A3A", borderColor: "#B23A3A" }} aria-label={`Quitar ${t.titulo}`}>Quitar</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p style={{ fontSize: "0.78rem", color: "#6b727b", margin: "0.4rem 0" }}>Día: 0 es el último día de trabajo; negativo, antes (−3 = tres días antes); 10, diez días después. Son un orden sugerido, no plazos legales. Al guardar se ordenan solas.</p>
                {errorEdit && <p style={{ color: "#B23A3A", margin: "0.4rem 0" }}>{errorEdit}</p>}
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button onClick={() => setEdit({ ...edit, tareas: [...edit.tareas, { titulo: "", responsable: "rrhh", dia: 0 }] })} style={btnSec}>+ Agregar tarea</button>
                  <button onClick={guardarPlantilla}>Guardar plantilla</button>
                  <button onClick={() => setEdit(null)} style={btnSec}>Cancelar</button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </main>
  );
}
