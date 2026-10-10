"use client";
import { useState } from "react";

export default function ConfirmarCapacitacion({ id }: { id: string }) {
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function confirmar() {
    if (enviando) return;
    setEnviando(true);
    setError("");
    try {
      const res = await fetch(`/api/portal/capacitaciones/${id}`, { method: "POST" });
      if (res.status === 401) { window.location.href = "/portal/login"; return; }
      if (!res.ok && res.status !== 409) { setError((await res.json().catch(() => ({}))).error || "No se pudo confirmar."); setEnviando(false); return; }
      window.location.reload(); // 409 = ya estaba confirmada: recargar lo muestra
    } catch {
      setError("No hay conexión. Probá de nuevo.");
      setEnviando(false);
    }
  }
  return (
    <div style={{ marginTop: "0.5rem" }}>
      {error && <div className="p-aviso error" role="alert">{error}</div>}
      <button className="p-btn" onClick={confirmar} disabled={enviando}>{enviando ? "Confirmando…" : "Confirmo que recibí esta capacitación"}</button>
    </div>
  );
}
