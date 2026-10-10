"use client";
// Un objetivo en el portal. El dueño informa cómo viene; su jefe, además,
// lo puede cerrar (cumplido / no cumplido).
import { useState } from "react";

type O = { id: string; titulo: string; descripcion: string | null; limite: string; vencido: boolean; avance: number; estado: string; nota: string | null; comentarioCierre: string | null };

export default function ObjetivoCard({ o, modo }: { o: O; modo: "mio" | "jefe" }) {
  const [abierto, setAbierto] = useState<"" | "avance" | "cerrar">("");
  const [avance, setAvance] = useState(o.avance);
  const [nota, setNota] = useState("");
  const [cierre, setCierre] = useState<"cumplido" | "no_cumplido">("cumplido");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function enviar(cuerpo: Record<string, unknown>) {
    if (enviando) return;
    setEnviando(true);
    setError("");
    try {
      const res = await fetch(`/api/portal/objetivos/${o.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo) });
      if (res.status === 401) { window.location.href = "/portal/login"; return; }
      if (!res.ok) { setError((await res.json().catch(() => ({}))).error || "No se pudo guardar."); setEnviando(false); return; }
      window.location.reload();
    } catch {
      setError("No hay conexión. Probá de nuevo.");
      setEnviando(false);
    }
  }

  const enCurso = o.estado === "en_curso";
  const color = !enCurso ? (o.estado === "cumplido" ? "#2F6F5E" : "#B23A3A") : o.vencido ? "#B23A3A" : "#163A5C";
  return (
    <div className="p-card">
      <div className="p-card-titulo">{o.titulo}</div>
      <div className="p-card-dato">
        {enCurso ? <span style={o.vencido ? { color: "#8d2a2a", fontWeight: 700 } : undefined}>Para el {o.limite}{o.vencido ? " (vencido)" : ""}</span> : <span className={`p-chip ${o.estado === "cumplido" ? "conforme" : "disconforme"}`}>{o.estado === "cumplido" ? "Cumplido" : "No cumplido"}</span>}
      </div>
      {o.descripcion && <div className="p-card-dato" style={{ whiteSpace: "pre-wrap" }}>{o.descripcion}</div>}
      <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginTop: "0.6rem" }}>
        <div style={{ flex: 1, height: 10, background: "#E6EAEE", borderRadius: 5 }}><div style={{ width: `${o.avance}%`, height: 10, background: color, borderRadius: 5 }} /></div>
        <strong>{o.avance}%</strong>
      </div>
      {o.nota && <div className="p-card-dato">Último avance: «{o.nota}»</div>}
      {o.comentarioCierre && <div className="p-card-dato">Al cerrarlo: «{o.comentarioCierre}»</div>}

      {enCurso && !abierto && (
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button className="p-btn sec chico" onClick={() => setAbierto("avance")}>Informar avance</button>
          {modo === "jefe" && <button className="p-btn sec chico" onClick={() => setAbierto("cerrar")}>Cerrar</button>}
        </div>
      )}
      {abierto === "avance" && (
        <div style={{ marginTop: "0.75rem" }}>
          <label className="p-campo">¿Cuánto va? <strong>{avance}%</strong><input type="range" min={0} max={100} step={5} value={avance} onChange={(e) => setAvance(Number(e.target.value))} style={{ padding: 0 }} /></label>
          <label className="p-campo">Comentario (opcional)<textarea rows={2} maxLength={500} value={nota} onChange={(e) => setNota(e.target.value)} /></label>
          {error && <div className="p-aviso error" role="alert">{error}</div>}
          <button className="p-btn" disabled={enviando} onClick={() => enviar({ accion: "avance", avance, nota })}>Guardar</button>
          <button className="p-btn sec" disabled={enviando} onClick={() => setAbierto("")}>Cancelar</button>
        </div>
      )}
      {abierto === "cerrar" && (
        <div style={{ marginTop: "0.75rem" }}>
          <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.6rem" }}>
            <button type="button" className={`p-btn ${cierre === "cumplido" ? "verde" : "sec"}`} style={{ margin: 0 }} onClick={() => setCierre("cumplido")}>Se cumplió</button>
            <button type="button" className={`p-btn ${cierre === "no_cumplido" ? "" : "sec"}`} style={{ margin: 0 }} onClick={() => setCierre("no_cumplido")}>No se cumplió</button>
          </div>
          <label className="p-campo">{cierre === "no_cumplido" ? "¿Por qué?" : "Comentario (opcional)"}<textarea rows={2} maxLength={500} value={nota} onChange={(e) => setNota(e.target.value)} /></label>
          {error && <div className="p-aviso error" role="alert">{error}</div>}
          <button className="p-btn" disabled={enviando} onClick={() => enviar({ accion: "cerrar", estado: cierre, comentario: nota })}>Cerrar objetivo</button>
          <button className="p-btn sec" disabled={enviando} onClick={() => setAbierto("")}>Cancelar</button>
        </div>
      )}
    </div>
  );
}
