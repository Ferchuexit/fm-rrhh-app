"use client";
import { useState } from "react";

// El tilde de una tarea de ingreso que marca el empleado o el jefe.
export default function TildarTarea({ id, hecha, titulo }: { id: string; hecha: boolean; titulo: string }) {
  const [marcada, setMarcada] = useState(hecha);
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function cambiar() {
    if (enviando) return;
    setEnviando(true);
    setError("");
    try {
      const res = await fetch(`/api/portal/ingreso/tareas/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ hecha: !marcada }) });
      if (res.status === 401) { window.location.href = "/portal/login"; return; }
      if (!res.ok) { setError((await res.json().catch(() => ({}))).error || "No se pudo guardar."); return; }
      setMarcada(!marcada);
      window.location.reload(); // el avance y el estado del ingreso se recalculan
    } catch {
      setError("No hay conexión. Probá de nuevo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <button className={`p-btn chico ${marcada ? "sec" : ""}`} onClick={cambiar} disabled={enviando} aria-label={`${marcada ? "Desmarcar" : "Marcar como hecha"}: ${titulo}`}>
        {enviando ? "Guardando…" : marcada ? "Desmarcar" : "Ya lo hice"}
      </button>
      {error && <div className="p-aviso error" role="alert" style={{ marginTop: "0.4rem" }}>{error}</div>}
    </>
  );
}
