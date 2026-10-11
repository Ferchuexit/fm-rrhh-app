"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { RELACIONES } from "@/lib/referidos-reglas";

export default function Recomendar({ id, quedan }: { id: string; quedan: number }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [listo, setListo] = useState(false);
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (enviando) return;
    setEnviando(true);
    setError("");
    try {
      const res = await fetch(`/api/portal/referidos/${id}`, { method: "POST", body: new FormData(e.currentTarget) });
      if (res.status === 401) { window.location.href = "/portal/login"; return; }
      if (!res.ok) setError((await res.json().catch(() => ({}))).error || "No se pudo enviar.");
      else { setListo(true); setAbierto(false); router.refresh(); }
    } catch {
      setError("No hay conexión. Probá de nuevo.");
    }
    setEnviando(false);
  }

  if (!abierto) return (
    <>
      {listo && <div className="p-aviso ok" style={{ marginTop: "0.6rem" }}>¡Gracias! RR.HH. ya recibió tu recomendación. Abajo vas a ver cómo sigue.</div>}
      {quedan > 0 ? <button className="p-btn chico" onClick={() => { setListo(false); setAbierto(true); }}>{listo ? "Recomendar a otra persona" : "Recomendar a alguien"}</button> : <div className="p-card-dato" style={{ marginTop: "0.6rem", color: "#6b727b" }}>Ya recomendaste al máximo de personas para esta búsqueda.</div>}
    </>
  );
  return (
    <form onSubmit={enviar} style={{ marginTop: "0.75rem" }}>
      <label className="p-campo">Nombre<input name="nombre" required maxLength={60} autoComplete="off" /></label>
      <label className="p-campo">Apellido<input name="apellido" required maxLength={60} autoComplete="off" /></label>
      <label className="p-campo">Teléfono<input name="telefono" type="tel" maxLength={40} autoComplete="off" placeholder="Con característica" /></label>
      <label className="p-campo">Mail (si lo tenés)<input name="email" type="email" maxLength={120} autoComplete="off" /></label>
      <label className="p-campo">¿De dónde la conocés?
        <select name="relacion" required defaultValue=""><option value="" disabled>Elegí…</option>{Object.entries(RELACIONES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
      </label>
      <label className="p-campo">¿Por qué la recomendás?<textarea name="mensaje" rows={3} required minLength={15} maxLength={1500} placeholder="Qué sabe hacer, cómo trabaja…" /></label>
      <label className="p-campo">Su CV en PDF (opcional)<input name="cv" type="file" accept="application/pdf,.pdf" /></label>
      <label style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start", margin: "0.6rem 0", fontSize: "0.9rem" }}><input type="checkbox" name="consentimiento" value="on" required style={{ marginTop: 3 }} /><span>Le avisé y está de acuerdo en que pase sus datos para esta búsqueda.</span></label>
      {error && <div className="p-aviso error" role="alert">{error}</div>}
      <button className="p-btn" type="submit" disabled={enviando}>{enviando ? "Enviando…" : "Enviar recomendación"}</button>
      <button className="p-btn sec" type="button" onClick={() => setAbierto(false)} disabled={enviando}>Cancelar</button>
    </form>
  );
}
