"use client";
// FM RRHH — app/turnos/page.tsx
// Turnos: quién trabaja cada día de la semana, asignar un horario (o una
// rotación) a una o varias personas, y definir los horarios de la empresa.
import { useEffect, useMemo, useState } from "react";
import { COLORES_HORARIO, NOMBRE_DIA } from "@/lib/turnos-reglas";

type Jornada = { tipo: "sin_asignar" | "franco" | "trabaja" | "feriado"; horario?: string; color?: string; ingreso?: string; salida?: string; nocturno?: boolean; cambio?: boolean; feriado?: string };
type Feriado = { id?: string; fecha: string; nombre: string };
type Cambio = { legajoId: string; fecha: string; tipo: string; ingreso: string | null; salida: string | null; motivo: string | null };
type Horario = { id: string; nombre: string; color: string; dias: Record<string, { ingreso: string; salida: string }>; resumen: string };
type Fila = { id: string; numero: number; apellido: string; nombre: string; centroCostoId: string | null; sector: string; asignacion: { desde: string; horarioIds: string[] } | null; proxima: { desde: string; horarioIds: string[] } | null; jornadas: Jornada[] };

const DIA_MS = 24 * 3600 * 1000;
const ORDEN = [1, 2, 3, 4, 5, 6, 0]; // la semana arranca el lunes
const iso = (d: Date) => d.toISOString().slice(0, 10);
const corta = (d: Date) => `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
const caja: React.CSSProperties = { background: "white", border: "1px solid #dfe4e8", padding: "1rem", marginBottom: "1.5rem", maxWidth: "1100px" };
const btnSec: React.CSSProperties = { background: "white", color: "#163A5C", border: "1px solid #163A5C" };
const HORARIO_VACIO = { id: "", nombre: "", color: COLORES_HORARIO[0], dias: {} as Horario["dias"] };

export default function TurnosPage() {
  const [semana, setSemana] = useState(""); // lunes, AAAA-MM-DD ("" = esta semana)
  const [datos, setDatos] = useState<{ semana: string; horarios: Horario[]; legajos: Fila[]; feriados: Feriado[]; cambios: Cambio[] } | null>(null);
  const [error, setError] = useState("");
  const [sector, setSector] = useState("");
  const [elegidos, setElegidos] = useState<Set<string>>(new Set());
  // asignar
  const [rotacion, setRotacion] = useState<string[]>([""]);
  const [desde, setDesde] = useState("");
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);
  const [trabajando, setTrabajando] = useState(false);
  // editar horario
  const [form, setForm] = useState<typeof HORARIO_VACIO | null>(null);
  const [errorForm, setErrorForm] = useState("");
  // cambio de un día (se abre tocando una celda de la tabla)
  const [cambio, setCambio] = useState<{ legajoId: string; nombre: string; fecha: string; tipo: "franco" | "horario"; ingreso: string; salida: string; motivo: string; existe: boolean } | null>(null);
  const [errorCambio, setErrorCambio] = useState("");
  // feriados del año
  const [anioFeriados, setAnioFeriados] = useState(new Date().getFullYear());
  const [feriados, setFeriados] = useState<Feriado[]>([]);
  const [nuevoFeriado, setNuevoFeriado] = useState({ fecha: "", nombre: "" });
  const [avisoFeriados, setAvisoFeriados] = useState<{ ok: boolean; texto: string } | null>(null);

  async function cargar(s = semana) {
    const res = await fetch(`/api/turnos${s ? `?semana=${s}` : ""}`);
    const d = await res.json().catch(() => ({ error: "El servidor no devolvió una respuesta válida." }));
    if (!res.ok) { setError(d.error ?? "No se pudieron cargar los turnos."); return; }
    setError("");
    setDatos(d);
    if (!desde) setDesde(iso(new Date(new Date(d.semana).getTime() + 7 * DIA_MS))); // por defecto, el lunes que viene
  }
  useEffect(() => { cargar(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [semana]);

  async function cargarFeriados(anio = anioFeriados) {
    const res = await fetch(`/api/turnos/feriados?anio=${anio}`);
    if (res.ok) setFeriados((await res.json()).feriados);
  }
  useEffect(() => { cargarFeriados(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [anioFeriados]);

  async function feriado(cuerpo: unknown, metodo = "POST", query = "") {
    setAvisoFeriados(null);
    const res = await fetch(`/api/turnos/feriados${query}`, { method: metodo, headers: { "Content-Type": "application/json" }, body: metodo === "POST" ? JSON.stringify(cuerpo) : undefined });
    const d = await res.json().catch(() => ({ error: "El servidor no devolvió una respuesta válida." }));
    if (!res.ok) { setAvisoFeriados({ ok: false, texto: d.error ?? "No se pudo guardar." }); return; }
    if (d.agregados !== undefined) setAvisoFeriados({ ok: true, texto: d.agregados === 0 ? "Ya estaban todos cargados." : `Se agregaron ${d.agregados}. Faltan los trasladables y los puentes de ese año: sumalos a mano según el calendario oficial.` });
    setNuevoFeriado({ fecha: "", nombre: "" });
    cargarFeriados();
    cargar();
  }

  function abrirCambio(l: Fila, d: Date, j: Jornada) {
    const previo = datos?.cambios.find((c) => c.legajoId === l.id && c.fecha.slice(0, 10) === iso(d));
    setErrorCambio("");
    setCambio({
      legajoId: l.id, nombre: `${l.apellido}, ${l.nombre}`, fecha: iso(d), existe: !!previo,
      tipo: previo ? (previo.tipo as "franco" | "horario") : j.tipo === "trabaja" ? "franco" : "horario",
      ingreso: previo?.ingreso ?? j.ingreso ?? "06:00", salida: previo?.salida ?? j.salida ?? "14:00", motivo: previo?.motivo ?? "",
    });
  }
  async function guardarCambio(quitar = false) {
    if (!cambio) return;
    setErrorCambio("");
    const res = await fetch("/api/turnos/cambios", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...cambio, tipo: quitar ? "quitar" : cambio.tipo }) });
    const d = await res.json().catch(() => ({ error: "El servidor no devolvió una respuesta válida." }));
    if (!res.ok) { setErrorCambio(d.error ?? "No se pudo guardar."); return; }
    setCambio(null);
    cargar();
  }

  const lunes = datos ? new Date(datos.semana) : null;
  const dias = lunes ? Array.from({ length: 7 }, (_, i) => new Date(lunes.getTime() + i * DIA_MS)) : [];
  const sectores = useMemo(() => [...new Map((datos?.legajos ?? []).filter((l) => l.centroCostoId).map((l) => [l.centroCostoId!, l.sector])).entries()].sort((a, b) => a[1].localeCompare(b[1])), [datos]);
  const filas = (datos?.legajos ?? []).filter((l) => !sector || l.centroCostoId === sector);
  const nombreDe = (id: string) => datos?.horarios.find((h) => h.id === id)?.nombre ?? "(borrado)";
  const todosElegidos = filas.length > 0 && filas.every((f) => elegidos.has(f.id));

  function mover(semanas: number) {
    if (lunes) setSemana(iso(new Date(lunes.getTime() + semanas * 7 * DIA_MS)));
  }
  function alternar(id: string) {
    setElegidos((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  async function asignar(quitar = false) {
    const horarioIds = quitar ? [] : rotacion.filter(Boolean);
    if (!quitar && horarioIds.length === 0) { setAviso({ ok: false, texto: "Elegí un horario." }); return; }
    setTrabajando(true);
    setAviso(null);
    const res = await fetch("/api/turnos/asignaciones", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ legajoIds: [...elegidos], horarioIds, desde }) });
    const d = await res.json().catch(() => ({ error: "El servidor no devolvió una respuesta válida." }));
    setTrabajando(false);
    if (!res.ok) { setAviso({ ok: false, texto: d.error ?? "No se pudo asignar." }); return; }
    setAviso({ ok: true, texto: quitar ? `Se quitó el horario a ${d.personas} ${d.personas === 1 ? "persona" : "personas"}.` : `Horario asignado a ${d.personas} ${d.personas === 1 ? "persona" : "personas"}. Les llega un aviso al portal.` });
    setElegidos(new Set());
    cargar();
  }

  async function guardarHorario() {
    if (!form) return;
    setErrorForm("");
    const res = await fetch("/api/turnos/horarios", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const d = await res.json().catch(() => ({ error: "El servidor no devolvió una respuesta válida." }));
    if (!res.ok) { setErrorForm(d.error ?? "No se pudo guardar."); return; }
    setForm(null);
    cargar();
  }
  async function borrarHorario(h: Horario) {
    const res = await fetch(`/api/turnos/horarios?id=${h.id}`, { method: "DELETE" });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { setError(d.error ?? "No se pudo borrar."); return; }
    cargar();
  }
  function cambiarDia(dia: number, campo: "ingreso" | "salida" | null, valor = "") {
    if (!form) return;
    const copia = { ...form.dias };
    if (campo === null) { if (copia[dia]) delete copia[dia]; else copia[dia] = { ingreso: copia[1]?.ingreso ?? "08:00", salida: copia[1]?.salida ?? "17:00" }; }
    else copia[dia] = { ...copia[dia], [campo]: valor };
    setForm({ ...form, dias: copia });
  }
  function copiarLunes() {
    if (!form?.dias[1]) return;
    setForm({ ...form, dias: { ...form.dias, 2: { ...form.dias[1] }, 3: { ...form.dias[1] }, 4: { ...form.dias[1] }, 5: { ...form.dias[1] } } });
  }

  return (
    <main>
      <h1>Turnos</h1>
      <p style={{ maxWidth: "860px" }}>
        Definí los <strong>horarios</strong> de la empresa y asignáselos a la gente, fijos o en <strong>rotación semanal</strong>. Con el horario cargado,{" "}
        <a href="/asistencia">Asistencia</a> detecta sola las tardanzas y ausencias, y cada persona ve el suyo en el portal.
      </p>
      {error && <p style={{ color: "#B23A3A" }}>{error}</p>}
      {!datos && !error && <p>Cargando…</p>}

      {datos && lunes && (
        <>
          {datos.horarios.length === 0 && (
            <div style={{ ...caja, borderLeft: "4px solid #B8752B" }}>
              <strong>Todavía no hay horarios cargados.</strong> Empezá por crear uno abajo (por ejemplo, "Mañana", de lunes a viernes de 06:00 a 14:00) y después asignáselo a la gente.
            </div>
          )}

          {/* ── Semana ── */}
          <div style={caja}>
            <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap", marginBottom: "0.75rem" }}>
              <button onClick={() => mover(-1)} style={btnSec} aria-label="Semana anterior">‹</button>
              <strong style={{ color: "#163A5C", minWidth: "210px", textAlign: "center" }}>Semana del {corta(dias[0])} al {corta(dias[6])}</strong>
              <button onClick={() => mover(1)} style={btnSec} aria-label="Semana siguiente">›</button>
              <button onClick={() => setSemana("")} style={btnSec}>Hoy</button>
              {sectores.length > 0 && (
                <label style={{ marginLeft: "auto" }}>Centro de costo:{" "}
                  <select value={sector} onChange={(e) => setSector(e.target.value)}>
                    <option value="">Todos</option>
                    {sectores.map(([id, nombre]) => <option key={id} value={id}>{nombre}</option>)}
                  </select>
                </label>
              )}
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ minWidth: "900px" }}>
                <thead>
                  <tr>
                    <th style={{ width: 28 }}><input type="checkbox" aria-label="Elegir todos" checked={todosElegidos} onChange={() => setElegidos(todosElegidos ? new Set() : new Set(filas.map((f) => f.id)))} /></th>
                    <th>Empleado</th>
                    <th>Horario</th>
                    {dias.map((d) => {
                      const f = datos.feriados.find((x) => x.fecha.slice(0, 10) === iso(d));
                      return <th key={iso(d)} style={{ textAlign: "center" }} title={f ? `Feriado: ${f.nombre}` : undefined}>{NOMBRE_DIA[d.getUTCDay()].slice(0, 3)} {corta(d)}{f && <div style={{ fontSize: "0.68rem", fontWeight: 400 }}>feriado</div>}</th>;
                    })}
                  </tr>
                </thead>
                <tbody>
                  {filas.map((l) => (
                    <tr key={l.id} style={elegidos.has(l.id) ? { background: "#e8f0f6" } : undefined}>
                      <td><input type="checkbox" aria-label={`Elegir a ${l.apellido}`} checked={elegidos.has(l.id)} onChange={() => alternar(l.id)} /></td>
                      <td>{l.numero} — {l.apellido}, {l.nombre}<div style={{ fontSize: "0.75rem", color: "#6b727b" }}>{l.sector}</div></td>
                      <td style={{ fontSize: "0.82rem" }}>
                        {l.asignacion ? l.asignacion.horarioIds.map(nombreDe).join(" → ") : <span style={{ color: "#B8752B" }}>Sin horario</span>}
                        {l.asignacion && l.asignacion.horarioIds.length > 1 && <div style={{ fontSize: "0.72rem", color: "#6b727b" }}>rota cada semana</div>}
                        {l.proxima && <div style={{ fontSize: "0.72rem", color: "#6b727b" }}>desde el {corta(new Date(l.proxima.desde))}: {l.proxima.horarioIds.map(nombreDe).join(" → ")}</div>}
                      </td>
                      {l.jornadas.map((j, i) => (
                        <td key={i} style={{ textAlign: "center", padding: "0.2rem" }}>
                          {/* Toda la celda es un botón: tocarla abre el cambio de ese día para esa persona */}
                          <button onClick={() => abrirCambio(l, dias[i], j)} title={`${j.cambio ? "Cambio de ese día. " : ""}Tocá para cambiar solo este día`} aria-label={`${l.apellido}, ${NOMBRE_DIA[dias[i].getUTCDay()]} ${corta(dias[i])}: cambiar este día`}
                            style={{ background: "none", border: j.cambio ? "2px dashed #B8752B" : "2px solid transparent", borderRadius: 6, padding: "0.1rem", cursor: "pointer", color: "inherit", minWidth: 64 }}>
                            {j.tipo === "trabaja" ? (
                              <span style={{ display: "inline-block", background: j.color, color: "#12202e", borderRadius: 4, padding: "0.2rem 0.4rem", fontSize: "0.78rem", fontWeight: 600, whiteSpace: "nowrap" }}>{j.ingreso}–{j.salida}</span>
                            ) : j.tipo === "franco" ? (
                              <span style={{ color: "#9aa5b1", fontSize: "0.78rem" }}>franco</span>
                            ) : j.tipo === "feriado" ? (
                              <span style={{ color: "#4A4F58", background: "rgba(74,79,88,0.12)", borderRadius: 4, padding: "0.2rem 0.4rem", fontSize: "0.78rem" }}>feriado</span>
                            ) : (
                              <span style={{ color: "#cfd6dc" }}>·</span>
                            )}
                          </button>
                        </td>
                      ))}
                    </tr>
                  ))}
                  {filas.length === 0 && <tr><td colSpan={10} style={{ opacity: 0.6 }}>No hay legajos para este filtro.</td></tr>}
                </tbody>
                {filas.length > 0 && (
                  <tfoot>
                    <tr style={{ fontWeight: 700, background: "#F5F7F9" }}>
                      <td></td><td colSpan={2}>Trabajan ese día</td>
                      {dias.map((d, i) => {
                        const porHorario = new Map<string, number>();
                        for (const l of filas) if (l.jornadas[i].tipo === "trabaja") porHorario.set(l.jornadas[i].horario!, (porHorario.get(l.jornadas[i].horario!) ?? 0) + 1);
                        const total = [...porHorario.values()].reduce((a, b) => a + b, 0);
                        return <td key={iso(d)} style={{ textAlign: "center" }} title={[...porHorario].map(([h, n]) => `${h}: ${n}`).join(" · ")}>{total}{porHorario.size > 1 && <div style={{ fontSize: "0.68rem", fontWeight: 400, color: "#6b727b" }}>{[...porHorario].map(([h, n]) => `${h} ${n}`).join(" · ")}</div>}</td>;
                      })}
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            <p style={{ fontSize: "0.78rem", color: "#6b727b", margin: "0.5rem 0 0" }}>Tocá una celda para cambiar <strong>solo ese día</strong> de esa persona (franco, o cubrir otro turno). Los cambios de un día se ven con borde punteado.</p>

            {/* ── Cambio de un día ── */}
            {cambio && (
              <div style={{ marginTop: "0.75rem", background: "#fdf7e6", border: "1px solid #E8B36B", padding: "0.8rem 1rem" }}>
                <strong style={{ color: "#163A5C" }}>Cambio para {cambio.nombre} el {cambio.fecha.slice(8, 10)}/{cambio.fecha.slice(5, 7)}</strong>
                <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "flex-end", marginTop: "0.5rem" }}>
                  <label>Ese día…<br />
                    <select value={cambio.tipo} onChange={(e) => setCambio({ ...cambio, tipo: e.target.value as "franco" | "horario" })}>
                      <option value="franco">no trabaja (franco)</option>
                      <option value="horario">trabaja en otro horario</option>
                    </select>
                  </label>
                  {cambio.tipo === "horario" && (
                    <>
                      <label>Tomar el de<br />
                        <select value="" onChange={(e) => { const h = datos.horarios.find((x) => x.id === e.target.value); const d = h && (h.dias[new Date(cambio.fecha).getUTCDay()] ?? Object.values(h.dias)[0]); if (d) setCambio({ ...cambio, ingreso: d.ingreso, salida: d.salida }); }}>
                          <option value="">— elegir un horario —</option>
                          {datos.horarios.map((h) => <option key={h.id} value={h.id}>{h.nombre}</option>)}
                        </select>
                      </label>
                      <label>Entra<br /><input type="time" value={cambio.ingreso} onChange={(e) => setCambio({ ...cambio, ingreso: e.target.value })} /></label>
                      <label>Sale<br /><input type="time" value={cambio.salida} onChange={(e) => setCambio({ ...cambio, salida: e.target.value })} /></label>
                    </>
                  )}
                  <label>Motivo (opcional)<br /><input value={cambio.motivo} onChange={(e) => setCambio({ ...cambio, motivo: e.target.value })} maxLength={200} placeholder="Cubre a Pérez" style={{ width: 200 }} /></label>
                  <button onClick={() => guardarCambio()}>Guardar cambio</button>
                  {cambio.existe && <button onClick={() => guardarCambio(true)} style={{ ...btnSec, color: "#B23A3A", borderColor: "#B23A3A" }}>Quitar el cambio</button>}
                  <button onClick={() => setCambio(null)} style={btnSec}>Cancelar</button>
                </div>
                {errorCambio && <p style={{ color: "#B23A3A", margin: "0.5rem 0 0" }}>{errorCambio}</p>}
              </div>
            )}

            {/* ── Asignar ── */}
            <div style={{ marginTop: "1rem", paddingTop: "1rem", borderTop: "1px solid #EEF1F4" }}>
              <strong style={{ color: "#163A5C" }}>Asignar horario</strong>{" "}
              <span style={{ color: "#6b727b", fontSize: "0.85rem" }}>{elegidos.size === 0 ? "— tildá a quiénes en la tabla" : `a ${elegidos.size} ${elegidos.size === 1 ? "persona elegida" : "personas elegidas"}`}</span>
              <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", alignItems: "flex-end", marginTop: "0.6rem" }}>
                {rotacion.map((id, i) => (
                  <label key={i}>{rotacion.length > 1 ? `Semana ${i + 1}` : "Horario"}<br />
                    <select value={id} onChange={(e) => setRotacion(rotacion.map((x, k) => (k === i ? e.target.value : x)))}>
                      <option value="">Elegir…</option>
                      {datos.horarios.map((h) => <option key={h.id} value={h.id}>{h.nombre} ({h.resumen})</option>)}
                    </select>
                  </label>
                ))}
                {rotacion.length < 8 && <button onClick={() => setRotacion([...rotacion, ""])} style={btnSec} title="Para turnos rotativos: una semana cada horario, en este orden">+ Rotar con otro</button>}
                {rotacion.length > 1 && <button onClick={() => setRotacion(rotacion.slice(0, -1))} style={btnSec}>Quitar el último</button>}
                <label>Desde<br /><input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} /></label>
                <button onClick={() => asignar()} disabled={trabajando || elegidos.size === 0}>{trabajando ? "Guardando…" : "Asignar"}</button>
                <button onClick={() => asignar(true)} disabled={trabajando || elegidos.size === 0} style={{ ...btnSec, color: "#B23A3A", borderColor: "#B23A3A" }}>Dejar sin horario</button>
              </div>
              {rotacion.length > 1 && <p style={{ fontSize: "0.8rem", color: "#6b727b", margin: "0.5rem 0 0" }}>La semana de la fecha "desde" hace el horario de la Semana 1; cada lunes pasa al siguiente y, al terminar, vuelve a empezar.</p>}
              {aviso && <p style={{ color: aviso.ok ? "#2F6F5E" : "#B23A3A", margin: "0.5rem 0 0" }}>{aviso.texto}</p>}
            </div>
          </div>

          {/* ── Horarios ── */}
          <div style={caja}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
              <h3 style={{ margin: 0 }}>Horarios de la empresa</h3>
              {!form && <button onClick={() => { setForm({ ...HORARIO_VACIO, color: COLORES_HORARIO[datos.horarios.length % COLORES_HORARIO.length] }); setErrorForm(""); }}>+ Nuevo horario</button>}
            </div>

            {datos.horarios.map((h) => (
              <div key={h.id} style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.6rem 0", borderBottom: "1px solid #EEF1F4", flexWrap: "wrap" }}>
                <span style={{ width: 14, height: 14, borderRadius: 3, background: h.color, flexShrink: 0 }} aria-hidden="true" />
                <strong style={{ minWidth: "140px" }}>{h.nombre}</strong>
                <span style={{ flex: 1, color: "#4A4F58", fontSize: "0.9rem" }}>{h.resumen}</span>
                <button onClick={() => { setForm({ id: h.id, nombre: h.nombre, color: h.color, dias: h.dias }); setErrorForm(""); }} style={{ ...btnSec, padding: "0.25rem 0.7rem" }}>Editar</button>
                <button onClick={() => borrarHorario(h)} style={{ ...btnSec, padding: "0.25rem 0.7rem", color: "#B23A3A", borderColor: "#B23A3A" }}>Borrar</button>
              </div>
            ))}

            {form && (
              <div style={{ marginTop: "1rem", background: "#F5F7F9", padding: "1rem", border: "1px solid #dfe4e8" }}>
                <strong>{form.id ? "Editar horario" : "Nuevo horario"}</strong>
                {form.id && <p style={{ fontSize: "0.8rem", color: "#8a5413", margin: "0.3rem 0 0" }}>Ojo: cambiar las horas modifica el horario de todos los que lo tienen asignado, también en fechas pasadas. Si el horario cambió desde una fecha, conviene crear uno nuevo y asignarlo desde ese día.</p>}
                <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "flex-end", margin: "0.75rem 0" }}>
                  <label>Nombre<br /><input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Mañana" maxLength={40} /></label>
                  <div>Color<br />
                    {COLORES_HORARIO.map((c) => (
                      <button key={c} onClick={() => setForm({ ...form, color: c })} aria-label={`Color ${c}`} style={{ width: 26, height: 26, background: c, border: form.color === c ? "3px solid #163A5C" : "1px solid #cfd6dc", borderRadius: 4, marginRight: 4, padding: 0 }} />
                    ))}
                  </div>
                </div>
                {ORDEN.map((d) => (
                  <div key={d} style={{ display: "flex", gap: "0.6rem", alignItems: "center", marginBottom: "0.3rem" }}>
                    <label style={{ width: "120px" }}><input type="checkbox" checked={!!form.dias[d]} onChange={() => cambiarDia(d, null)} style={{ marginRight: 6 }} />{NOMBRE_DIA[d]}</label>
                    {form.dias[d] ? (
                      <>
                        <input type="time" value={form.dias[d].ingreso} onChange={(e) => cambiarDia(d, "ingreso", e.target.value)} aria-label={`Ingreso del ${NOMBRE_DIA[d]}`} /> a
                        <input type="time" value={form.dias[d].salida} onChange={(e) => cambiarDia(d, "salida", e.target.value)} aria-label={`Salida del ${NOMBRE_DIA[d]}`} />
                        {form.dias[d].salida <= form.dias[d].ingreso && <span style={{ fontSize: "0.8rem", color: "#6E6AA8" }}>sale al día siguiente</span>}
                        {d === 1 && <button onClick={copiarLunes} style={{ ...btnSec, padding: "0.15rem 0.6rem", fontSize: "0.8rem" }}>Copiar de lunes a viernes</button>}
                      </>
                    ) : <span style={{ color: "#9aa5b1", fontSize: "0.85rem" }}>franco</span>}
                  </div>
                ))}
                {errorForm && <p style={{ color: "#B23A3A", margin: "0.5rem 0 0" }}>{errorForm}</p>}
                <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}>
                  <button onClick={guardarHorario}>Guardar horario</button>
                  <button onClick={() => setForm(null)} style={btnSec}>Cancelar</button>
                </div>
              </div>
            )}
          </div>
          {/* ── Feriados ── */}
          <div style={caja}>
            <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
              <h3 style={{ margin: 0 }}>Feriados</h3>
              <label>Año <input type="number" value={anioFeriados} onChange={(e) => setAnioFeriados(Number(e.target.value))} style={{ width: 80 }} /></label>
              <button onClick={() => feriado({ sugerir: anioFeriados })} style={btnSec}>Cargar los nacionales fijos de {anioFeriados}</button>
            </div>
            <p style={{ fontSize: "0.8rem", color: "#6b727b", margin: "0.4rem 0 0.6rem" }}>
              En un feriado, quien no ficha queda como <strong>feriado</strong> en Asistencia en vez de ausente. El botón carga los que no cambian de fecha (y Carnaval y Viernes Santo);
              los <strong>trasladables y los puentes</strong> los define el Gobierno cada año: agregalos a mano. También podés sumar el día del gremio o una parada de planta.
            </p>
            {feriados.length === 0 && <p style={{ opacity: 0.7 }}>No hay feriados cargados para {anioFeriados}.</p>}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
              {feriados.map((f) => (
                <span key={f.id} style={{ background: "#F5F7F9", border: "1px solid #dfe4e8", borderRadius: 999, padding: "0.2rem 0.3rem 0.2rem 0.7rem", fontSize: "0.85rem" }}>
                  <strong>{f.fecha.slice(8, 10)}/{f.fecha.slice(5, 7)}</strong> {f.nombre}
                  <button onClick={() => feriado(null, "DELETE", `?id=${f.id}`)} aria-label={`Quitar ${f.nombre}`} style={{ background: "none", border: "none", color: "#B23A3A", cursor: "pointer", padding: "0 0.4rem", fontSize: "1rem" }}>×</button>
                </span>
              ))}
            </div>
            <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", alignItems: "flex-end", marginTop: "0.75rem" }}>
              <label>Fecha<br /><input type="date" value={nuevoFeriado.fecha} onChange={(e) => setNuevoFeriado({ ...nuevoFeriado, fecha: e.target.value })} /></label>
              <label>Nombre<br /><input value={nuevoFeriado.nombre} onChange={(e) => setNuevoFeriado({ ...nuevoFeriado, nombre: e.target.value })} maxLength={80} placeholder="Día del Respeto a la Diversidad Cultural" style={{ width: 300 }} /></label>
              <button onClick={() => feriado(nuevoFeriado)} disabled={!nuevoFeriado.fecha || !nuevoFeriado.nombre}>Agregar feriado</button>
            </div>
            {avisoFeriados && <p style={{ color: avisoFeriados.ok ? "#2F6F5E" : "#B23A3A", margin: "0.5rem 0 0" }}>{avisoFeriados.texto}</p>}
          </div>
        </>
      )}
    </main>
  );
}
