"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Mia = { va: boolean; acompanantes: number } | null;

export default function Responder({ id, mia, maxAcompanantes, cerrado }: { id: string; mia: Mia; maxAcompanantes: number; cerrado: string | null }) {
  const router = useRouter();
  const [resp, setResp] = useState<Mia>(mia);
  const [cambiando, setCambiando] = useState(false);
  const [acompanantes, setAcompanantes] = useState(mia?.acompanantes ?? 0);
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function enviar(va: boolean) {
    if (enviando) return;
    setEnviando(true);
    setError("");
    try {
      const res = await fetch(`/api/portal/eventos/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ va, acompanantes: va ? acompanantes : 0 }) });
      if (res.status === 401) { window.location.href = "/portal/login"; return; }
      if (!res.ok) setError((await res.json().catch(() => ({}))).error || "No se pudo guardar.");
      else { setResp({ va, acompanantes: va ? acompanantes : 0 }); setCambiando(false); router.refresh(); }
    } catch {
      setError("No hay conexión. Probá de nuevo.");
    }
    setEnviando(false);
  }

  const estado = resp && <span className={`p-chip ${resp.va ? "conforme" : "pendiente"}`}>{resp.va ? `Vas${resp.acompanantes > 0 ? ` con ${resp.acompanantes} ${resp.acompanantes === 1 ? "acompañante" : "acompañantes"}` : ""}` : "Avisaste que no vas"}</span>;
  if (cerrado) return <div className="p-card-dato" style={{ marginTop: "0.6rem" }}>{estado ?? <span style={{ color: "#6b727b" }}>{cerrado}</span>}</div>;
  if (resp && !cambiando) return <div className="p-card-dato" style={{ marginTop: "0.6rem" }}>{estado} <button className="p-btn chico sec" onClick={() => setCambiando(true)}>Cambiar</button></div>;
  return (
    <div style={{ marginTop: "0.6rem" }}>
      {maxAcompanantes > 0 && (
        <label className="p-campo">¿Llevás acompañantes?
          <select value={acompanantes} onChange={(e) => setAcompanantes(Number(e.target.value))}>
            {Array.from({ length: maxAcompanantes + 1 }, (_, i) => <option key={i} value={i}>{i === 0 ? "Voy solo/a" : i === 1 ? "1 acompañante" : `${i} acompañantes`}</option>)}
          </select>
        </label>
      )}
      {error && <div className="p-aviso error" role="alert">{error}</div>}
      <button className="p-btn" onClick={() => enviar(true)} disabled={enviando}>Voy</button>
      <button className="p-btn sec" onClick={() => enviar(false)} disabled={enviando}>No puedo ir</button>
    </div>
  );
}
