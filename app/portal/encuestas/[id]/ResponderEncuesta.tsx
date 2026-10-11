"use client";
// El formulario de una encuesta en el celular. Botones grandes; las de
// texto libre son opcionales.
import { useState } from "react";
import { ESCALA_ACUERDO, type Pregunta } from "@/lib/encuestas-reglas";

const CARAS = ["😠", "🙁", "😐", "🙂", "😀"];

export default function ResponderEncuesta({ id, preguntas }: { id: string; preguntas: Pregunta[] }) {
  const [r, setR] = useState<Record<string, number | string>>({});
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  const obligatorias = preguntas.filter((p) => p.tipo !== "texto").length;
  const respondidas = preguntas.filter((p, i) => p.tipo !== "texto" && r[i] !== undefined).length;

  async function enviar() {
    if (enviando) return;
    setEnviando(true);
    setError("");
    try {
      const res = await fetch(`/api/portal/encuestas/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ respuestas: r }) });
      if (res.status === 401) { window.location.href = "/portal/login"; return; }
      if (!res.ok) { setError((await res.json().catch(() => ({}))).error || "No se pudo enviar."); setEnviando(false); return; }
      window.location.href = "/portal/encuestas?gracias=1";
    } catch {
      setError("No hay conexión. Probá de nuevo.");
      setEnviando(false);
    }
  }
  const boton = (elegido: boolean): React.CSSProperties => ({ flex: 1, minHeight: 46, fontSize: "1.05rem", fontWeight: 700, borderRadius: 8, cursor: "pointer", border: elegido ? "2px solid #163A5C" : "1px solid #b9c4cd", background: elegido ? "#e8f0f6" : "#fff", color: "#12202e", padding: "0.3rem" });

  return (
    <>
      {preguntas.map((p, i) => (
        <div key={i} className="p-card">
          <div className="p-card-titulo" style={{ fontWeight: 600 }}>{p.texto}</div>
          {p.tipo === "escala" && (
            <>
              <div style={{ display: "flex", gap: "0.3rem", marginTop: "0.6rem" }} role="radiogroup" aria-label={p.texto}>
                {CARAS.map((cara, k) => <button key={k} type="button" role="radio" aria-checked={r[i] === k + 1} aria-label={ESCALA_ACUERDO[k]} onClick={() => setR({ ...r, [i]: k + 1 })} style={{ ...boton(r[i] === k + 1), fontSize: "1.5rem" }}>{cara}</button>)}
              </div>
              <div className="p-card-dato" style={{ display: "flex", justifyContent: "space-between", color: "#6b727b" }}>{r[i] ? <span style={{ color: "#163A5C", fontWeight: 700 }}>{ESCALA_ACUERDO[Number(r[i]) - 1]}</span> : <><span>Muy en desacuerdo</span><span>Muy de acuerdo</span></>}</div>
            </>
          )}
          {p.tipo === "enps" && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(11, 1fr)", gap: "0.15rem", marginTop: "0.6rem" }} role="radiogroup" aria-label={p.texto}>
                {Array.from({ length: 11 }, (_, n) => <button key={n} type="button" role="radio" aria-checked={r[i] === n} onClick={() => setR({ ...r, [i]: n })} style={{ ...boton(r[i] === n), minHeight: 42, fontSize: "0.9rem", padding: 0 }}>{n}</button>)}
              </div>
              <div className="p-card-dato" style={{ display: "flex", justifyContent: "space-between", color: "#6b727b" }}><span>Para nada</span><span>Seguro que sí</span></div>
            </>
          )}
          {p.tipo === "opcion" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", marginTop: "0.6rem" }} role="radiogroup" aria-label={p.texto}>
              {p.opciones!.map((o, k) => <button key={k} type="button" role="radio" aria-checked={r[i] === k} onClick={() => setR({ ...r, [i]: k })} style={{ ...boton(r[i] === k), textAlign: "left", padding: "0.5rem 0.8rem", fontSize: "0.95rem", fontWeight: r[i] === k ? 700 : 400 }}>{o}</button>)}
            </div>
          )}
          {p.tipo === "texto" && <label className="p-campo" style={{ marginBottom: 0 }}><textarea rows={3} maxLength={1000} value={String(r[i] ?? "")} onChange={(e) => setR({ ...r, [i]: e.target.value })} placeholder="Opcional. No pongas tu nombre ni datos que te identifiquen." aria-label={p.texto} /></label>}
        </div>
      ))}
      {error && <div className="p-aviso error" role="alert">{error}</div>}
      <button className="p-btn" onClick={enviar} disabled={enviando}>{enviando ? "Enviando…" : respondidas < obligatorias ? `Enviar (respondiste ${respondidas} de ${obligatorias})` : "Enviar mis respuestas"}</button>
      <p className="p-pie">Una vez enviada no se puede cambiar, justamente porque no queda registro de cuál es la tuya.</p>
    </>
  );
}
