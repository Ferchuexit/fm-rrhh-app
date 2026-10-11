"use client";
// FM RRHH — app/organigrama/Editor.tsx
// Armar la estructura sin entrar legajo por legajo: una tabla con toda la
// gente, y de cada uno su sector, su puesto y a quién reporta. Se pueden
// tildar varios y aplicarles lo mismo de una vez. Nada se guarda hasta
// tocar "Guardar".
import { useMemo, useState } from "react";

export type Gente = { id: string; nombre: string; apellido: string; jefeId: string | null; puestoId: string | null; centroCostoId: string | null };
type Lista = { id: string; nombre: string }[];
type Campo = "jefeId" | "puestoId" | "centroCostoId";
const btnSec: React.CSSProperties = { background: "white", color: "#163A5C", border: "1px solid #163A5C" };

export default function Editor({ gente, sectores, puestos, alGuardar }: { gente: Gente[]; sectores: Lista; puestos: Lista; alGuardar: () => void }) {
  const [cambios, setCambios] = useState<Record<string, Partial<Record<Campo, string | null>>>>({});
  const [marcados, setMarcados] = useState<string[]>([]);
  const [filtro, setFiltro] = useState("");
  const [solo, setSolo] = useState<"todos" | "sinJefe" | "sinPuesto" | "sinSector">("todos");
  const [masivo, setMasivo] = useState<{ campo: Campo; valor: string }>({ campo: "jefeId", valor: "" });
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [guardando, setGuardando] = useState(false);

  const orden = useMemo(() => [...gente].sort((a, b) => `${a.apellido} ${a.nombre}`.localeCompare(`${b.apellido} ${b.nombre}`)), [gente]);
  const valor = (p: Gente, c: Campo) => (cambios[p.id] && c in cambios[p.id] ? cambios[p.id][c] ?? null : p[c]);
  const poner = (ids: string[], c: Campo, v: string | null) => setCambios((actual) => {
    const n = { ...actual };
    for (const id of ids) {
      const p = gente.find((g) => g.id === id)!;
      if (c === "jefeId" && v === id) continue; // nadie se reporta a sí mismo
      const fila = { ...(n[id] ?? {}) };
      if ((p[c] ?? null) === v) delete fila[c]; else fila[c] = v; // volver al valor original no es un cambio
      if (Object.keys(fila).length) n[id] = fila; else delete n[id];
    }
    return n;
  });
  const q = filtro.trim().toLowerCase();
  const visibles = orden.filter((p) => (!q || `${p.apellido} ${p.nombre}`.toLowerCase().includes(q)) && (solo === "todos" || (solo === "sinJefe" && !valor(p, "jefeId")) || (solo === "sinPuesto" && !valor(p, "puestoId")) || (solo === "sinSector" && !valor(p, "centroCostoId"))));
  const pendientes = Object.keys(cambios).length;
  const opciones = masivo.campo === "jefeId" ? orden.map((p) => ({ id: p.id, nombre: `${p.apellido}, ${p.nombre}` })) : masivo.campo === "puestoId" ? puestos : sectores;

  async function guardar() {
    setGuardando(true); setError(""); setMsg("");
    const res = await fetch("/api/organigrama", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cambios: Object.entries(cambios).map(([id, c]) => ({ id, ...c })) }) }).catch(() => null);
    const d = res ? await res.json().catch(() => ({})) : {};
    setGuardando(false);
    if (!res?.ok) { setError(d.error ?? "No se pudo guardar."); return; }
    setMsg(`Guardado: ${d.guardados} ${d.guardados === 1 ? "persona actualizada" : "personas actualizadas"}.`);
    setCambios({}); setMarcados([]);
    alGuardar();
  }
  const select = (p: Gente, c: Campo, lista: Lista, vacio: string) => (
    <select value={valor(p, c) ?? ""} onChange={(e) => poner([p.id], c, e.target.value || null)} aria-label={`${c === "jefeId" ? "Reporta a" : c === "puestoId" ? "Puesto" : "Sector"} de ${p.nombre} ${p.apellido}`} style={{ maxWidth: 230, ...(cambios[p.id] && c in cambios[p.id] ? { outline: "2px solid #f5c542", background: "#fffbea" } : {}) }}>
      <option value="">{vacio}</option>
      {lista.filter((o) => !(c === "jefeId" && o.id === p.id)).map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}
    </select>
  );
  const deJefes = orden.map((p) => ({ id: p.id, nombre: `${p.apellido}, ${p.nombre}` }));

  return (
    <div style={{ maxWidth: 1150 }}>
      <p style={{ maxWidth: 900 }}>Elegí de cada persona su sector, su puesto y a quién reporta. Para ir más rápido, tildá a varios y aplicales lo mismo de una vez (por ejemplo: todos los operarios del taller reportan al mismo jefe). Lo que cambiaste queda resaltado y no se guarda hasta que toques <strong>Guardar</strong>.</p>
      <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", alignItems: "center", marginBottom: "0.6rem" }}>
        <input value={filtro} onChange={(e) => setFiltro(e.target.value)} placeholder="Buscar por apellido o nombre" aria-label="Buscar" style={{ width: 230 }} />
        <select value={solo} onChange={(e) => setSolo(e.target.value as typeof solo)} aria-label="Mostrar">
          <option value="todos">Todos ({orden.length})</option>
          <option value="sinJefe">Sin jefe ({orden.filter((p) => !valor(p, "jefeId")).length})</option>
          <option value="sinPuesto">Sin puesto ({orden.filter((p) => !valor(p, "puestoId")).length})</option>
          <option value="sinSector">Sin sector ({orden.filter((p) => !valor(p, "centroCostoId")).length})</option>
        </select>
      </div>
      <div style={{ background: marcados.length ? "#e8f0f6" : "#f6f8fa", border: "1px solid #dfe4e8", padding: "0.55rem 0.8rem", marginBottom: "0.6rem", display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
        <strong>{marcados.length} {marcados.length === 1 ? "marcado" : "marcados"}:</strong>
        <select value={masivo.campo} onChange={(e) => setMasivo({ campo: e.target.value as Campo, valor: "" })} aria-label="Qué cambiar"><option value="jefeId">reportan a</option><option value="puestoId">puesto</option><option value="centroCostoId">sector</option></select>
        <select value={masivo.valor} onChange={(e) => setMasivo({ ...masivo, valor: e.target.value })} aria-label="Valor" style={{ maxWidth: 260 }}><option value="">— elegir —</option><option value="__ninguno">(ninguno)</option>{opciones.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}</select>
        <button onClick={() => { poner(marcados, masivo.campo, masivo.valor === "__ninguno" ? null : masivo.valor); setMarcados([]); }} disabled={!marcados.length || !masivo.valor}>Aplicar a los marcados</button>
        {marcados.length > 0 && <button onClick={() => setMarcados([])} style={btnSec}>Desmarcar</button>}
      </div>
      {error && <p style={{ color: "#B23A3A", fontWeight: 600 }}>{error}</p>}
      {msg && <p style={{ color: "#2F6F5E" }}>{msg}</p>}
      <div style={{ overflowX: "auto", background: "white", border: "1px solid #dfe4e8" }}>
        <table style={{ margin: 0 }}>
          <thead><tr><th><input type="checkbox" aria-label="Marcar todos los que se ven" checked={visibles.length > 0 && visibles.every((p) => marcados.includes(p.id))} onChange={(e) => setMarcados(e.target.checked ? [...new Set([...marcados, ...visibles.map((p) => p.id)])] : marcados.filter((id) => !visibles.some((p) => p.id === id)))} /></th><th>Persona</th><th>Sector</th><th>Puesto</th><th>Reporta a</th></tr></thead>
          <tbody>
            {visibles.map((p) => (
              <tr key={p.id} style={cambios[p.id] ? { background: "#fffdf3" } : undefined}>
                <td><input type="checkbox" aria-label={`Marcar a ${p.nombre} ${p.apellido}`} checked={marcados.includes(p.id)} onChange={(e) => setMarcados(e.target.checked ? [...marcados, p.id] : marcados.filter((x) => x !== p.id))} /></td>
                <td style={{ whiteSpace: "nowrap" }}><strong>{p.apellido}</strong>, {p.nombre}</td>
                <td>{select(p, "centroCostoId", sectores, "— sin sector —")}</td>
                <td>{select(p, "puestoId", puestos, "— sin puesto —")}</td>
                <td>{select(p, "jefeId", deJefes, "— nadie —")}</td>
              </tr>
            ))}
            {visibles.length === 0 && <tr><td colSpan={5} style={{ color: "#6b727b" }}>Nadie en esta lista.</td></tr>}
          </tbody>
        </table>
      </div>
      <div style={{ position: "sticky", bottom: 0, background: "#eef1f4", padding: "0.7rem 0", display: "flex", gap: "0.6rem", alignItems: "center" }}>
        <button onClick={guardar} disabled={!pendientes || guardando}>{guardando ? "Guardando…" : pendientes ? `Guardar (${pendientes} ${pendientes === 1 ? "persona" : "personas"})` : "Sin cambios"}</button>
        {pendientes > 0 && <button onClick={() => setCambios({})} style={btnSec} disabled={guardando}>Descartar</button>}
        <span style={{ color: "#6b727b", fontSize: "0.88rem" }}>¿Son muchos? También podés <a href="/legajos/importar">cargarlo desde un Excel</a>. Los puestos nuevos se crean en <a href="/puestos">Puestos</a>.</span>
      </div>
    </div>
  );
}
