"use client";
// FM RRHH — app/puestos/page.tsx
// Puestos y organigrama: el perfil de cada puesto, de quién depende, quién
// lo ocupa y dónde falta gente. Desde una vacante se abre la búsqueda.
import { useEffect, useMemo, useState } from "react";
import { NIVELES } from "@/lib/capacitaciones-reglas";
import { organigrama, type Requisito } from "@/lib/reclutamiento-reglas";

type Puesto = { id: string; nombre: string; centroCostoId: string | null; reportaAId: string | null; mision: string | null; tareas: string | null; requisitos: string | null; condiciones: string | null; habilidades: Requisito[]; dotacion: number; busquedaId: string | null };
type Legajo = { id: string; numero: number; apellido: string; nombre: string; puestoId: string | null; sector: string };
type Datos = { puestos: Puesto[]; legajos: Legajo[]; sectores: { id: string; nombre: string }[]; habilidades: { id: string; nombre: string; grupo: string }[] };
type Form = Omit<Puesto, "busquedaId" | "dotacion"> & { dotacion: string };

const caja: React.CSSProperties = { background: "white", border: "1px solid #dfe4e8", padding: "1rem", marginBottom: "1rem", maxWidth: "1000px" };
const btnSec: React.CSSProperties = { background: "white", color: "#163A5C", border: "1px solid #163A5C" };
const chico: React.CSSProperties = { padding: "0.2rem 0.6rem", fontSize: "0.8rem" };
const VACIO: Form = { id: "", nombre: "", centroCostoId: null, reportaAId: null, mision: "", tareas: "", requisitos: "", condiciones: "", habilidades: [], dotacion: "1" };

async function enviar(cuerpo: unknown) {
  const res = await fetch("/api/puestos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo) });
  const d = await res.json().catch(() => ({ error: "El servidor no devolvió una respuesta válida." }));
  return { ok: res.ok, d };
}

export default function PuestosPage() {
  const [datos, setDatos] = useState<Datos | null>(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState<Form | null>(null);
  const [errorForm, setErrorForm] = useState("");
  const [abierto, setAbierto] = useState<string | null>(null);
  const [ocupantes, setOcupantes] = useState<{ puestoId: string; ids: string[] } | null>(null);

  async function cargar() {
    const res = await fetch("/api/puestos");
    const d = await res.json().catch(() => ({ error: "El servidor no devolvió una respuesta válida." }));
    if (!res.ok) { setError(d.error ?? "No se pudo cargar."); return; }
    setError("");
    setDatos(d);
  }
  useEffect(() => { cargar(); }, []);

  const filas = useMemo(() => organigrama((datos?.puestos ?? []).map((p) => ({ ...p, ocupantes: (datos?.legajos ?? []).filter((l) => l.puestoId === p.id).length }))), [datos]);
  const sinPuesto = (datos?.legajos ?? []).filter((l) => !l.puestoId);
  const totalVacantes = filas.reduce((a, f) => a + f.vacantes, 0);
  const nombreHab = (id: string) => datos?.habilidades.find((h) => h.id === id)?.nombre ?? "(borrada)";

  async function guardar() {
    if (!form) return;
    setErrorForm("");
    const r = await enviar(form);
    if (!r.ok) { setErrorForm(r.d.error ?? "No se pudo guardar."); return; }
    setForm(null);
    cargar();
  }
  async function borrar(p: Puesto) {
    if (!window.confirm(`¿Borrar el puesto «${p.nombre}»? Quienes lo ocupan quedan sin puesto y los que dependían de él, sin superior.`)) return;
    const r = await enviar({ accion: "borrar", id: p.id });
    if (!r.ok) setError(r.d.error ?? "No se pudo borrar.");
    cargar();
  }
  async function guardarOcupantes() {
    if (!ocupantes) return;
    const r = await enviar({ accion: "ocupantes", id: ocupantes.puestoId, legajoIds: ocupantes.ids });
    if (!r.ok) { setError(r.d.error ?? "No se pudo guardar."); return; }
    setOcupantes(null);
    cargar();
  }
  const editar = (p: Puesto) => { setErrorForm(""); setForm({ ...p, mision: p.mision ?? "", tareas: p.tareas ?? "", requisitos: p.requisitos ?? "", condiciones: p.condiciones ?? "", dotacion: String(p.dotacion) }); window.scrollTo({ top: 0, behavior: "smooth" }); };

  return (
    <main>
      <h1>Puestos y organigrama</h1>
      <p style={{ maxWidth: "860px" }}>
        Cada <strong>puesto</strong> dice qué hace, qué pide, de quién depende y cuánta gente debería tener. Con eso se arma el organigrama, se ve <strong>dónde hay vacantes</strong> y,
        al abrir una búsqueda, el aviso sale armado desde el perfil.
      </p>
      {error && <p style={{ color: "#B23A3A" }}>{error}</p>}
      {!datos && !error && <p>Cargando…</p>}

      {datos && (
        <>
          {!form && <p><button onClick={() => { setErrorForm(""); setForm({ ...VACIO }); }}>+ Nuevo puesto</button></p>}
          {form && (
            <div style={caja}>
              <strong style={{ color: "#163A5C" }}>{form.id ? "Editar puesto" : "Nuevo puesto"}</strong>
              <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "flex-end", marginTop: "0.6rem" }}>
                <label>Nombre del puesto<br /><input value={form.nombre} maxLength={80} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Operario de seccionadora" style={{ width: 280 }} /></label>
                <label>Sector<br /><select value={form.centroCostoId ?? ""} onChange={(e) => setForm({ ...form, centroCostoId: e.target.value || null })}><option value="">—</option>{datos.sectores.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}</select></label>
                <label>Depende de<br /><select value={form.reportaAId ?? ""} onChange={(e) => setForm({ ...form, reportaAId: e.target.value || null })}><option value="">— nadie (cabeza del organigrama) —</option>{datos.puestos.filter((p) => p.id !== form.id).map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select></label>
                <label>Dotación<br /><input type="number" min={0} max={500} value={form.dotacion} onChange={(e) => setForm({ ...form, dotacion: e.target.value })} style={{ width: 70 }} title="Cuánta gente debería tener este puesto" /></label>
              </div>
              <label style={{ display: "block", marginTop: "0.6rem" }}>Para qué existe el puesto (misión)<br /><textarea rows={2} maxLength={500} value={form.mision ?? ""} onChange={(e) => setForm({ ...form, mision: e.target.value })} style={{ width: "100%", maxWidth: 760 }} placeholder="Cortar los tableros a medida según la orden de producción, cuidando el material y los tiempos." /></label>
              <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginTop: "0.6rem" }}>
                <label style={{ flex: 1, minWidth: 300 }}>Tareas principales <span style={{ color: "#6b727b" }}>(una por renglón)</span><br /><textarea rows={5} maxLength={2000} value={form.tareas ?? ""} onChange={(e) => setForm({ ...form, tareas: e.target.value })} style={{ width: "100%" }} /></label>
                <label style={{ flex: 1, minWidth: 300 }}>Requisitos <span style={{ color: "#6b727b" }}>(uno por renglón: estudios, experiencia, licencias)</span><br /><textarea rows={5} maxLength={2000} value={form.requisitos ?? ""} onChange={(e) => setForm({ ...form, requisitos: e.target.value })} style={{ width: "100%" }} /></label>
              </div>
              <label style={{ display: "block", marginTop: "0.6rem" }}>Condiciones <span style={{ color: "#6b727b" }}>(horario, turnos, lugar)</span><br /><input value={form.condiciones ?? ""} maxLength={500} onChange={(e) => setForm({ ...form, condiciones: e.target.value })} style={{ width: "100%", maxWidth: 760 }} placeholder="Lunes a viernes de 6 a 14 hs. Planta Benavídez." /></label>

              <div style={{ marginTop: "0.7rem" }}><strong>Habilidades que pide</strong> <span style={{ fontSize: "0.8rem", color: "#6b727b" }}>(de la <a href="/habilidades">matriz</a>)</span></div>
              {form.habilidades.map((r, i) => (
                <div key={i} style={{ display: "flex", gap: "0.5rem", marginTop: "0.3rem" }}>
                  <select value={r.habilidadId} onChange={(e) => setForm({ ...form, habilidades: form.habilidades.map((x, j) => (j === i ? { ...x, habilidadId: e.target.value } : x)) })}>{datos.habilidades.map((h) => <option key={h.id} value={h.id}>{h.grupo}: {h.nombre}</option>)}</select>
                  <select value={r.nivel} onChange={(e) => setForm({ ...form, habilidades: form.habilidades.map((x, j) => (j === i ? { ...x, nivel: Number(e.target.value) } : x)) })}>{Object.entries(NIVELES).map(([n, v]) => <option key={n} value={n}>{n} · {v.nombre}</option>)}</select>
                  <button onClick={() => setForm({ ...form, habilidades: form.habilidades.filter((_, j) => j !== i) })} style={{ ...btnSec, ...chico }}>✕</button>
                </div>
              ))}
              {datos.habilidades.length > 0 ? <button onClick={() => setForm({ ...form, habilidades: [...form.habilidades, { habilidadId: datos.habilidades.find((h) => !form.habilidades.some((r) => r.habilidadId === h.id))?.id ?? datos.habilidades[0].id, nivel: 3 }] })} style={{ ...btnSec, ...chico, marginTop: "0.4rem" }}>+ Habilidad</button> : <p style={{ fontSize: "0.85rem", color: "#6b727b", margin: "0.3rem 0 0" }}>Todavía no hay habilidades en la matriz.</p>}

              {errorForm && <p style={{ color: "#B23A3A", margin: "0.5rem 0 0" }}>{errorForm}</p>}
              <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}>
                <button onClick={guardar}>Guardar puesto</button>
                <button onClick={() => setForm(null)} style={btnSec}>Cancelar</button>
              </div>
            </div>
          )}

          <h2>Organigrama <span style={{ fontSize: "0.9rem", fontWeight: 400, color: "#4A4F58" }}>· {datos.puestos.length} puestos · {totalVacantes === 0 ? "sin vacantes" : `${totalVacantes} ${totalVacantes === 1 ? "vacante" : "vacantes"}`}</span></h2>
          {datos.puestos.length === 0 && <p>Todavía no hay puestos. Empezá por el de más arriba (gerente, encargado de planta) y seguí hacia abajo, eligiendo en cada uno de quién depende.</p>}
          <div style={{ maxWidth: 1000 }}>
            {filas.map(({ puesto: p, nivel, vacantes, aCargo }) => {
              const gente = datos.legajos.filter((l) => l.puestoId === p.id);
              const esta = abierto === p.id;
              const eligiendo = ocupantes?.puestoId === p.id ? ocupantes : null;
              return (
                <div key={p.id} style={{ marginLeft: nivel * 28, borderLeft: nivel ? "2px solid #cfd8e0" : undefined, paddingLeft: nivel ? 10 : 0, marginBottom: 6 }}>
                  <div style={{ background: "white", border: "1px solid #dfe4e8", borderLeft: `4px solid ${vacantes > 0 ? "#B8752B" : "#2F6F5E"}`, padding: "0.5rem 0.75rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
                      <div>
                        <strong style={{ color: "#163A5C" }}>{p.nombre}</strong>
                        {p.centroCostoId && <span style={{ color: "#6b727b" }}> · {datos.sectores.find((s) => s.id === p.centroCostoId)?.nombre}</span>}
                        <div style={{ fontSize: "0.85rem", color: "#4A4F58" }}>
                          {gente.length === 0 ? <span style={{ color: "#8a5413" }}>Nadie lo ocupa</span> : gente.map((l) => `${l.nombre} ${l.apellido}`).join(" · ")}
                          {aCargo > 0 && <span style={{ color: "#6b727b" }}> — {aCargo} {aCargo === 1 ? "persona" : "personas"} por debajo</span>}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: "0.4rem", alignItems: "center", flexWrap: "wrap" }}>
                        <span style={{ fontSize: "0.85rem" }}><strong>{gente.length}</strong> de {p.dotacion}</span>
                        {vacantes > 0 && (p.busquedaId
                          ? <a href={`/reclutamiento?b=${p.busquedaId}`} style={{ fontSize: "0.8rem" }}>Ver la búsqueda</a>
                          : <a href={`/reclutamiento?puesto=${p.id}&vacantes=${vacantes}`} style={{ fontSize: "0.8rem", fontWeight: 700, color: "#8a5413" }}>{vacantes} {vacantes === 1 ? "vacante" : "vacantes"}: abrir búsqueda</a>)}
                        <button onClick={() => { setAbierto(esta ? null : p.id); setOcupantes(null); }} style={{ ...btnSec, ...chico }}>{esta ? "Cerrar" : "Perfil"}</button>
                      </div>
                    </div>

                    {esta && (
                      <div style={{ marginTop: "0.6rem", borderTop: "1px solid #EEF1F4", paddingTop: "0.5rem", fontSize: "0.9rem" }}>
                        {p.mision && <p style={{ margin: "0 0 0.4rem" }}>{p.mision}</p>}
                        <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap" }}>
                          {p.tareas && <div style={{ flex: 1, minWidth: 260 }}><strong>Tareas</strong><div style={{ whiteSpace: "pre-wrap" }}>{p.tareas}</div></div>}
                          {p.requisitos && <div style={{ flex: 1, minWidth: 260 }}><strong>Requisitos</strong><div style={{ whiteSpace: "pre-wrap" }}>{p.requisitos}</div></div>}
                        </div>
                        {p.condiciones && <p style={{ margin: "0.4rem 0 0" }}><strong>Condiciones:</strong> {p.condiciones}</p>}
                        {p.habilidades.length > 0 && <p style={{ margin: "0.4rem 0 0" }}><strong>Habilidades:</strong> {p.habilidades.map((h) => `${nombreHab(h.habilidadId)} (${NIVELES[h.nivel]?.nombre.toLowerCase()})`).join(" · ")}</p>}
                        {!p.mision && !p.tareas && !p.requisitos && <p style={{ margin: 0, color: "#6b727b" }}>El perfil está vacío: completalo para que el aviso de búsqueda salga armado.</p>}

                        {eligiendo ? (
                          <div style={{ marginTop: "0.6rem", background: "#F5F7F9", padding: "0.6rem" }}>
                            <strong>¿Quiénes ocupan este puesto?</strong>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.2rem 1rem", marginTop: "0.4rem", maxHeight: 180, overflowY: "auto" }}>
                              {datos.legajos.map((l) => {
                                const otro = l.puestoId && l.puestoId !== p.id ? datos.puestos.find((x) => x.id === l.puestoId)?.nombre : null;
                                return <label key={l.id} style={{ minWidth: 290, fontSize: "0.88rem" }}><input type="checkbox" checked={eligiendo.ids.includes(l.id)} onChange={() => setOcupantes({ ...eligiendo, ids: eligiendo.ids.includes(l.id) ? eligiendo.ids.filter((x) => x !== l.id) : [...eligiendo.ids, l.id] })} style={{ marginRight: 5 }} />{l.apellido}, {l.nombre} <span style={{ color: "#6b727b" }}>· {otro ? `hoy: ${otro}` : l.sector}</span></label>;
                              })}
                            </div>
                            <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}><button onClick={guardarOcupantes} style={chico}>Guardar</button><button onClick={() => setOcupantes(null)} style={{ ...btnSec, ...chico }}>Cancelar</button></div>
                            <p style={{ fontSize: "0.78rem", color: "#6b727b", margin: "0.4rem 0 0" }}>Quien ya figura en otro puesto pasa a este.</p>
                          </div>
                        ) : (
                          <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.6rem" }}>
                            <button onClick={() => setOcupantes({ puestoId: p.id, ids: gente.map((l) => l.id) })} style={{ ...btnSec, ...chico }}>Quién lo ocupa</button>
                            <button onClick={() => editar(p)} style={{ ...btnSec, ...chico }}>Editar perfil</button>
                            <button onClick={() => borrar(p)} style={{ ...btnSec, ...chico, color: "#B23A3A", borderColor: "#B23A3A" }}>Borrar</button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {datos.puestos.length > 0 && sinPuesto.length > 0 && <p style={{ maxWidth: 1000, fontSize: "0.88rem", color: "#4A4F58", marginTop: "1rem" }}><strong>{sinPuesto.length} {sinPuesto.length === 1 ? "persona no tiene" : "personas no tienen"} puesto asignado:</strong> {sinPuesto.slice(0, 12).map((l) => `${l.nombre} ${l.apellido}`).join(" · ")}{sinPuesto.length > 12 && "…"}. Se asignan desde «Perfil → Quién lo ocupa».</p>}
        </>
      )}
    </main>
  );
}
