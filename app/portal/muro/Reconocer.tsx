"use client";
// Reconocer a un compañero: a quién, por qué valor y qué hizo.
import { useState } from "react";

export default function Reconocer({ valores, companieros, quedan }: { valores: { nombre: string; emoji: string }[]; companieros: { id: string; nombre: string; sector: string | null }[]; quedan: number }) {
  const [abierto, setAbierto] = useState(false);
  const [f, setF] = useState({ paraId: "", valor: "", mensaje: "" });
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function enviar() {
    if (enviando) return;
    setEnviando(true);
    setError("");
    try {
      const res = await fetch("/api/portal/reconocimientos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
      if (res.status === 401) { window.location.href = "/portal/login"; return; }
      if (!res.ok) { setError((await res.json().catch(() => ({}))).error || "No se pudo enviar."); setEnviando(false); return; }
      window.location.reload();
    } catch {
      setError("No hay conexión. Probá de nuevo.");
      setEnviando(false);
    }
  }

  if (!abierto) return <button className="p-btn" onClick={() => setAbierto(true)} disabled={quedan === 0}>{quedan === 0 ? "Ya diste todos tus reconocimientos del mes" : "👏 Reconocer a un compañero"}</button>;
  return (
    <div className="p-card">
      <label className="p-campo">¿A quién?
        <select value={f.paraId} onChange={(e) => setF({ ...f, paraId: e.target.value })} style={{ display: "block", width: "100%", marginTop: "0.3rem", padding: "0.8rem", fontSize: "1rem", border: "1px solid #b9c4cd", borderRadius: 8, background: "#fff" }}>
          <option value="">Elegir…</option>
          {companieros.map((c) => <option key={c.id} value={c.id}>{c.nombre}{c.sector ? ` · ${c.sector}` : ""}</option>)}
        </select>
      </label>
      <div style={{ fontWeight: 700, fontSize: "0.9rem", marginBottom: "0.3rem" }}>¿Por qué?</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginBottom: "0.8rem" }} role="radiogroup" aria-label="Valor">
        {valores.map((v) => <button key={v.nombre} type="button" role="radio" aria-checked={f.valor === v.nombre} onClick={() => setF({ ...f, valor: v.nombre })} style={{ padding: "0.5rem 0.75rem", borderRadius: 999, fontSize: "0.9rem", cursor: "pointer", border: f.valor === v.nombre ? "2px solid #163A5C" : "1px solid #b9c4cd", background: f.valor === v.nombre ? "#e8f0f6" : "#fff", color: "#12202e", fontWeight: f.valor === v.nombre ? 700 : 400 }}>{v.emoji} {v.nombre}</button>)}
      </div>
      <label className="p-campo">¿Qué hizo?<textarea rows={3} maxLength={500} value={f.mensaje} onChange={(e) => setF({ ...f, mensaje: e.target.value })} placeholder="Contalo con el ejemplo: «Se quedó a ayudarme a terminar el pedido aunque ya había cumplido su turno»" /></label>
      {error && <div className="p-aviso error" role="alert">{error}</div>}
      <button className="p-btn" onClick={enviar} disabled={enviando}>{enviando ? "Publicando…" : "Publicar en el muro"}</button>
      <button className="p-btn sec" onClick={() => setAbierto(false)} disabled={enviando}>Cancelar</button>
      <p className="p-pie" style={{ margin: 0 }}>Lo ve toda la empresa, con tu nombre. Te {quedan === 1 ? "queda 1 reconocimiento" : `quedan ${quedan} reconocimientos`} este mes.</p>
    </div>
  );
}
