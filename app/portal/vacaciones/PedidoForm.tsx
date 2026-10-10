"use client";
import { useState } from "react";

const DIA_MS = 24 * 3600 * 1000;

// Tres usos del mismo formulario:
//   - empleado sin jefe: pide vacaciones o permiso para sí mismo
//   - empleado con jefe (`jefe`): solo permisos; las vacaciones las pide el jefe
//   - jefe (`equipo`): pide vacaciones para alguien de su equipo
type Miembro = { id: string; nombre: string; saldos: Record<number, number> };

export default function PedidoForm({ hoy, saldos, jefe, equipo }: { hoy: string; saldos?: Record<number, number>; jefe?: string; equipo?: Miembro[] }) {
  const [tipo, setTipo] = useState<"vacaciones" | "permiso">(jefe ? "permiso" : "vacaciones");
  const [para, setPara] = useState(equipo?.[0]?.id ?? "");
  const miembro = equipo?.find((m) => m.id === para);
  const saldosVigentes = equipo ? miembro?.saldos ?? {} : saldos ?? {};
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  const dias = desde && hasta && hasta >= desde ? Math.round((Date.parse(hasta) - Date.parse(desde)) / DIA_MS) + 1 : 0;
  const disponibles = desde ? saldosVigentes[Number(desde.slice(0, 4))] : undefined;

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (enviando) return;
    setError("");
    setEnviando(true);
    try {
      const res = await fetch("/api/portal/solicitudes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo, fechaDesde: desde, fechaHasta: hasta, motivo, paraLegajoId: equipo ? para : undefined }),
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

{equipo ? (
        <label className="p-campo">
          ¿Para quién?
          <select value={para} onChange={(e) => setPara(e.target.value)}>
            {equipo.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
          </select>
        </label>
      ) : jefe ? (
        <p className="p-sub" style={{ marginTop: 0 }}>
          Desde acá pedís <strong>permisos</strong>. Las vacaciones las pide tu jefe, <strong>{jefe}</strong>: coordiná las fechas con él.
        </p>
      ) : (
        <label className="p-campo">
          ¿Qué pedís?
          <select value={tipo} onChange={(e) => setTipo(e.target.value as any)}>
            <option value="vacaciones">Vacaciones</option>
            <option value="permiso">Permiso (trámite, examen, asunto personal…)</option>
          </select>
        </label>
      )}

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
          {tipo === "vacaciones" && disponibles !== undefined ? ` ${equipo ? "Le" : "Te"} quedan ${disponibles} disponibles para ${desde.slice(0, 4)}.` : ""}
        </p>
      )}

      <label className="p-campo">
        {tipo === "permiso" ? "¿Para qué es el permiso?" : "Comentario (opcional)"}
        <textarea rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={500}
          required={tipo === "permiso"} minLength={tipo === "permiso" ? 5 : undefined}
          placeholder={tipo === "permiso" ? "Por ejemplo: trámite en ANSES por la mañana" : ""} />
      </label>

      <button className="p-btn" type="submit" disabled={enviando}>{enviando ? "Enviando…" : "Enviar pedido"}</button>
      <p className="p-pie" style={{ marginTop: 0 }}>El pedido queda esperando la respuesta de RR.HH. No es una aprobación{equipo ? ": no le confirmes las fechas a la persona hasta que RR.HH. responda" : ""}.</p>
    </form>
  );
}
