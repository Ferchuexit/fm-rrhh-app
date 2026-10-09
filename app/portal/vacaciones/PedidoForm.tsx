"use client";
import { useState } from "react";

const DIA_MS = 24 * 3600 * 1000;

export default function PedidoForm({ hoy, saldos }: { hoy: string; saldos: Record<number, number> }) {
  const [tipo, setTipo] = useState<"vacaciones" | "permiso">("vacaciones");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  const dias = desde && hasta && hasta >= desde ? Math.round((Date.parse(hasta) - Date.parse(desde)) / DIA_MS) + 1 : 0;
  const disponibles = desde ? saldos[Number(desde.slice(0, 4))] : undefined;

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (enviando) return;
    setError("");
    setEnviando(true);
    try {
      const res = await fetch("/api/portal/solicitudes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo, fechaDesde: desde, fechaHasta: hasta, motivo }),
      });
      const data = await res.json().catch(() => ({ error: "No hubo respuesta del servidor. Probá de nuevo." }));
      if (res.status === 401) {
        window.location.href = "/portal/login";
        return;
      }
      if (!res.ok) {
        setError(data.error);
        setEnviando(false);
        return;
      }
      window.location.reload();
    } catch {
      setError("No hay conexión. Tu pedido no se envió: revisá tu señal y probá de nuevo.");
      setEnviando(false);
    }
  }

  return (
    <form className="p-card" onSubmit={enviar}>
      {error && <div className="p-aviso error" role="alert">{error}</div>}

      <label className="p-campo">
        ¿Qué pedís?
        <select value={tipo} onChange={(e) => setTipo(e.target.value as any)}>
          <option value="vacaciones">Vacaciones</option>
          <option value="permiso">Permiso (trámite, examen, asunto personal…)</option>
        </select>
      </label>

      <div className="p-fila2">
        <label className="p-campo">
          Desde
          <input type="date" value={desde} min={hoy} required
            onChange={(e) => { setDesde(e.target.value); if (!hasta || hasta < e.target.value) setHasta(e.target.value); }} />
        </label>
        <label className="p-campo">
          Hasta (inclusive)
          <input type="date" value={hasta} min={desde || hoy} required onChange={(e) => setHasta(e.target.value)} />
        </label>
      </div>

      {dias > 0 && (
        <p className="p-sub" style={{ marginTop: "-0.3rem" }}>
          Son <strong>{dias} {dias === 1 ? "día" : "días"}</strong> corridos.
          {tipo === "vacaciones" && disponibles !== undefined ? ` Te quedan ${disponibles} disponibles para ${desde.slice(0, 4)}.` : ""}
        </p>
      )}

      <label className="p-campo">
        {tipo === "permiso" ? "¿Para qué es el permiso?" : "Comentario (opcional)"}
        <textarea rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={500}
          required={tipo === "permiso"} minLength={tipo === "permiso" ? 5 : undefined}
          placeholder={tipo === "permiso" ? "Por ejemplo: trámite en ANSES por la mañana" : ""} />
      </label>

      <button className="p-btn" type="submit" disabled={enviando}>{enviando ? "Enviando…" : "Enviar pedido"}</button>
      <p className="p-pie" style={{ marginTop: 0 }}>El pedido queda esperando la respuesta de RR.HH. No es una aprobación.</p>
    </form>
  );
}
