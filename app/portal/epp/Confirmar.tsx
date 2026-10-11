"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Confirmar({ ids }: { ids: string[] }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  async function confirmar() {
    if (enviando) return;
    setEnviando(true);
    setError("");
    try {
      const res = await fetch("/api/portal/epp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids }) });
      if (res.status === 401) { window.location.href = "/portal/login"; return; }
      if (!res.ok && res.status !== 409) setError((await res.json().catch(() => ({}))).error || "No se pudo confirmar.");
      else router.refresh();
    } catch { setError("No hay conexión. Probá de nuevo."); }
    setEnviando(false);
  }
  return (
    <>
      {error && <div className="p-aviso error" role="alert">{error}</div>}
      <button className="p-btn verde" style={{ marginTop: "0.7rem" }} onClick={confirmar} disabled={enviando}>{enviando ? "Confirmando…" : "Confirmo que lo recibí"}</button>
    </>
  );
}
