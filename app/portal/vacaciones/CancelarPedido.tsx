"use client";
import { useState } from "react";

export default function CancelarPedido({ id }: { id: string }) {
  const [confirmando, setConfirmando] = useState(false);
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function cancelar() {
    setEnviando(true);
    setError("");
    try {
      const res = await fetch(`/api/portal/solicitudes/${id}/cancelar`, { method: "POST" });
      if (!res.ok && res.status !== 409) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "No se pudo cancelar.");
        setEnviando(false);
        return;
      }
      window.location.reload(); // 409 = ya la respondieron: recargar muestra la respuesta
    } catch {
      setError("No hay conexión. Probá de nuevo.");
      setEnviando(false);
    }
  }

  if (!confirmando) return <button className="p-btn sec chico" onClick={() => setConfirmando(true)}>Cancelar pedido</button>;
  return (
    <div>
      {error && <div className="p-aviso error" role="alert" style={{ marginTop: "0.5rem" }}>{error}</div>}
      <button className="p-btn rojo chico" onClick={cancelar} disabled={enviando}>{enviando ? "Cancelando…" : "Sí, cancelar"}</button>{" "}
      <button className="p-btn sec chico" onClick={() => setConfirmando(false)} disabled={enviando}>No</button>
    </div>
  );
}
