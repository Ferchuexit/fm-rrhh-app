"use client";
import { useState } from "react";

// La firma en dos pasos: primero se elige (conforme / disconforme) y
// después se confirma escribiendo el PIN. Es deliberado que no sea un solo
// toque — una firma no tiene que poder salir por error con el pulgar.
export default function FirmaRecibo({ liquidacionId }: { liquidacionId: string }) {
  const [tipo, setTipo] = useState<"conforme" | "disconforme" | null>(null);
  const [observacion, setObservacion] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function firmar(e: React.FormEvent) {
    e.preventDefault();
    if (enviando || !tipo) return;
    setError("");
    setEnviando(true);
    try {
      const res = await fetch(`/api/portal/recibos/${liquidacionId}/firmar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo, observacion, pin }),
      });
      const data = await res.json().catch(() => ({ error: "No hubo respuesta del servidor. Probá de nuevo." }));
      if (res.status === 401 && !data.error?.includes("PIN")) {
        window.location.href = "/portal/login";
        return;
      }
      if (!res.ok && res.status !== 409) {
        setError(data.error);
        setPin("");
        setEnviando(false);
        return;
      }
      window.location.reload(); // 409 = ya estaba firmado: recargar muestra la firma que quedó
    } catch {
      setError("No hay conexión. Tu firma no se envió: revisá tu señal y probá de nuevo.");
      setEnviando(false);
    }
  }

  if (!tipo) {
    return (
      <>
        <p className="p-sub">Revisá el recibo y elegí cómo lo firmás. Una vez firmado no se puede cambiar.</p>
        <button className="p-btn verde" onClick={() => setTipo("conforme")}>Firmar en conformidad</button>
        <button className="p-btn rojo" onClick={() => setTipo("disconforme")}>Firmar en disconformidad</button>
        <p className="p-pie">
          Firmar en disconformidad deja constancia de que recibiste el recibo pero no estás de acuerdo con algo. RR.HH. va a ver tu motivo.
        </p>
      </>
    );
  }

  return (
    <form className="p-card" onSubmit={firmar}>
      <strong style={{ color: "var(--azul-oscuro)" }}>
        {tipo === "conforme" ? "Vas a firmar en conformidad" : "Vas a firmar en disconformidad"}
      </strong>

      {error && <div className="p-aviso error" role="alert" style={{ marginTop: "0.75rem" }}>{error}</div>}

      <label className="p-campo" style={{ marginTop: "0.9rem" }}>
        {tipo === "disconforme" ? "¿Con qué no estás de acuerdo?" : "Observación (opcional)"}
        <textarea
          rows={3}
          value={observacion}
          onChange={(e) => setObservacion(e.target.value)}
          maxLength={1000}
          required={tipo === "disconforme"}
          minLength={tipo === "disconforme" ? 10 : undefined}
          placeholder={tipo === "disconforme" ? "Por ejemplo: faltan las horas extra del sábado 12" : ""}
        />
      </label>
      <label className="p-campo">
        Tu PIN, para confirmar
        <input className="p-pin" type="password" inputMode="numeric" autoComplete="current-password" maxLength={6}
          value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))} required />
      </label>

      <button className={`p-btn ${tipo === "conforme" ? "verde" : ""}`} type="submit" disabled={enviando}>
        {enviando ? "Firmando…" : "Confirmar firma"}
      </button>
      <button className="p-btn sec" type="button" disabled={enviando} onClick={() => { setTipo(null); setError(""); setPin(""); }}>
        Volver atrás
      </button>
    </form>
  );
}
