"use client";
// El empleado deja constancia de que leyó su evaluación: conforme, o en
// disconformidad contando por qué.
import { useState } from "react";

export default function FirmarEvaluacion({ id }: { id: string }) {
  const [disconforme, setDisconforme] = useState(false);
  const [comentario, setComentario] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function firmar(firma: "conforme" | "disconforme") {
    if (enviando) return;
    setEnviando(true);
    setError("");
    try {
      const res = await fetch(`/api/portal/evaluaciones/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accion: "firmar", firma, comentario }) });
      if (res.status === 401) { window.location.href = "/portal/login"; return; }
      if (!res.ok && res.status !== 409) { setError((await res.json().catch(() => ({}))).error || "No se pudo firmar."); setEnviando(false); return; }
      window.location.reload();
    } catch {
      setError("No hay conexión. Probá de nuevo.");
      setEnviando(false);
    }
  }

  return (
    <div className="p-card">
      <div className="p-card-titulo">Firmar</div>
      <div className="p-card-dato" style={{ marginBottom: "0.6rem" }}>Firmar deja constancia de que la leíste. Si no estás de acuerdo, firmá en disconformidad y contá por qué: lo lee RR.HH.</div>
      <label className="p-campo">{disconforme ? "¿Con qué no estás de acuerdo?" : "Comentario (opcional)"}<textarea rows={3} maxLength={1500} value={comentario} onChange={(e) => setComentario(e.target.value)} /></label>
      {error && <div className="p-aviso error" role="alert">{error}</div>}
      {!disconforme ? (
        <>
          <button className="p-btn verde" onClick={() => firmar("conforme")} disabled={enviando}>Firmo conforme</button>
          <button className="p-btn rojo" onClick={() => setDisconforme(true)} disabled={enviando}>No estoy de acuerdo</button>
        </>
      ) : (
        <>
          <button className="p-btn rojo" onClick={() => firmar("disconforme")} disabled={enviando}>Firmo en disconformidad</button>
          <button className="p-btn sec" onClick={() => setDisconforme(false)} disabled={enviando}>Volver</button>
        </>
      )}
    </div>
  );
}
