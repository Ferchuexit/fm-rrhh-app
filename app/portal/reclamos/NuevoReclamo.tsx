"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Motivo = { id: string; nombre: string; unidad: "horas" | "dias" | "monto" | "texto" };
const ETIQUETA: Record<string, string> = { horas: "¿Cuántas horas?", dias: "¿Cuántos días?", monto: "¿Qué importe? ($)" };

export default function NuevoReclamo({ recibos, motivos, reciboInicial, abierto: abiertoInicial }: { recibos: { id: string; nombre: string }[]; motivos: Motivo[]; reciboInicial: string; abierto: boolean }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(abiertoInicial);
  const [recibo, setRecibo] = useState(reciboInicial || recibos[0]?.id || "");
  const [elegidos, setElegidos] = useState<Record<string, { cantidad: string; detalle: string }>>({});
  const [comentario, setComentario] = useState("");
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function enviar(ev: React.FormEvent) {
    ev.preventDefault();
    if (enviando) return;
    setEnviando(true); setError("");
    try {
      const items = motivos.filter((m) => elegidos[m.id]).map((m) => ({ motivoId: m.id, cantidad: elegidos[m.id].cantidad, detalle: elegidos[m.id].detalle }));
      const res = await fetch("/api/portal/reclamos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ liquidacionId: recibo || null, items, comentario }) });
      if (res.status === 401) { window.location.href = "/portal/login"; return; }
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setError(d.error || "No se pudo enviar."); setEnviando(false); return; }
      setOk("Listo, tu reclamo le llegó a RR.HH. Te avisamos cuando te respondan.");
      setAbierto(false); setElegidos({}); setComentario("");
      router.refresh();
    } catch { setError("No hay conexión. Probá de nuevo."); }
    setEnviando(false);
  }

  if (!abierto) return (<>{ok && <div className="p-aviso ok" role="status">{ok}</div>}<button className="p-btn" onClick={() => { setAbierto(true); setOk(""); }}>Hacer un reclamo</button></>);
  return (
    <form className="p-card" onSubmit={enviar}>
      <div className="p-card-titulo">Nuevo reclamo</div>
      <label className="p-campo">¿De qué recibo?
        <select value={recibo} onChange={(e) => setRecibo(e.target.value)}>
          {recibos.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
          <option value="">No es de un recibo en particular</option>
        </select>
      </label>
      <div className="p-campo" style={{ marginBottom: "0.4rem" }}>¿Qué reclamás? <span className="p-ayuda">Tocá uno o varios.</span></div>
      {motivos.map((m) => {
        const v = elegidos[m.id];
        return (
          <div key={m.id} style={{ borderBottom: "1px solid var(--gris-claro)", padding: "0.55rem 0" }}>
            <label style={{ display: "flex", gap: "0.6rem", alignItems: "center", fontSize: "1rem" }}>
              <input type="checkbox" checked={!!v} style={{ width: 22, height: 22 }} onChange={(e) => setElegidos((x) => { const n = { ...x }; if (e.target.checked) n[m.id] = { cantidad: "", detalle: "" }; else delete n[m.id]; return n; })} />
              {m.nombre}
            </label>
            {v && (
              <div style={{ marginTop: "0.5rem", paddingLeft: "1.8rem" }}>
                {m.unidad !== "texto" && <label className="p-campo">{ETIQUETA[m.unidad]}<input inputMode="decimal" required value={v.cantidad} onChange={(e) => setElegidos((x) => ({ ...x, [m.id]: { ...v, cantidad: e.target.value } }))} /></label>}
                <label className="p-campo">{m.unidad === "texto" ? "Contá qué pasó" : "Detalle (opcional): qué días, por qué"}<input required={m.unidad === "texto"} maxLength={300} value={v.detalle} onChange={(e) => setElegidos((x) => ({ ...x, [m.id]: { ...v, detalle: e.target.value } }))} /></label>
              </div>
            )}
          </div>
        );
      })}
      <label className="p-campo" style={{ marginTop: "0.8rem" }}>Comentario para RR.HH. (opcional)<textarea rows={3} maxLength={1000} value={comentario} onChange={(e) => setComentario(e.target.value)} /></label>
      {error && <div className="p-aviso error" role="alert">{error}</div>}
      <button className="p-btn" disabled={enviando || Object.keys(elegidos).length === 0}>{enviando ? "Enviando…" : "Enviar reclamo"}</button>
      <button type="button" className="p-btn sec" onClick={() => setAbierto(false)}>Cancelar</button>
    </form>
  );
}
