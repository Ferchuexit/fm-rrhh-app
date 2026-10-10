"use client";
import { useState } from "react";

export default function FirmarConstancia({ clave, hash }: { clave: string; hash: string }) {
  const [abierto, setAbierto] = useState(false);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function firmar(e: React.FormEvent) {
    e.preventDefault();
    if (enviando) return;
    setError("");
    setEnviando(true);
    try {
      const res = await fetch("/api/portal/legajo/firmar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clave, hash, pin }) });
      const data = await res.json().catch(() => ({ error: "No hubo respuesta del servidor. Probá de nuevo." }));
      if (res.status === 401 && !data.error?.includes("PIN")) { window.location.href = "/portal/login"; return; }
      if (!res.ok) { setError(data.error); setPin(""); setEnviando(false); return; }
      window.location.reload();
    } catch {
      setError("No hay conexión. Tu firma no se envió: revisá tu señal y probá de nuevo.");
      setEnviando(false);
    }
  }

  if (!abierto) return <button className="p-btn verde" style={{ marginTop: "0.75rem", marginBottom: 0 }} onClick={() => setAbierto(true)}>Firmar</button>;
  return (
    <form onSubmit={firmar} style={{ marginTop: "0.75rem" }}>
      {error && <div className="p-aviso error" role="alert">{error}</div>}
      <label className="p-campo">
        Tu PIN, para confirmar la firma
        <input className="p-pin" type="password" inputMode="numeric" autoComplete="current-password" maxLength={6} autoFocus
          value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))} required />
      </label>
      <button className="p-btn verde" type="submit" disabled={enviando}>{enviando ? "Firmando…" : "Confirmar firma"}</button>
      <button className="p-btn sec" type="button" disabled={enviando} style={{ marginBottom: 0 }} onClick={() => { setAbierto(false); setError(""); setPin(""); }}>Volver atrás</button>
    </form>
  );
}
