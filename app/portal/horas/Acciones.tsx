"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

async function enviar(cuerpo: unknown): Promise<string | null> {
  try {
    const res = await fetch("/api/portal/banco-horas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo) });
    if (res.status === 401) { window.location.href = "/portal/login"; return null; }
    if (!res.ok) return (await res.json().catch(() => ({}))).error || "No se pudo completar.";
    return null;
  } catch { return "No hay conexión. Probá de nuevo."; }
}

export function Aceptar({ id }: { id: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  async function aceptar() {
    if (enviando || !window.confirm("¿Leíste el acuerdo y lo aceptás?")) return;
    setEnviando(true); setError("");
    const e = await enviar({ accion: "aceptar", id });
    if (e) setError(e); else router.refresh();
    setEnviando(false);
  }
  return (
    <>
      {error && <div className="p-aviso error" role="alert">{error}</div>}
      <button className="p-btn verde" onClick={aceptar} disabled={enviando}>{enviando ? "Guardando…" : "Leí el acuerdo y lo acepto"}</button>
    </>
  );
}

export function Pedir({ hoy, disponible }: { hoy: string; disponible: string }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [tipo, setTipo] = useState("usar");
  const [fecha, setFecha] = useState(hoy);
  const [horas, setHoras] = useState("");
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [enviando, setEnviando] = useState(false);
  async function pedir(ev: React.FormEvent) {
    ev.preventDefault();
    if (enviando) return;
    setEnviando(true); setError("");
    const e = await enviar({ accion: "pedir", tipo, fecha, horas, motivo });
    setEnviando(false);
    if (e) { setError(e); return; }
    setOk("Listo, le llegó a RR.HH. Te avisamos cuando te respondan.");
    setAbierto(false); setHoras(""); setMotivo("");
    router.refresh();
  }
  if (!abierto) return (<>{ok && <div className="p-aviso" role="status">{ok}</div>}<button className="p-btn" onClick={() => { setAbierto(true); setOk(""); }}>Pedir usar o cobrar horas</button></>);
  return (
    <form className="p-card" onSubmit={pedir}>
      <div className="p-card-titulo">Tenés {disponible} disponibles</div>
      <label className="p-campo">¿Qué querés hacer?
        <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
          <option value="usar">Usarlas (un franco o salir antes)</option>
          <option value="cobrar">Cobrarlas en el sueldo</option>
        </select>
      </label>
      {tipo === "usar" && <label className="p-campo">¿Qué día?<input type="date" value={fecha} min={hoy} required onChange={(e) => setFecha(e.target.value)} /></label>}
      <label className="p-campo">¿Cuántas horas?<input inputMode="decimal" value={horas} required placeholder="Por ejemplo 8, o 1:30" onChange={(e) => setHoras(e.target.value)} /></label>
      <label className="p-campo">Comentario (opcional)<textarea value={motivo} maxLength={300} rows={2} onChange={(e) => setMotivo(e.target.value)} /></label>
      {error && <div className="p-aviso error" role="alert">{error}</div>}
      <button className="p-btn" disabled={enviando}>{enviando ? "Enviando…" : "Enviar pedido"}</button>
      <button type="button" className="p-btn sec" onClick={() => setAbierto(false)}>Cancelar</button>
    </form>
  );
}
