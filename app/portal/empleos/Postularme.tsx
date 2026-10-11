"use client";
import { useState } from "react";
import type { PreguntaPublica } from "@/lib/reclutamiento-filtros";
import CamposFiltro from "../../empleos/CamposFiltro";

export default function Postularme({ id, yaPostulado, preguntas }: { id: string; yaPostulado: boolean; preguntas: PreguntaPublica[] }) {
  const [abierto, setAbierto] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [listo, setListo] = useState(yaPostulado);
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (enviando) return;
    const datos = new FormData(e.currentTarget);
    const respuestas = Object.fromEntries(preguntas.map((_, i) => [i, datos.get(`r${i}`)]));
    setEnviando(true);
    setError("");
    try {
      const res = await fetch(`/api/portal/empleos/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mensaje, respuestas }) });
      if (res.status === 401) { window.location.href = "/portal/login"; return; }
      if (!res.ok && res.status !== 409) { setError((await res.json().catch(() => ({}))).error || "No se pudo enviar."); setEnviando(false); return; }
      setListo(true);
    } catch {
      setError("No hay conexión. Probá de nuevo.");
    }
    setEnviando(false);
  }

  if (listo) return <div className="p-card-dato" style={{ marginTop: "0.6rem" }}><span className="p-chip conforme">Ya te postulaste</span></div>;
  if (!abierto) return <button className="p-btn chico" onClick={() => setAbierto(true)}>Me interesa</button>;
  return (
    <form onSubmit={enviar} style={{ marginTop: "0.75rem" }}>
      <CamposFiltro preguntas={preguntas} clase="p-campo" />
      <label className="p-campo">¿Por qué te interesa? (opcional)<textarea rows={3} maxLength={1500} value={mensaje} onChange={(e) => setMensaje(e.target.value)} /></label>
      {error && <div className="p-aviso error" role="alert">{error}</div>}
      <button className="p-btn" type="submit" disabled={enviando}>{enviando ? "Enviando…" : "Postularme"}</button>
      <button className="p-btn sec" type="button" onClick={() => setAbierto(false)} disabled={enviando}>Cancelar</button>
    </form>
  );
}
