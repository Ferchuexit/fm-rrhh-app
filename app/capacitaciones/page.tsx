"use client";
// FM RRHH — app/capacitaciones/page.tsx
// Capacitaciones: programar, tomar asistencia, cerrar (habilita en la
// matriz y pide la constancia al empleado) y seguir quién confirmó.
import { useEffect, useMemo, useState } from "react";
import { NIVELES, TIPOS_CAPACITACION } from "@/lib/capacitaciones-reglas";

type Asistente = { id: string; legajoId: string; asistio: boolean | null; firmadoEn: string | null; legajo: { numeroLegajo: number; apellido: string; nombre: string } };
type Capacitacion = { id: string; titulo: string; descripcion: string | null; tipo: string; fecha: string; horas: number | null; instructor: string | null; lugar: string | null; habilidadId: string | null; nivelOtorgado: number | null; estado: "programada" | "realizada" | "cancelada"; habilidad: { nombre: string } | null; asistentes: Asistente[] };
type Habilidad = { id: string; nombre: string; grupo: string; vigenciaMeses: number | null };
type Legajo = { id: string; numero: number; apellido: string; nombre: string; centroCostoId: string | null; sector: string };

const dia = (iso: string) => new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
const caja: React.CSSProperties = { background: "white", border: "1px solid #dfe4e8", padding: "1rem", marginBottom: "1rem", maxWidth: "1000px" };
const btnSec: React.CSSProperties = { background: "white", color: "#163A5C", border: "1px solid #163A5C" };
const chico: React.CSSProperties = { padding: "0.2rem 0.6rem", fontSize: "0.8rem" };
const NUEVA = { titulo: "", tipo: "seguridad", fecha: "", horas: "", instructor: "", lugar: "", descripcion: "", habilidadId: "", nivelOtorgado: "3", legajoIds: [] as string[] };

export default function CapacitacionesPage() {
  const [datos, setDatos] = useState<{ hoy: string; capacitaciones: Capacitacion[]; habilidades: Habilidad[]; legajos: Legajo[] } | null>(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState<typeof NUEVA | null>(null);
  const [errorForm, setErrorForm] = useState("");
  const [abierta, setAbierta] = useState<string | null>(null);
  const [marcas, setMarcas] = useState<Record<string, boolean>>({});
  const [aviso, setAviso] = useState<{ id: string; ok: boolean; texto: string } | null>(null);
  const [verTodas, setVerTodas] = useState(false);

  async function cargar() {
    const res = await fetch("/api/capacitaciones");
    const d = await res.json().catch(() => ({ error: "El servidor no devolvió una respuesta válida." }));
    if (!res.ok) { setError(d.error ?? "No se pudo cargar."); return; }
    setError("");
    setDatos(d);
  }
  useEffect(() => { cargar(); }, []);

  const sectores = useMemo(() => [...new Map((datos?.legajos ?? []).filter((l) => l.centroCostoId).map((l) => [l.centroCostoId!, l.sector])).entries()].sort((a, b) => a[1].localeCompare(b[1])), [datos]);
  const programadas = (datos?.capacitaciones ?? []).filter((c) => c.estado === "programada").sort((a, b) => a.fecha.localeCompare(b.fecha));
  const cerradas = (datos?.capacitaciones ?? []).filter((c) => c.estado !== "programada");

  async function enviar(url: string, cuerpo: unknown) {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo) });
    const d = await res.json().catch(() => ({ error: "El servidor no devolvió una respuesta válida." }));
    return { ok: res.ok, d };
  }
  async function crear() {
    if (!form) return;
    setErrorForm("");
    const r = await enviar("/api/capacitaciones", form);
    if (!r.ok) { setErrorForm(r.d.error ?? "No se pudo guardar."); return; }
    setForm(null);
    setAbierta(r.d.id);
    setMarcas({});
    cargar();
  }
  function abrir(c: Capacitacion) {
    if (abierta === c.id) { setAbierta(null); return; }
    setAbierta(c.id);
    setAviso(null);
    setMarcas(Object.fromEntries(c.asistentes.filter((a) => a.asistio !== null).map((a) => [a.legajoId, a.asistio as boolean])));
  }
  async function accion(c: Capacitacion, cual: "asistencia" | "cerrar" | "cancelar") {
    setAviso(null);
    const r = await enviar(`/api/capacitaciones/${c.id}`, { accion: cual, asistencia: marcas });
    if (!r.ok) { setAviso({ id: c.id, ok: false, texto: r.d.error ?? "No se pudo guardar." }); return; }
    setAviso({ id: c.id, ok: true, texto: cual === "asistencia" ? "Asistencia guardada." : cual === "cancelar" ? "Capacitación cancelada." : `Cerrada: ${r.d.presentes} ${r.d.presentes === 1 ? "presente" : "presentes"}${r.d.habilitados ? `, que ya figuran en la matriz de habilidades` : ""}. Se les pidió que la confirmen desde el portal.` });
    cargar();
  }
  const alternar = (id: string) => form && setForm({ ...form, legajoIds: form.legajoIds.includes(id) ? form.legajoIds.filter((x) => x !== id) : [...form.legajoIds, id] });
  const sumarSector = (cc: string) => form && setForm({ ...form, legajoIds: [...new Set([...form.legajoIds, ...(datos?.legajos ?? []).filter((l) => !cc || l.centroCostoId === cc).map((l) => l.id)])] });

  function tarjeta(c: Capacitacion) {
    const esta = abierta === c.id;
    const presentes = c.asistentes.filter((a) => a.asistio).length;
    const firmaron = c.asistentes.filter((a) => a.firmadoEn).length;
    const color = c.estado === "cancelada" ? "#9aa5b1" : c.estado === "realizada" ? (firmaron === presentes ? "#2F6F5E" : "#B8752B") : c.fecha < (datos?.hoy ?? "") ? "#B23A3A" : "#7FA8C6";
    return (
      <div key={c.id} style={{ ...caja, borderLeft: `4px solid ${color}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <strong style={{ color: "#163A5C" }}>{c.titulo}</strong> <span style={{ color: "#6b727b" }}>· {TIPOS_CAPACITACION[c.tipo] ?? c.tipo}</span>
            <div style={{ fontSize: "0.85rem", color: "#4A4F58" }}>
              {dia(c.fecha)}{c.horas ? ` · ${c.horas} hs` : ""}{c.instructor ? ` · dicta ${c.instructor}` : ""}{c.lugar ? ` · ${c.lugar}` : ""}
              {c.habilidad && c.nivelOtorgado ? <> · habilita en <strong>{c.habilidad.nombre}</strong> ({NIVELES[c.nivelOtorgado]?.nombre.toLowerCase()})</> : ""}
            </div>
          </div>
          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
            <div style={{ textAlign: "right", fontSize: "0.85rem" }}>
              {c.estado === "programada" && <><strong>{c.asistentes.length}</strong> {c.asistentes.length === 1 ? "convocado" : "convocados"}{c.fecha < (datos?.hoy ?? "") && <div style={{ color: "#B23A3A" }}>Ya pasó: falta cerrarla</div>}</>}
              {c.estado === "realizada" && <><strong>{presentes}</strong> de {c.asistentes.length} presentes<div style={{ color: firmaron === presentes ? "#2F6F5E" : "#8a5413" }}>{firmaron} de {presentes} confirmaron</div></>}
              {c.estado === "cancelada" && <strong>Cancelada</strong>}
            </div>
            <a href={`/api/capacitaciones/${c.id}/planilla`} target="_blank" rel="noreferrer" style={{ fontSize: "0.8rem" }} title={c.estado === "programada" ? "Planilla para firmar en papel" : "Planilla con asistencia y confirmaciones"}>Planilla PDF</a>
            <button onClick={() => abrir(c)} style={{ ...btnSec, ...chico }}>{esta ? "Cerrar" : c.estado === "programada" ? "Asistencia" : "Ver"}</button>
          </div>
        </div>

        {esta && (
          <div style={{ marginTop: "0.75rem", borderTop: "1px solid #EEF1F4", paddingTop: "0.6rem" }}>
            {c.descripcion && <p style={{ fontSize: "0.88rem", marginTop: 0, whiteSpace: "pre-wrap" }}>{c.descripcion}</p>}
            <table>
              <thead><tr><th>Legajo</th><th>Empleado</th><th>{c.estado === "programada" ? "¿Asistió?" : "Asistencia"}</th>{c.estado === "realizada" && <th>Constancia</th>}</tr></thead>
              <tbody>
                {c.asistentes.map((a) => (
                  <tr key={a.id}>
                    <td>{a.legajo.numeroLegajo}</td>
                    <td>{a.legajo.apellido}, {a.legajo.nombre}</td>
                    <td>
                      {c.estado === "programada" ? (
                        <>
                          <label style={{ marginRight: 12 }}><input type="radio" name={`a-${a.id}`} checked={marcas[a.legajoId] === true} onChange={() => setMarcas({ ...marcas, [a.legajoId]: true })} /> Sí</label>
                          <label><input type="radio" name={`a-${a.id}`} checked={marcas[a.legajoId] === false} onChange={() => setMarcas({ ...marcas, [a.legajoId]: false })} /> No</label>
                        </>
                      ) : a.asistio ? "Presente" : a.asistio === false ? <span style={{ color: "#6b727b" }}>Ausente</span> : "—"}
                    </td>
                    {c.estado === "realizada" && <td>{!a.asistio ? "" : a.firmadoEn ? <span style={{ color: "#2F6F5E" }}>Confirmó el {new Date(a.firmadoEn).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false })}</span> : <span style={{ color: "#8a5413" }}>Falta que confirme</span>}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
            {c.estado === "programada" && (
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.75rem", alignItems: "center" }}>
                <button onClick={() => setMarcas(Object.fromEntries(c.asistentes.map((a) => [a.legajoId, true])))} style={{ ...btnSec, ...chico }}>Todos presentes</button>
                <button onClick={() => accion(c, "asistencia")} style={btnSec}>Guardar asistencia</button>
                <button onClick={() => accion(c, "cerrar")}>Cerrar como realizada</button>
                <button onClick={() => accion(c, "cancelar")} style={{ ...btnSec, color: "#B23A3A", borderColor: "#B23A3A" }}>Cancelar capacitación</button>
              </div>
            )}
            {c.estado === "programada" && <p style={{ fontSize: "0.78rem", color: "#6b727b", margin: "0.5rem 0 0" }}>Al cerrarla{c.habilidad ? ", los presentes quedan habilitados en la matriz y" : ","} cada presente recibe un aviso para confirmar desde el portal que la recibió. Después de cerrada no se modifica.</p>}
            {aviso?.id === c.id && <p style={{ color: aviso.ok ? "#2F6F5E" : "#B23A3A", margin: "0.5rem 0 0" }}>{aviso.texto}</p>}
          </div>
        )}
      </div>
    );
  }

  return (
    <main>
      <h1>Capacitaciones</h1>
      <p style={{ maxWidth: "860px" }}>
        Programá la capacitación, tomá asistencia y cerrala. Cada presente <strong>confirma desde el portal que la recibió</strong> (queda fecha y hora), y si la capacitación
        habilita para algo, pasa sola a la <a href="/habilidades">matriz de habilidades</a>.
      </p>
      {error && <p style={{ color: "#B23A3A" }}>{error}</p>}
      {!datos && !error && <p>Cargando…</p>}

      {datos && (
        <>
          {!form && <p><button onClick={() => { setForm({ ...NUEVA, fecha: datos.hoy.slice(0, 10) }); setErrorForm(""); }}>+ Nueva capacitación</button></p>}
          {form && (
            <div style={caja}>
              <strong style={{ color: "#163A5C" }}>Nueva capacitación</strong>
              <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "flex-end", marginTop: "0.6rem" }}>
                <label>Título<br /><input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} maxLength={120} placeholder="Uso seguro del autoelevador" style={{ width: 320 }} /></label>
                <label>Tipo<br /><select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>{Object.entries(TIPOS_CAPACITACION).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
                <label>Fecha<br /><input type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} /></label>
                <label>Horas<br /><input type="number" min="0" step="0.5" value={form.horas} onChange={(e) => setForm({ ...form, horas: e.target.value })} style={{ width: 70 }} /></label>
                <label>Quién la dicta<br /><input value={form.instructor} onChange={(e) => setForm({ ...form, instructor: e.target.value })} maxLength={80} placeholder="Ing. en Seguridad e Higiene" /></label>
                <label>Lugar<br /><input value={form.lugar} onChange={(e) => setForm({ ...form, lugar: e.target.value })} maxLength={80} placeholder="Comedor" /></label>
              </div>
              <label style={{ display: "block", marginTop: "0.6rem" }}>Temas (opcional)<br /><textarea value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} rows={2} maxLength={1000} style={{ width: "100%", maxWidth: 700 }} /></label>
              <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "flex-end", marginTop: "0.6rem" }}>
                <label>¿Habilita para algo?<br />
                  <select value={form.habilidadId} onChange={(e) => setForm({ ...form, habilidadId: e.target.value })}>
                    <option value="">No — solo queda el registro</option>
                    {datos.habilidades.map((h) => <option key={h.id} value={h.id}>{h.grupo}: {h.nombre}</option>)}
                  </select>
                </label>
                {form.habilidadId && <label>Nivel que otorga<br /><select value={form.nivelOtorgado} onChange={(e) => setForm({ ...form, nivelOtorgado: e.target.value })}>{Object.entries(NIVELES).map(([n, v]) => <option key={n} value={n}>{n} · {v.nombre}</option>)}</select></label>}
                {datos.habilidades.length === 0 && <span style={{ fontSize: "0.8rem", color: "#6b727b" }}>Para que habilite, primero cargá las habilidades en la <a href="/habilidades">matriz</a>.</span>}
              </div>

              <div style={{ marginTop: "0.8rem" }}>
                <strong>Asistentes ({form.legajoIds.length})</strong>{" "}
                <button onClick={() => sumarSector("")} style={{ ...btnSec, ...chico }}>+ Todos</button>{" "}
                {sectores.map(([id, nombre]) => <button key={id} onClick={() => sumarSector(id)} style={{ ...btnSec, ...chico, marginRight: 4 }}>+ {nombre}</button>)}
                {form.legajoIds.length > 0 && <button onClick={() => setForm({ ...form, legajoIds: [] })} style={{ ...btnSec, ...chico, color: "#B23A3A", borderColor: "#B23A3A" }}>Quitar todos</button>}
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.2rem 1rem", marginTop: "0.4rem", maxHeight: 180, overflowY: "auto", border: "1px solid #EEF1F4", padding: "0.5rem" }}>
                  {datos.legajos.map((l) => <label key={l.id} style={{ minWidth: 230, fontSize: "0.88rem" }}><input type="checkbox" checked={form.legajoIds.includes(l.id)} onChange={() => alternar(l.id)} style={{ marginRight: 5 }} />{l.apellido}, {l.nombre} <span style={{ color: "#6b727b" }}>· {l.sector}</span></label>)}
                </div>
              </div>
              {errorForm && <p style={{ color: "#B23A3A", margin: "0.5rem 0 0" }}>{errorForm}</p>}
              <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}>
                <button onClick={crear}>Guardar</button>
                <button onClick={() => setForm(null)} style={btnSec}>Cancelar</button>
              </div>
              <p style={{ fontSize: "0.78rem", color: "#6b727b", margin: "0.5rem 0 0" }}>Si la fecha es de hoy en adelante, a los convocados les llega un aviso. Una capacitación que ya se dio también se puede cargar, para dejar el registro.</p>
            </div>
          )}

          <h2>Programadas ({programadas.length})</h2>
          {programadas.length === 0 && <p>No hay capacitaciones programadas.</p>}
          {programadas.map(tarjeta)}

          <h2 style={{ marginTop: "1.5rem" }}>Realizadas y canceladas ({cerradas.length})</h2>
          {(verTodas ? cerradas : cerradas.slice(0, 10)).map(tarjeta)}
          {!verTodas && cerradas.length > 10 && <p><button onClick={() => setVerTodas(true)} style={btnSec}>Ver las {cerradas.length}</button></p>}
        </>
      )}
    </main>
  );
}
