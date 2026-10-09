"use client";
import { useState } from "react";

const soloPin = (v: string) => v.replace(/\D/g, "").slice(0, 6);

export default function CambiarPinForm({ obligatorio }: { obligatorio: boolean }) {
  const [pinActual, setPinActual] = useState("");
  const [pinNuevo, setPinNuevo] = useState("");
  const [repetir, setRepetir] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (cargando) return;
    setError("");
    if (pinNuevo !== repetir) {
      setError("Los dos PIN nuevos no coinciden. Escribilos de nuevo.");
      return;
    }
    setCargando(true);
    try {
      const res = await fetch("/api/portal/cambiar-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pinActual, pinNuevo }),
      });
      const data = await res.json().catch(() => ({ error: "No hubo respuesta del servidor. Probá de nuevo." }));
      if (!res.ok) {
        setError(data.error);
        setCargando(false);
        return;
      }
      window.location.href = "/portal";
    } catch {
      setError("No hay conexión. Revisá tu señal y probá de nuevo.");
      setCargando(false);
    }
  }

  return (
    <form className="p-centro" onSubmit={guardar}>
      <h1>{obligatorio ? "Elegí tu PIN" : "Cambiar mi PIN"}</h1>
      <p className="p-sub">
        {obligatorio
          ? "El PIN que te dieron es temporal. Elegí uno que solo vos conozcas: con ese PIN vas a entrar y a firmar tus recibos."
          : "Con tu PIN entrás al portal y firmás tus recibos. No lo compartas con nadie."}
      </p>

      {error && <div className="p-aviso error" role="alert">{error}</div>}

      <label className="p-campo">
        {obligatorio ? "PIN temporal (el que te dieron)" : "PIN actual"}
        <input className="p-pin" type="password" inputMode="numeric" autoComplete="current-password" maxLength={6}
          value={pinActual} onChange={(e) => setPinActual(soloPin(e.target.value))} required autoFocus />
      </label>
      <label className="p-campo">
        PIN nuevo
        <input className="p-pin" type="password" inputMode="numeric" autoComplete="new-password" maxLength={6}
          value={pinNuevo} onChange={(e) => setPinNuevo(soloPin(e.target.value))} required />
        <span className="p-ayuda">6 números. No uses números iguales (111111), en escalera (123456) ni parte de tu DNI.</span>
      </label>
      <label className="p-campo">
        Repetí el PIN nuevo
        <input className="p-pin" type="password" inputMode="numeric" autoComplete="new-password" maxLength={6}
          value={repetir} onChange={(e) => setRepetir(soloPin(e.target.value))} required />
      </label>

      <button className="p-btn" type="submit" disabled={cargando}>
        {cargando ? "Guardando…" : "Guardar mi PIN"}
      </button>
      {!obligatorio && <a className="p-link" href="/portal">← Volver</a>}
    </form>
  );
}
