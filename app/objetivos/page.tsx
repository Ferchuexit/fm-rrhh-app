"use client";
// FM RRHH — app/objetivos/page.tsx
// Objetivos y plan de carrera, persona por persona: qué se espera de cada
// uno y cómo viene, a qué puesto apunta y qué le falta para llegar.
import { useEffect, useMemo, useState } from "react";
import { NIVELES } from "@/lib/capacitaciones-reglas";
import { ESTADOS_OBJETIVO, brecha, resumenObjetivos, semaforo, type Requisito } from "@/lib/objetivos-reglas";

type Legajo = { id: string; numero: number; apellido: string; nombre: string; centroCostoId: string | null; sector: string };
type Objetivo = { id: string; legajoId: string; titulo: string; descripcion: string | null; fechaLimite: string; avance: number; estado: string; nota: string | null; notaPor: string | null; actualizadoEn: string | null; comentarioCierre: string | null; creadoPor: string };
type Plan = { legajoId: string; puestoObjetivo: string; fechaObjetivo: string | null; notas: string | null; requisitos: Requisito[] };
type Datos = { hoy: string; legajos: Legajo[]; objetivos: Objetivo[]; planes: Plan[]; tiene: { legajoId: string; habilidadId: string; nivel: number; vence: string | null }[]; habilidades: { id: string; nombre: string; grupo: string }[] };

const dia = (iso: string) => new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
const caja: React.CSSProperties = { background: "white", border: "1px solid #dfe4e8", padding: "1rem", marginBottom: "1rem", maxWidth: "1000px" };
const btnSec: React.CSSProperties = { background: "white", color: "#163A5C", border: "1px solid #163A5C" };
const chico: React.CSSProperties = { padding: "0.2rem 0.6rem", fontSize: "0.8rem" };
const COLOR: Record<string, string> = { vencido: "#B23A3A", por_vencer: "#B8752B", en_fecha: "#7FA8C6", cumplido: "#2F6F5E", no_cumplido: "#B23A3A", cancelado: "#9aa5b1" };
const quien = (q: string | null) => (!q ? "" : q === "empleado" ? "el empleado" : q.startsWith("jefe: ") ? `su jefe, ${q.slice(6)}` : "RR.HH.");

async function enviar(url: string, cuerpo: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo) });
  const d = await res.json().catch(() => ({ error: "El servidor no devolvió una respuesta válida." }));
  return { ok: res.ok, d };
}

export default function ObjetivosPage() {
  const [datos, setDatos] = useState<Datos | null>(null);
  const [error, setError] = useState("");
  const [sector, setSector] = useState("");
  const [soloCon, setSoloCon] = useState(true);
  const [nuevo, setNuevo] = useState<{ titulo: string; descripcion: string; fechaLimite: string; legajoIds: string[] } | null>(null);
  const [errorNuevo, setErrorNuevo] = useState("");
  const [accion, setAccion] = useState<{ id: string; tipo: "avance" | "cerrar"; avance: string; nota: string; estado: string; comentario: string } | null>(null);
  const [plan, setPlan] = useState<{ legajoId: string; puestoObjetivo: string; fechaObjetivo: string; notas: string; requisitos: Requisito[]; existe: boolean } | null>(null);
  const [aviso, setAviso] = useState<{ donde: string; texto: string } | null>(null);

  async function cargar() {
    const res = await fetch("/api/objetivos");
    const d = await res.json().catch(() => ({ error: "El servidor no devolvió una respuesta válida." }));
    if (!res.ok) { setError(d.error ?? "No se pudo cargar."); return; }
    setError("");
    setDatos(d);
  }
  useEffect(() => { cargar(); }, []);

  const hoy = useMemo(() => new Date(datos?.hoy ?? Date.now()), [datos]);
  const sectores = useMemo(() => [...new Map((datos?.legajos ?? []).filter((l) => l.centroCostoId).map((l) => [l.centroCostoId!, l.sector])).entries()].sort((a, b) => a[1].localeCompare(b[1])), [datos]);
  const delSector = (datos?.legajos ?? []).filter((l) => !sector || l.centroCostoId === sector);
  const idsSector = new Set(delSector.map((l) => l.id));
  const fechado = (o: Objetivo) => ({ estado: o.estado, fechaLimite: new Date(o.fechaLimite) });
  const resumen = resumenObjetivos((datos?.objetivos ?? []).filter((o) => idsSector.has(o.legajoId)).map(fechado), hoy);
  const nombreHab = (id: string) => datos?.habilidades.find((h) => h.id === id)?.nombre ?? "(habilidad borrada)";

  async function crear() {
    if (!nuevo) return;
    setErrorNuevo("");
    const r = await enviar("/api/objetivos", nuevo);
    if (!r.ok) { setErrorNuevo(r.d.error ?? "No se pudo guardar."); return; }
    setNuevo(null);
    cargar();
  }
  async function aplicar(o: Objetivo, cuerpo: Record<string, unknown>) {
    setAviso(null);
    const r = await enviar(`/api/objetivos/${o.id}`, cuerpo);
    if (!r.ok) { setAviso({ donde: o.id, texto: r.d.error ?? "No se pudo guardar." }); return; }
    setAccion(null);
    cargar();
  }
  async function guardarPlan(borrar = false) {
    if (!plan) return;
    setAviso(null);
    const r = await enviar("/api/objetivos/plan", borrar ? { accion: "borrar", legajoId: plan.legajoId } : plan);
    if (!r.ok) { setAviso({ donde: "plan", texto: r.d.error ?? "No se pudo guardar." }); return; }
    setPlan(null);
    cargar();
  }
  const alternar = (id: string) => nuevo && setNuevo({ ...nuevo, legajoIds: nuevo.legajoIds.includes(id) ? nuevo.legajoIds.filter((x) => x !== id) : [...nuevo.legajoIds, id] });
  const sumar = (cc: string) => nuevo && setNuevo({ ...nuevo, legajoIds: [...new Set([...nuevo.legajoIds, ...(datos?.legajos ?? []).filter((l) => !cc || l.centroCostoId === cc).map((l) => l.id)])] });

  function filaObjetivo(o: Objetivo) {
    const s = semaforo(fechado(o), hoy);
    const color = COLOR[o.estado === "en_curso" ? s : o.estado];
    const a = accion?.id === o.id ? accion : null;
    return (
      <div key={o.id} style={{ borderLeft: `4px solid ${color}`, padding: "0.4rem 0.75rem", marginBottom: "0.5rem", background: "#F7F9FA" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ flex: 1, minWidth: 260 }}>
            <strong>{o.titulo}</strong>
            <div style={{ fontSize: "0.82rem", color: s === "vencido" ? "#B23A3A" : "#4A4F58" }}>
              {o.estado === "en_curso" ? <>Para el {dia(o.fechaLimite)}{s === "vencido" && " — vencido"}{s === "por_vencer" && " — está por vencer"}</> : <strong style={{ color }}>{ESTADOS_OBJETIVO[o.estado]}</strong>}
              {o.creadoPor.startsWith("jefe: ") && <> · lo cargó su jefe</>}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <div style={{ width: 120, height: 8, background: "#E6EAEE" }}><div style={{ width: `${o.avance}%`, height: 8, background: color }} /></div>
            <strong style={{ minWidth: 38, textAlign: "right" }}>{o.avance}%</strong>
            {o.estado === "en_curso" ? (
              <>
                <button onClick={() => { setAviso(null); setAccion({ id: o.id, tipo: "avance", avance: String(o.avance), nota: "", estado: "cumplido", comentario: "" }); }} style={{ ...btnSec, ...chico }}>Avance</button>
                <button onClick={() => { setAviso(null); setAccion({ id: o.id, tipo: "cerrar", avance: "", nota: "", estado: "cumplido", comentario: "" }); }} style={{ ...btnSec, ...chico }}>Cerrar</button>
              </>
            ) : <button onClick={() => aplicar(o, { accion: "reabrir" })} style={{ ...btnSec, ...chico }}>Reabrir</button>}
          </div>
        </div>
        {o.descripcion && <div style={{ fontSize: "0.85rem", whiteSpace: "pre-wrap", marginTop: 3 }}>{o.descripcion}</div>}
        {o.nota && <div style={{ fontSize: "0.82rem", color: "#4A4F58", marginTop: 3 }}>Último avance ({quien(o.notaPor)}{o.actualizadoEn ? `, ${dia(o.actualizadoEn)}` : ""}): «{o.nota}»</div>}
        {o.comentarioCierre && <div style={{ fontSize: "0.82rem", marginTop: 3 }}>Al cerrarlo: «{o.comentarioCierre}»</div>}
        {a?.tipo === "avance" && (
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "flex-end", marginTop: "0.5rem" }}>
            <label>Avance %<br /><input type="number" min="0" max="100" step="5" value={a.avance} onChange={(e) => setAccion({ ...a, avance: e.target.value })} style={{ width: 80 }} /></label>
            <label style={{ flex: 1, minWidth: 240 }}>Comentario (opcional)<br /><input value={a.nota} maxLength={500} onChange={(e) => setAccion({ ...a, nota: e.target.value })} style={{ width: "100%" }} /></label>
            <button onClick={() => aplicar(o, { accion: "avance", avance: a.avance, nota: a.nota })}>Guardar</button>
            <button onClick={() => setAccion(null)} style={btnSec}>Cancelar</button>
          </div>
        )}
        {a?.tipo === "cerrar" && (
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "flex-end", marginTop: "0.5rem" }}>
            <label>¿Cómo terminó?<br /><select value={a.estado} onChange={(e) => setAccion({ ...a, estado: e.target.value })}><option value="cumplido">Se cumplió</option><option value="no_cumplido">No se cumplió</option><option value="cancelado">Cancelar (ya no corre)</option></select></label>
            <label style={{ flex: 1, minWidth: 240 }}>Comentario{a.estado === "no_cumplido" ? " (por qué)" : " (opcional)"}<br /><input value={a.comentario} maxLength={500} onChange={(e) => setAccion({ ...a, comentario: e.target.value })} style={{ width: "100%" }} /></label>
            <button onClick={() => aplicar(o, { accion: "cerrar", estado: a.estado, comentario: a.comentario })}>Cerrar objetivo</button>
            <button onClick={() => setAccion(null)} style={btnSec}>Cancelar</button>
          </div>
        )}
        {aviso?.donde === o.id && <p style={{ color: "#B23A3A", margin: "0.4rem 0 0" }}>{aviso.texto}</p>}
      </div>
    );
  }

  function tarjetaPersona(l: Legajo) {
    const objetivos = (datos?.objetivos ?? []).filter((o) => o.legajoId === l.id);
    const p = datos?.planes.find((x) => x.legajoId === l.id);
    if (soloCon && objetivos.length === 0 && !p && plan?.legajoId !== l.id) return null;
    const enCurso = objetivos.filter((o) => o.estado === "en_curso");
    const cerrados = objetivos.filter((o) => o.estado !== "en_curso");
    const b = p ? brecha(p.requisitos, (datos?.tiene ?? []).filter((t) => t.legajoId === l.id).map((t) => ({ ...t, vence: t.vence ? new Date(t.vence) : null })), hoy) : null;
    const editando = plan?.legajoId === l.id ? plan : null;
    return (
      <div key={l.id} style={caja}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap", alignItems: "center", marginBottom: "0.5rem" }}>
          <div><strong style={{ color: "#163A5C" }}>{l.apellido}, {l.nombre}</strong> <span style={{ color: "#6b727b" }}>· legajo {l.numero} · {l.sector}</span></div>
          <div style={{ display: "flex", gap: "0.4rem" }}>
            <button onClick={() => { setNuevo({ titulo: "", descripcion: "", fechaLimite: "", legajoIds: [l.id] }); setErrorNuevo(""); window.scrollTo({ top: 0, behavior: "smooth" }); }} style={{ ...btnSec, ...chico }}>+ Objetivo</button>
            {!editando && <button onClick={() => { setAviso(null); setPlan({ legajoId: l.id, puestoObjetivo: p?.puestoObjetivo ?? "", fechaObjetivo: p?.fechaObjetivo?.slice(0, 10) ?? "", notas: p?.notas ?? "", requisitos: p?.requisitos ?? [], existe: !!p }); }} style={{ ...btnSec, ...chico }}>{p ? "Editar plan de carrera" : "+ Plan de carrera"}</button>}
          </div>
        </div>

        {p && b && !editando && (
          <div style={{ border: "1px solid #dfe4e8", padding: "0.6rem 0.75rem", marginBottom: "0.6rem" }}>
            <div>🎯 Apunta a <strong>{p.puestoObjetivo}</strong>{p.fechaObjetivo && <> · para {dia(p.fechaObjetivo)}</>}{b.total > 0 && <> · tiene <strong>{b.cumplidos} de {b.total}</strong> habilidades que pide el puesto</>}</div>
            {p.notas && <div style={{ fontSize: "0.85rem", whiteSpace: "pre-wrap", marginTop: 3 }}>{p.notas}</div>}
            {b.total > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", marginTop: "0.45rem" }}>
                {b.detalle.map((d) => (
                  <span key={d.habilidadId} style={{ fontSize: "0.8rem", padding: "0.15rem 0.5rem", border: `1px solid ${d.cumple ? "#b4d6ca" : "#efcf9f"}`, background: d.cumple ? "#e3f1ec" : "#fdf1e1", color: d.cumple ? "#215446" : "#6e430f" }}>
                    {d.cumple ? "✓" : "✗"} {nombreHab(d.habilidadId)} — {d.cumple ? NIVELES[d.pedido]?.nombre.toLowerCase() : d.vencida ? "vencida: hay que renovarla" : `tiene ${d.actual ? NIVELES[d.actual]?.nombre.toLowerCase() : "nada"}, necesita ${NIVELES[d.pedido]?.nombre.toLowerCase()}`}
                  </span>
                ))}
              </div>
            )}
            {b.total > 0 && b.cumplidos < b.total && <div style={{ fontSize: "0.78rem", color: "#6b727b", marginTop: "0.4rem" }}>Lo que falta se resuelve con una <a href="/capacitaciones">capacitación</a> que habilite en esa habilidad: al cerrarla, se actualiza solo.</div>}
          </div>
        )}
        {editando && (
          <div style={{ border: "1px solid #163A5C", padding: "0.75rem", marginBottom: "0.6rem" }}>
            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "flex-end" }}>
              <label>Puesto al que apunta<br /><input value={editando.puestoObjetivo} maxLength={80} placeholder="Oficial tornero" onChange={(e) => setPlan({ ...editando, puestoObjetivo: e.target.value })} style={{ width: 260 }} /></label>
              <label>Para cuándo (opcional)<br /><input type="date" value={editando.fechaObjetivo} onChange={(e) => setPlan({ ...editando, fechaObjetivo: e.target.value })} /></label>
            </div>
            <label style={{ display: "block", marginTop: "0.5rem" }}>Notas (opcional)<br /><textarea rows={2} maxLength={1000} value={editando.notas} onChange={(e) => setPlan({ ...editando, notas: e.target.value })} style={{ width: "100%", maxWidth: 700 }} placeholder="Qué se habló con la persona, pasos intermedios, quién lo acompaña" /></label>
            <div style={{ marginTop: "0.5rem" }}><strong>Habilidades que pide ese puesto</strong> <span style={{ fontSize: "0.8rem", color: "#6b727b" }}>(de la <a href="/habilidades">matriz</a>)</span></div>
            {datos!.habilidades.length === 0 && <p style={{ fontSize: "0.85rem", color: "#6b727b", margin: "0.3rem 0" }}>Todavía no hay habilidades cargadas en la matriz. El plan se puede guardar igual, sin requisitos.</p>}
            {editando.requisitos.map((r, i) => (
              <div key={i} style={{ display: "flex", gap: "0.5rem", marginTop: "0.3rem" }}>
                <select value={r.habilidadId} onChange={(e) => setPlan({ ...editando, requisitos: editando.requisitos.map((x, j) => (j === i ? { ...x, habilidadId: e.target.value } : x)) })}>{datos!.habilidades.map((h) => <option key={h.id} value={h.id}>{h.grupo}: {h.nombre}</option>)}</select>
                <select value={r.nivel} onChange={(e) => setPlan({ ...editando, requisitos: editando.requisitos.map((x, j) => (j === i ? { ...x, nivel: Number(e.target.value) } : x)) })}>{Object.entries(NIVELES).map(([n, v]) => <option key={n} value={n}>{n} · {v.nombre}</option>)}</select>
                <button onClick={() => setPlan({ ...editando, requisitos: editando.requisitos.filter((_, j) => j !== i) })} style={{ ...btnSec, ...chico }}>✕</button>
              </div>
            ))}
            {datos!.habilidades.length > 0 && <button onClick={() => setPlan({ ...editando, requisitos: [...editando.requisitos, { habilidadId: datos!.habilidades.find((h) => !editando.requisitos.some((r) => r.habilidadId === h.id))?.id ?? datos!.habilidades[0].id, nivel: 3 }] })} style={{ ...btnSec, ...chico, marginTop: "0.4rem" }}>+ Habilidad</button>}
            {aviso?.donde === "plan" && <p style={{ color: "#B23A3A", margin: "0.5rem 0 0" }}>{aviso.texto}</p>}
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.6rem" }}>
              <button onClick={() => guardarPlan()}>Guardar plan</button>
              <button onClick={() => setPlan(null)} style={btnSec}>Cancelar</button>
              {editando.existe && <button onClick={() => guardarPlan(true)} style={{ ...btnSec, color: "#B23A3A", borderColor: "#B23A3A", marginLeft: "auto" }}>Quitar plan</button>}
            </div>
          </div>
        )}

        {enCurso.map(filaObjetivo)}
        {enCurso.length === 0 && <p style={{ fontSize: "0.85rem", color: "#6b727b", margin: "0 0 0.4rem" }}>Sin objetivos en curso.</p>}
        {cerrados.length > 0 && (
          <details>
            <summary style={{ cursor: "pointer", fontSize: "0.85rem", color: "#163A5C" }}>Cerrados ({cerrados.length})</summary>
            <div style={{ marginTop: "0.4rem" }}>{cerrados.map(filaObjetivo)}</div>
          </details>
        )}
      </div>
    );
  }

  const tarjetas = datos ? delSector.map(tarjetaPersona).filter(Boolean) : [];
  const tile = (n: string | number, texto: string, color = "#163A5C") => <div style={{ background: "white", border: "1px solid #dfe4e8", padding: "0.6rem 1rem", minWidth: 130 }}><div style={{ fontSize: "1.5rem", fontWeight: 700, color }}>{n}</div><div style={{ fontSize: "0.78rem", color: "#6b727b" }}>{texto}</div></div>;

  return (
    <main>
      <h1>Objetivos y plan de carrera</h1>
      <p style={{ maxWidth: "860px" }}>
        <strong>Objetivos</strong>: qué se espera de cada uno y para cuándo. Los carga RR.HH. o el jefe; el empleado informa cómo viene desde el portal; lo cierra el jefe o RR.HH.{" "}
        <strong>Plan de carrera</strong>: a qué puesto apunta y qué habilidades de la matriz le faltan para llegar.
      </p>
      {error && <p style={{ color: "#B23A3A" }}>{error}</p>}
      {!datos && !error && <p>Cargando…</p>}

      {datos && (
        <>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "1rem" }}>
            {tile(resumen.enCurso, "objetivos en curso")}
            {tile(resumen.vencidos, "vencidos sin cerrar", resumen.vencidos ? "#B23A3A" : "#163A5C")}
            {tile(resumen.cumplimiento === null ? "—" : `${resumen.cumplimiento}%`, `cumplimiento (${resumen.cumplidos} de ${resumen.cumplidos + resumen.noCumplidos} cerrados)`, "#2F6F5E")}
            {tile(datos.planes.filter((p) => idsSector.has(p.legajoId)).length, "con plan de carrera")}
          </div>

          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center", marginBottom: "1rem" }}>
            {!nuevo && <button onClick={() => { setNuevo({ titulo: "", descripcion: "", fechaLimite: "", legajoIds: [] }); setErrorNuevo(""); }}>+ Nuevo objetivo</button>}
            <label>Sector <select value={sector} onChange={(e) => setSector(e.target.value)}><option value="">Todos</option>{sectores.map(([id, n]) => <option key={id} value={id}>{n}</option>)}</select></label>
            <label><input type="checkbox" checked={soloCon} onChange={(e) => setSoloCon(e.target.checked)} style={{ marginRight: 5 }} />Solo quienes tienen objetivos o plan</label>
          </div>

          {nuevo && (
            <div style={caja}>
              <strong style={{ color: "#163A5C" }}>Nuevo objetivo</strong>
              <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "flex-end", marginTop: "0.6rem" }}>
                <label style={{ flex: 1, minWidth: 320 }}>Objetivo<br /><input value={nuevo.titulo} maxLength={120} onChange={(e) => setNuevo({ ...nuevo, titulo: e.target.value })} placeholder="Bajar el scrap de la línea 2 a menos del 3%" style={{ width: "100%" }} /></label>
                <label>Para el<br /><input type="date" min={datos.hoy.slice(0, 10)} value={nuevo.fechaLimite} onChange={(e) => setNuevo({ ...nuevo, fechaLimite: e.target.value })} /></label>
              </div>
              <label style={{ display: "block", marginTop: "0.6rem" }}>Cómo se mide / detalle (opcional)<br /><textarea rows={2} maxLength={1000} value={nuevo.descripcion} onChange={(e) => setNuevo({ ...nuevo, descripcion: e.target.value })} style={{ width: "100%", maxWidth: 700 }} /></label>
              <div style={{ marginTop: "0.8rem" }}>
                <strong>Para quién ({nuevo.legajoIds.length})</strong>{" "}
                {sectores.map(([id, nombre]) => <button key={id} onClick={() => sumar(id)} style={{ ...btnSec, ...chico, marginRight: 4 }}>+ {nombre}</button>)}
                {nuevo.legajoIds.length > 0 && <button onClick={() => setNuevo({ ...nuevo, legajoIds: [] })} style={{ ...btnSec, ...chico, color: "#B23A3A", borderColor: "#B23A3A" }}>Quitar todos</button>}
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.2rem 1rem", marginTop: "0.4rem", maxHeight: 180, overflowY: "auto", border: "1px solid #EEF1F4", padding: "0.5rem" }}>
                  {datos.legajos.map((l) => <label key={l.id} style={{ minWidth: 230, fontSize: "0.88rem" }}><input type="checkbox" checked={nuevo.legajoIds.includes(l.id)} onChange={() => alternar(l.id)} style={{ marginRight: 5 }} />{l.apellido}, {l.nombre} <span style={{ color: "#6b727b" }}>· {l.sector}</span></label>)}
                </div>
              </div>
              {errorNuevo && <p style={{ color: "#B23A3A", margin: "0.5rem 0 0" }}>{errorNuevo}</p>}
              <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}>
                <button onClick={crear}>Guardar y avisar</button>
                <button onClick={() => setNuevo(null)} style={btnSec}>Cancelar</button>
              </div>
              <p style={{ fontSize: "0.78rem", color: "#6b727b", margin: "0.5rem 0 0" }}>Si elegís a varios, cada uno recibe su propia copia del objetivo y la sigue por separado.</p>
            </div>
          )}

          {tarjetas}
          {tarjetas.length === 0 && <p>{soloCon ? "Nadie tiene objetivos ni plan de carrera todavía. Cargá el primero con «+ Nuevo objetivo», o destildá el filtro para ver a todos." : "No hay empleados activos en ese sector."}</p>}
        </>
      )}
    </main>
  );
}
