"use client";
// FM RRHH — app/onboarding/page.tsx
// Onboarding: los ingresos en curso (quién tiene que hacer qué, y qué está
// vencido), iniciar el de un empleado nuevo, y editar las plantillas.
import { useEffect, useState } from "react";
import { RESPONSABLES, CLAVES_AUTOMATICAS, ETAPAS, type Responsable } from "@/lib/ingresos-reglas";

type Tarea = { id: string; titulo: string; detalle: string | null; responsable: Responsable; vence: string; clave: string | null; estado: "pendiente" | "hecha" | "no_aplica"; hechaPor: string | null; hechaEn: string | null; nota: string | null; etapa: string; vencida: boolean };
type Ingreso = {
  id: string; plantilla: string; fechaIngreso: string; estado: "en_curso" | "completado" | "cancelado"; legajoId: string;
  legajo: { numeroLegajo: number; apellido: string; nombre: string; centroCosto: { nombre: string } | null; jefe: { nombre: string; apellido: string } | null };
  tareas: Tarea[]; progreso: { total: number; resueltas: number; porcentaje: number; vencidas: number; vencidasDe: Record<Responsable, number>; completo: boolean };
};
type TareaPlantilla = { titulo: string; detalle?: string; responsable: Responsable; dia: number; clave?: string };
type Plantilla = { id: string; nombre: string; tareas: TareaPlantilla[] };
type SinPlan = { id: string; numero: number; apellido: string; nombre: string; fechaIngreso: string; reciente: boolean };

const dia = (iso: string) => new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
const caja: React.CSSProperties = { background: "white", border: "1px solid #dfe4e8", padding: "1rem", marginBottom: "1rem", maxWidth: "1000px" };
const btnSec: React.CSSProperties = { background: "white", color: "#163A5C", border: "1px solid #163A5C" };
const chico: React.CSSProperties = { padding: "0.2rem 0.6rem", fontSize: "0.8rem" };
const COLOR_RESP: Record<Responsable, string> = { rrhh: "#163A5C", jefe: "#8a5413", empleado: "#215446" };
const quien = (por: string | null) => (por === "sistema" ? "el sistema" : por === "empleado" ? "el empleado" : por?.startsWith("jefe: ") ? `${por.slice(6)} (jefe)` : por ?? "");

export default function OnboardingPage() {
  const [datos, setDatos] = useState<{ ingresos: Ingreso[]; plantillas: Plantilla[]; sinPlan: SinPlan[] } | null>(null);
  const [error, setError] = useState("");
  const [abierto, setAbierto] = useState<string | null>(null);
  const [nuevo, setNuevo] = useState({ legajoId: "", plantillaId: "" });
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);
  const [edit, setEdit] = useState<{ id: string; nombre: string; tareas: TareaPlantilla[] } | null>(null);
  const [errorEdit, setErrorEdit] = useState("");
  const [verCerrados, setVerCerrados] = useState(false);

  async function cargar() {
    const res = await fetch("/api/onboarding");
    const d = await res.json().catch(() => ({ error: "El servidor no devolvió una respuesta válida." }));
    if (!res.ok) { setError(d.error ?? "No se pudo cargar."); return; }
    setError("");
    setDatos(d);
    setNuevo((n) => ({ legajoId: n.legajoId, plantillaId: n.plantillaId || d.plantillas[0]?.id || "" }));
  }
  useEffect(() => { cargar(); }, []);

  async function enviar(url: string, cuerpo: unknown, metodo = "POST") {
    const res = await fetch(url, { method: metodo, headers: { "Content-Type": "application/json" }, body: metodo === "POST" ? JSON.stringify(cuerpo) : undefined });
    const d = await res.json().catch(() => ({ error: "El servidor no devolvió una respuesta válida." }));
    return { ok: res.ok, error: d.error as string | undefined, id: d.id as string | undefined };
  }

  async function iniciar() {
    setAviso(null);
    const r = await enviar("/api/onboarding", nuevo);
    if (!r.ok) { setAviso({ ok: false, texto: r.error ?? "No se pudo iniciar." }); return; }
    setAviso({ ok: true, texto: "Ingreso iniciado. Se le avisó al empleado y a su jefe, si tienen acceso al portal." });
    setNuevo({ ...nuevo, legajoId: "" });
    setAbierto(r.id ?? null);
    cargar();
  }
  async function marcar(t: Tarea, estado: Tarea["estado"]) {
    const r = await enviar(`/api/onboarding/tareas/${t.id}`, { estado });
    if (!r.ok) setError(r.error ?? "No se pudo guardar.");
    cargar();
  }
  async function cancelar(i: Ingreso) {
    const r = await enviar(`/api/onboarding/${i.id}`, { accion: "cancelar" });
    if (!r.ok) setError(r.error ?? "No se pudo cancelar.");
    cargar();
  }
  async function guardarPlantilla() {
    if (!edit) return;
    setErrorEdit("");
    const r = await enviar("/api/onboarding/plantillas", edit);
    if (!r.ok) { setErrorEdit(r.error ?? "No se pudo guardar."); return; }
    setEdit(null);
    cargar();
  }
  async function borrarPlantilla(p: Plantilla) {
    const r = await enviar(`/api/onboarding/plantillas?id=${p.id}`, null, "DELETE");
    if (!r.ok) setError(r.error ?? "No se pudo borrar.");
    cargar();
  }
  const cambiarTarea = (i: number, cambios: Partial<TareaPlantilla>) => edit && setEdit({ ...edit, tareas: edit.tareas.map((t, k) => (k === i ? { ...t, ...cambios } : t)) });

  const enCurso = (datos?.ingresos ?? []).filter((i) => i.estado === "en_curso");
  const cerrados = (datos?.ingresos ?? []).filter((i) => i.estado !== "en_curso");
  const recientes = (datos?.sinPlan ?? []).filter((l) => l.reciente);

  function tarjeta(i: Ingreso) {
    const p = i.progreso;
    const esta = abierto === i.id;
    return (
      <div key={i.id} style={{ ...caja, borderLeft: `4px solid ${i.estado === "cancelado" ? "#9aa5b1" : p.vencidas > 0 ? "#B23A3A" : i.estado === "completado" ? "#2F6F5E" : "#7FA8C6"}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <strong style={{ color: "#163A5C" }}>#{i.legajo.numeroLegajo} {i.legajo.apellido}, {i.legajo.nombre}</strong>
            {i.legajo.centroCosto && <span style={{ color: "#6b727b" }}> · {i.legajo.centroCosto.nombre}</span>}
            <div style={{ fontSize: "0.85rem", color: "#4A4F58" }}>
              Ingresa el {dia(i.fechaIngreso)} · jefe: {i.legajo.jefe ? `${i.legajo.jefe.nombre} ${i.legajo.jefe.apellido}` : <span style={{ color: "#B8752B" }}>sin cargar</span>} · plantilla «{i.plantilla}»
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
            {i.estado === "en_curso" && <p style={{ margin: "0.75rem 0 0" }}><button onClick={() => cancelar(i)} style={{ ...btnSec, ...chico, color: "#B23A3A", borderColor: "#B23A3A" }}>Cancelar este ingreso</button></p>}
          </div>
        )}
      </div>
    );
  }

  return (
    <main>
      <h1>Onboarding</h1>
      <p style={{ maxWidth: "860px" }}>
        Los pasos de ingreso de cada empleado nuevo, repartidos entre <strong>RR.HH.</strong>, su <strong>jefe</strong> y el <strong>propio empleado</strong>. El jefe y el
        empleado ven y tildan lo suyo desde el portal; lo que el sistema puede comprobar (acceso al portal, horario, legajo completo) se tilda solo.
      </p>
      {error && <p style={{ color: "#B23A3A" }}>{error}</p>}
      {!datos && !error && <p>Cargando…</p>}

      {datos && (
        <>
          {/* ── Iniciar ── */}
          <div style={caja}>
            <strong style={{ color: "#163A5C" }}>Iniciar un ingreso</strong>
            {recientes.length > 0 && (
              <p style={{ fontSize: "0.85rem", margin: "0.4rem 0 0" }}>
                Ingresaron hace poco (o están por ingresar) y todavía no tienen plan:{" "}
                {recientes.map((l) => (
                  <button key={l.id} onClick={() => setNuevo({ ...nuevo, legajoId: l.id })} style={{ ...btnSec, ...chico, marginRight: 6, background: nuevo.legajoId === l.id ? "#e8f0f6" : "white" }}>
                    {l.apellido}, {l.nombre} · {dia(l.fechaIngreso)}
                  </button>
                ))}
              </p>
            )}
            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "flex-end", marginTop: "0.6rem" }}>
              <label>Empleado<br />
                <select value={nuevo.legajoId} onChange={(e) => setNuevo({ ...nuevo, legajoId: e.target.value })}>
                  <option value="">Elegir…</option>
                  {datos.sinPlan.map((l) => <option key={l.id} value={l.id}>#{l.numero} {l.apellido}, {l.nombre} — ingreso {dia(l.fechaIngreso)}</option>)}
                </select>
              </label>
              <label>Plantilla<br />
                <select value={nuevo.plantillaId} onChange={(e) => setNuevo({ ...nuevo, plantillaId: e.target.value })}>
                  {datos.plantillas.map((p) => <option key={p.id} value={p.id}>{p.nombre} ({p.tareas.length} tareas)</option>)}
                </select>
              </label>
              <button onClick={iniciar} disabled={!nuevo.legajoId || !nuevo.plantillaId}>Iniciar</button>
            </div>
            <p style={{ fontSize: "0.78rem", color: "#6b727b", margin: "0.5rem 0 0" }}>Los vencimientos se calculan desde la fecha de ingreso del legajo. Si el empleado todavía no figura, cargalo primero en <a href="/legajos">Legajos</a>.</p>
            {aviso && <p style={{ color: aviso.ok ? "#2F6F5E" : "#B23A3A", margin: "0.5rem 0 0" }}>{aviso.texto}</p>}
          </div>

          <h2>En curso ({enCurso.length})</h2>
          {enCurso.length === 0 && <p>No hay ingresos en curso.</p>}
          {enCurso.map(tarjeta)}

          {cerrados.length > 0 && (
            <>
              <h2 style={{ marginTop: "1.5rem" }}>Cerrados en los últimos 60 días ({cerrados.length}) <button onClick={() => setVerCerrados(!verCerrados)} style={{ ...btnSec, ...chico, marginLeft: 8 }}>{verCerrados ? "Ocultar" : "Ver"}</button></h2>
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
            <p style={{ fontSize: "0.78rem", color: "#6b727b", margin: "0.6rem 0 0" }}>Cambiar una plantilla no modifica los ingresos que ya están en curso. Podés tener una por tipo de puesto (operarios, administración, choferes).</p>

            {edit && (
              <div style={{ marginTop: "1rem", background: "#F5F7F9", border: "1px solid #dfe4e8", padding: "1rem" }}>
                <label>Nombre de la plantilla<br /><input value={edit.nombre} onChange={(e) => setEdit({ ...edit, nombre: e.target.value })} maxLength={60} style={{ width: 320 }} /></label>
                <table style={{ marginTop: "0.75rem" }}>
                  <thead><tr><th style={{ width: 80 }}>Día</th><th>Tarea</th><th>Quién</th><th>Se tilda sola si…</th><th></th></tr></thead>
                  <tbody>
                    {edit.tareas.map((t, i) => (
                      <tr key={i}>
                        <td><input type="number" value={t.dia} onChange={(e) => cambiarTarea(i, { dia: Number(e.target.value) })} style={{ width: 64 }} aria-label="Día respecto del ingreso" /></td>
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
                <p style={{ fontSize: "0.78rem", color: "#6b727b", margin: "0.4rem 0" }}>Día: 0 es el día que ingresa; negativo, antes (−2 = dos días antes); 30, al mes. Al guardar se ordenan solas.</p>
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
