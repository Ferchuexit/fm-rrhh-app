"use client";
// El jefe le carga un objetivo a uno o varios de su equipo.
import { useState } from "react";

export default function NuevoObjetivo({ equipo, hoy }: { equipo: { id: string; nombre: string }[]; hoy: string }) {
  const [abierto, setAbierto] = useState(false);
  const [f, setF] = useState({ titulo: "", descripcion: "", fechaLimite: "", legajoIds: [] as string[] });
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function guardar() {
    if (enviando) return;
    setEnviando(true);
    setError("");
    try {
      const res = await fetch("/api/portal/objetivos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
      if (res.status === 401) { window.location.href = "/portal/login"; return; }
      if (!res.ok) { setError((await res.json().catch(() => ({}))).error || "No se pudo guardar."); setEnviando(false); return; }
      window.location.reload();
    } catch {
      setError("No hay conexión. Probá de nuevo.");
      setEnviando(false);
    }
  }
  const alternar = (id: string) => setF({ ...f, legajoIds: f.legajoIds.includes(id) ? f.legajoIds.filter((x) => x !== id) : [...f.legajoIds, id] });

  if (!abierto) return <button className="p-btn sec" onClick={() => setAbierto(true)}>+ Nuevo objetivo para mi equipo</button>;
  return (
    <div className="p-card">
      <label className="p-campo">Objetivo<input value={f.titulo} maxLength={120} onChange={(e) => setF({ ...f, titulo: e.target.value })} placeholder="Qué se espera, en una línea" /></label>
      <label className="p-campo">Para el<input type="date" min={hoy} value={f.fechaLimite} onChange={(e) => setF({ ...f, fechaLimite: e.target.value })} /></label>
      <label className="p-campo">Cómo se mide (opcional)<textarea rows={2} maxLength={1000} value={f.descripcion} onChange={(e) => setF({ ...f, descripcion: e.target.value })} /></label>
      <div style={{ fontWeight: 700, margin: "0.4rem 0" }}>¿Para quién?</div>
      {equipo.map((m) => (
        <label key={m.id} style={{ display: "flex", alignItems: "center", gap: "0.6rem", padding: "0.5rem 0", borderTop: "1px solid var(--gris-claro)" }}>
          <input type="checkbox" checked={f.legajoIds.includes(m.id)} onChange={() => alternar(m.id)} style={{ width: 20, height: 20 }} />{m.nombre}
        </label>
      ))}
      {error && <div className="p-aviso error" role="alert" style={{ marginTop: "0.6rem" }}>{error}</div>}
      <button className="p-btn" style={{ marginTop: "0.75rem" }} disabled={enviando} onClick={guardar}>Guardar y avisar</button>
      <button className="p-btn sec" disabled={enviando} onClick={() => setAbierto(false)}>Cancelar</button>
    </div>
  );
}
