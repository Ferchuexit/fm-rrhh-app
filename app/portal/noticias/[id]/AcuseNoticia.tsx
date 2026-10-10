"use client";
import { useState } from "react";

export default function AcuseNoticia({ id }: { id: string }) {
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function confirmar() {
    setEnviando(true);
    setError("");
    try {
      const res = await fetch(`/api/portal/noticias/${id}/acuse`, { method: "POST" });
      if (res.status === 401) { window.location.href = "/portal/login"; return; }
      if (!res.ok) { const d = await res.json().catch(() => ({})); setError(d.error ?? "No se pudo registrar."); setEnviando(false); return; }
      window.location.reload();
    } catch {
      setError("No hay conexión. No se registró: probá de nuevo.");
      setEnviando(false);
    }
  }

  return (
    <>
      {error && <div className="p-aviso error" role="alert">{error}</div>}
      <p className="p-sub">RR.HH. pide que confirmes que leíste esta noticia.</p>
      <button className="p-btn verde" onClick={confirmar} disabled={enviando}>{enviando ? "Registrando…" : "Confirmo que la leí"}</button>
    </>
  );
}
