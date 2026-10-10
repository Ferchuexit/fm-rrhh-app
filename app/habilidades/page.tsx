"use client";
// FM RRHH — app/habilidades/page.tsx
// Matriz de habilidades (polivalencia): personas en filas, habilidades en
// columnas. Responde "¿quién puede cubrir este puesto?" y "¿qué se vence?".
import { useEffect, useMemo, useState } from "react";
import { NIVELES, NIVEL_AUTONOMO, MINIMO_COBERTURA } from "@/lib/capacitaciones-reglas";

type Habilidad = { id: string; nombre: string; grupo: string; vigenciaMeses: number | null; cobertura: { autonomos: number; enFormacion: number; vencidas: number; riesgo: boolean } };
type Legajo = { id: string; numero: number; apellido: string; nombre: string; centroCostoId: string | null; sector: string };
type Celda = { legajoId: string; habilidadId: string; nivel: number; desde: string; vence: string | null; origen: string; estado: "vigente" | "por_vencer" | "vencida" };

const dia = (iso: string) => new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
const caja: React.CSSProperties = { background: "white", border: "1px solid #dfe4e8", padding: "1rem", marginBottom: "1.5rem", maxWidth: "1200px" };
const btnSec: React.CSSProperties = { background: "white", color: "#163A5C", border: "1px solid #163A5C" };
const chico: React.CSSProperties = { padding: "0.2rem 0.6rem", fontSize: "0.8rem" };
const VACIA = { id: "", nombre: "", grupo: "", vigenciaMeses: "" as string | number };

export default function HabilidadesPage() {
  const [datos, setDatos] = useState<{ habilidades: Habilidad[]; legajos: Legajo[]; celdas: Celda[] } | null>(null);
  const [error, setError] = useState("");
  const [sector, setSector] = useState("");
  const [edit, setEdit] = useState<{ legajo: Legajo; habilidad: Habilidad; nivel: number; desde: string } | null>(null);
  const [form, setForm] = useState<typeof VACIA | null>(null);
  const [errorForm, setErrorForm] = useState("");

  async function cargar() {
    const res = await fetch("/api/habilidades");
    const d = await res.json().catch(() => ({ error: "El servidor no devolvió una respuesta válida." }));
    if (!res.ok) { setError(d.error ?? "No se pudo cargar."); return; }
    setError("");
    setDatos(d);
  }
  useEffect(() => { cargar(); }, []);

  const celda = useMemo(() => new Map((datos?.celdas ?? []).map((c) => [`${c.legajoId}|${c.habilidadId}`, c])), [datos]);
  const sectores = useMemo(() => [...new Map((datos?.legajos ?? []).filter((l) => l.centroCostoId).map((l) => [l.centroCostoId!, l.sector])).entries()].sort((a, b) => a[1].localeCompare(b[1])), [datos]);
  const filas = (datos?.legajos ?? []).filter((l) => !sector || l.centroCostoId === sector);
  const grupos = [...new Set((datos?.habilidades ?? []).map((h) => h.grupo))];
  const alertas = (datos?.celdas ?? []).filter((c) => c.estado !== "vigente").sort((a, b) => (a.vence ?? "").localeCompare(b.vence ?? ""));
  const enRiesgo = (datos?.habilidades ?? []).filter((h) => h.cobertura.riesgo);

  async function enviar(url: string, cuerpo: unknown, metodo = "POST") {
    const res = await fetch(url, { method: metodo, headers: { "Content-Type": "application/json" }, body: metodo === "POST" ? JSON.stringify(cuerpo) : undefined });
    const d = await res.json().catch(() => ({ error: "El servidor no devolvió una respuesta válida." }));
    return { ok: res.ok, error: d.error as string | undefined };
  }
  async function guardarCelda(nivel: number) {
    if (!edit) return;
    const r = await enviar("/api/habilidades/celda", { legajoId: edit.legajo.id, habilidadId: edit.habilidad.id, nivel, desde: edit.desde });
    if (!r.ok) { setError(r.error ?? "No se pudo guardar."); return; }
    setEdit(null);
    cargar();
  }
  async function guardarHabilidad() {
    if (!form) return;
    setErrorForm("");
    const r = await enviar("/api/habilidades", form);
    if (!r.ok) { setErrorForm(r.error ?? "No se pudo guardar."); return; }
    setForm(null);
    cargar();
  }
  async function borrarHabilidad(h: Habilidad) {
    const r = await enviar(`/api/habilidades?id=${h.id}`, null, "DELETE");
    if (!r.ok) setError(r.error ?? "No se pudo borrar.");
    cargar();
  }
  function abrir(l: Legajo, h: Habilidad) {
    const c = celda.get(`${l.id}|${h.id}`);
    setEdit({ legajo: l, habilidad: h, nivel: c?.nivel ?? 0, desde: c?.desde.slice(0, 10) ?? new Date().toISOString().slice(0, 10) });
  }

  return (
    <main>
      <h1>Matriz de habilidades</h1>
      <p style={{ maxWidth: "880px" }}>
        Quién está habilitado para cada puesto, máquina o tarea, y con qué nivel. Se completa sola cuando se cierra una <a href="/capacitaciones">capacitación</a> que
        habilita para algo; lo que la gente ya sabía de antes se carga tocando la celda.
      </p>
      {error && <p style={{ color: "#B23A3A" }}>{error}</p>}
      {!datos && !error && <p>Cargando…</p>}

      {datos && (
        <>
          {datos.habilidades.length === 0 && (
            <div style={{ ...caja, borderLeft: "4px solid #B8752B" }}>
              <strong>Todavía no hay habilidades cargadas.</strong> Empezá por agregar las de la planta abajo: máquinas (seccionadora, autoelevador), puestos (armado, despacho) y habilitaciones de seguridad (trabajo en altura, primeros auxilios).
            </div>
          )}

          {(enRiesgo.length > 0 || alertas.length > 0) && (
            <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", maxWidth: "1200px" }}>
              {enRiesgo.length > 0 && (
                <div style={{ ...caja, flex: 1, minWidth: 320, borderLeft: "4px solid #B23A3A" }}>
                  <strong style={{ color: "#B23A3A" }}>Dependen de una sola persona, o de nadie ({enRiesgo.length})</strong>
                  <div style={{ fontSize: "0.88rem", marginTop: "0.4rem" }}>
                    {enRiesgo.map((h) => <div key={h.id}>{h.nombre}: <strong>{h.cobertura.autonomos}</strong> {h.cobertura.autonomos === 1 ? "persona autónoma" : "personas autónomas"}{h.cobertura.enFormacion > 0 ? ` · ${h.cobertura.enFormacion} en formación` : ""}</div>)}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "#6b727b", marginTop: "0.4rem" }}>Se pide un mínimo de {MINIMO_COBERTURA} personas con nivel {NIVELES[NIVEL_AUTONOMO].nombre.toLowerCase()} o más, con la habilitación vigente.</div>
                </div>
              )}
              {alertas.length > 0 && (
                <div style={{ ...caja, flex: 1, minWidth: 320, borderLeft: "4px solid #B8752B" }}>
                  <strong style={{ color: "#8a5413" }}>Vencidas o por vencer ({alertas.length})</strong>
                  <div style={{ fontSize: "0.88rem", marginTop: "0.4rem" }}>
                    {alertas.slice(0, 12).map((c) => {
                      const l = datos.legajos.find((x) => x.id === c.legajoId), h = datos.habilidades.find((x) => x.id === c.habilidadId);
                      return l && h ? <div key={`${c.legajoId}${c.habilidadId}`} style={{ color: c.estado === "vencida" ? "#B23A3A" : undefined }}>{l.apellido}, {l.nombre} — {h.nombre}: {c.estado === "vencida" ? "venció" : "vence"} el {dia(c.vence!)}</div> : null;
                    })}
                    {alertas.length > 12 && <div style={{ color: "#6b727b" }}>… y {alertas.length - 12} más (se ven marcadas en la matriz).</div>}
                  </div>
                </div>
              )}
            </div>
          )}

          {datos.habilidades.length > 0 && (
            <div style={caja}>
              <div style={{ display: "flex", gap: "1rem", alignItems: "center", flexWrap: "wrap", marginBottom: "0.6rem" }}>
                {sectores.length > 0 && (
                  <label>Centro de costo:{" "}
                    <select value={sector} onChange={(e) => setSector(e.target.value)}>
                      <option value="">Todos</option>
                      {sectores.map(([id, nombre]) => <option key={id} value={id}>{nombre}</option>)}
                    </select>
                  </label>
                )}
                <span style={{ fontSize: "0.8rem", color: "#4A4F58" }}>
                  {Object.entries(NIVELES).map(([n, v]) => <span key={n} style={{ marginRight: 12, whiteSpace: "nowrap" }}><span style={{ display: "inline-block", width: 18, textAlign: "center", background: v.color, color: Number(n) === 4 ? "white" : "#12202e", borderRadius: 3, fontWeight: 700, marginRight: 4 }}>{n}</span>{v.nombre}</span>)}
                </span>
              </div>

              <div style={{ overflowX: "auto" }}>
                <table>
                  <thead>
                    <tr>
                      <th rowSpan={2} style={{ minWidth: 190 }}>Empleado</th>
                      {grupos.map((g) => <th key={g} colSpan={datos.habilidades.filter((h) => h.grupo === g).length} style={{ textAlign: "center", borderLeft: "2px solid white" }}>{g}</th>)}
                    </tr>
                    <tr>
                      {grupos.flatMap((g) => datos.habilidades.filter((h) => h.grupo === g)).map((h) => (
                        <th key={h.id} style={{ textAlign: "center", fontWeight: 400, fontSize: "0.8rem", minWidth: 84 }} title={h.vigenciaMeses ? `Se renueva cada ${h.vigenciaMeses} meses` : "No vence"}>{h.nombre}{h.vigenciaMeses ? <div style={{ fontSize: "0.68rem", opacity: 0.8 }}>cada {h.vigenciaMeses} m</div> : null}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filas.map((l) => (
                      <tr key={l.id}>
                        <td>{l.numero} — {l.apellido}, {l.nombre}<div style={{ fontSize: "0.75rem", color: "#6b727b" }}>{l.sector}</div></td>
                        {grupos.flatMap((g) => datos.habilidades.filter((h) => h.grupo === g)).map((h) => {
                          const c = celda.get(`${l.id}|${h.id}`);
                          return (
                            <td key={h.id} style={{ textAlign: "center", padding: "0.2rem" }}>
                              <button onClick={() => abrir(l, h)} aria-label={`${l.apellido} en ${h.nombre}: ${c ? NIVELES[c.nivel].nombre : "sin cargar"}. Cambiar`}
                                title={c ? `${NIVELES[c.nivel].nombre} desde el ${dia(c.desde)}${c.vence ? ` · ${c.estado === "vencida" ? "VENCIÓ" : "vence"} el ${dia(c.vence)}` : ""}` : "Sin cargar — tocá para cargar"}
                                style={{ width: 34, height: 28, borderRadius: 4, cursor: "pointer", fontWeight: 700, padding: 0, background: c ? NIVELES[c.nivel].color : "#F5F7F9", color: c ? (c.nivel === 4 ? "white" : "#12202e") : "#cfd6dc",
                                  border: c?.estado === "vencida" ? "2px solid #B23A3A" : c?.estado === "por_vencer" ? "2px dashed #B8752B" : "1px solid #dfe4e8", opacity: c?.estado === "vencida" ? 0.55 : 1 }}>
                                {c ? c.nivel : "·"}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                    {filas.length === 0 && <tr><td colSpan={datos.habilidades.length + 1} style={{ opacity: 0.6 }}>No hay legajos para este filtro.</td></tr>}
                  </tbody>
                  <tfoot>
                    <tr style={{ fontWeight: 700, background: "#F5F7F9" }}>
                      <td>Pueden cubrirlo solos{sector ? " (toda la empresa)" : ""}</td>
                      {grupos.flatMap((g) => datos.habilidades.filter((h) => h.grupo === g)).map((h) => <td key={h.id} style={{ textAlign: "center", color: h.cobertura.riesgo ? "#B23A3A" : "#2F6F5E" }}>{h.cobertura.autonomos}</td>)}
                    </tr>
                  </tfoot>
                </table>
              </div>
              <p style={{ fontSize: "0.78rem", color: "#6b727b", margin: "0.5rem 0 0" }}>Tocá una celda para cargar o cambiar el nivel. Borde rojo: habilitación vencida (no cuenta para cubrir el puesto). Borde punteado: vence en los próximos 60 días.</p>

              {edit && (
                <div style={{ marginTop: "0.75rem", background: "#F5F7F9", border: "1px solid #dfe4e8", padding: "0.8rem 1rem" }}>
                  <strong style={{ color: "#163A5C" }}>{edit.legajo.apellido}, {edit.legajo.nombre} — {edit.habilidad.nombre}</strong>
                  <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "flex-end", marginTop: "0.5rem" }}>
                    {Object.entries(NIVELES).map(([n, v]) => (
                      <button key={n} onClick={() => guardarCelda(Number(n))} style={{ background: v.color, color: Number(n) === 4 ? "white" : "#12202e", border: edit.nivel === Number(n) ? "3px solid #163A5C" : "1px solid #cfd6dc" }}>{n} · {v.nombre}</button>
                    ))}
                    <label>Desde<br /><input type="date" value={edit.desde} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setEdit({ ...edit, desde: e.target.value })} /></label>
                    {edit.nivel > 0 && <button onClick={() => guardarCelda(0)} style={{ ...btnSec, color: "#B23A3A", borderColor: "#B23A3A" }}>Quitar</button>}
                    <button onClick={() => setEdit(null)} style={btnSec}>Cancelar</button>
                  </div>
                  <div style={{ fontSize: "0.78rem", color: "#6b727b", marginTop: "0.4rem" }}>
                    "Desde" es cuándo se habilitó o renovó por última vez{edit.habilidad.vigenciaMeses ? `: de ahí se cuentan los ${edit.habilidad.vigenciaMeses} meses de vigencia` : ""}. Elegí la fecha y después el nivel.
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Habilidades ── */}
          <div style={caja}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
              <h3 style={{ margin: 0 }}>Habilidades de la empresa</h3>
              {!form && <button onClick={() => { setForm({ ...VACIA }); setErrorForm(""); }}>+ Nueva habilidad</button>}
            </div>
            {datos.habilidades.map((h) => (
              <div key={h.id} style={{ display: "flex", gap: "0.75rem", alignItems: "center", padding: "0.45rem 0", borderBottom: "1px solid #EEF1F4", flexWrap: "wrap" }}>
                <strong style={{ minWidth: 200 }}>{h.nombre}</strong>
                <span style={{ flex: 1, color: "#4A4F58", fontSize: "0.88rem" }}>{h.grupo} · {h.vigenciaMeses ? `se renueva cada ${h.vigenciaMeses} meses` : "no vence"}</span>
                <button onClick={() => { setForm({ id: h.id, nombre: h.nombre, grupo: h.grupo, vigenciaMeses: h.vigenciaMeses ?? "" }); setErrorForm(""); }} style={{ ...btnSec, ...chico }}>Editar</button>
                <button onClick={() => borrarHabilidad(h)} style={{ ...btnSec, ...chico, color: "#B23A3A", borderColor: "#B23A3A" }}>Borrar</button>
              </div>
            ))}
            {form && (
              <div style={{ marginTop: "0.9rem", background: "#F5F7F9", border: "1px solid #dfe4e8", padding: "0.9rem 1rem" }}>
                <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "flex-end" }}>
                  <label>Nombre<br /><input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Autoelevador" maxLength={60} /></label>
                  <label>Grupo<br /><input value={form.grupo} onChange={(e) => setForm({ ...form, grupo: e.target.value })} placeholder="Máquinas" maxLength={40} list="grupos-habilidad" /></label>
                  <datalist id="grupos-habilidad">{grupos.map((g) => <option key={g} value={g} />)}</datalist>
                  <label>Se renueva cada (meses)<br /><input type="number" min="1" max="120" value={form.vigenciaMeses} onChange={(e) => setForm({ ...form, vigenciaMeses: e.target.value })} placeholder="vacío = no vence" style={{ width: 150 }} /></label>
                  <button onClick={guardarHabilidad}>Guardar</button>
                  <button onClick={() => setForm(null)} style={btnSec}>Cancelar</button>
                </div>
                <p style={{ fontSize: "0.78rem", color: "#6b727b", margin: "0.4rem 0 0" }}>La vigencia la define la norma o la política de la empresa para cada habilitación: cargá la que corresponda. Cambiarla no recalcula los vencimientos ya cargados.</p>
                {errorForm && <p style={{ color: "#B23A3A", margin: "0.4rem 0 0" }}>{errorForm}</p>}
              </div>
            )}
          </div>
        </>
      )}
    </main>
  );
}
