"use client";
import { useState } from "react";

export default function PortalLogin() {
  const [cuil, setCuil] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    if (cargando) return;
    setError("");
    setCargando(true);
    try {
      const res = await fetch("/api/portal/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cuil, pin }),
      });
      const data = await res.json().catch(() => ({ error: "No hubo respuesta del servidor. Probá de nuevo." }));
      if (!res.ok) {
        setError(data.error);
        setPin("");
        setCargando(false);
        return;
      }
      window.location.href = data.debeCambiarPin ? "/portal/cambiar-pin" : "/portal";
    } catch {
      setError("No hay conexión. Revisá tu señal y probá de nuevo.");
      setCargando(false);
    }
  }

  return (
    <form className="p-centro" onSubmit={entrar}>
      <h1>Ingresá a tu portal</h1>
      <p className="p-sub">Tus recibos de sueldo, desde el celular.</p>

      {error && <div className="p-aviso error" role="alert">{error}</div>}

      <label className="p-campo">
        CUIL o DNI
        <input
          value={cuil}
          onChange={(e) => setCuil(e.target.value)}
          inputMode="numeric"
          autoComplete="username"
          placeholder="Solo números"
          autoFocus
          required
        />
      </label>
      <label className="p-campo">
        PIN
        <input
          className="p-pin"
          type="password"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
          inputMode="numeric"
          autoComplete="current-password"
          maxLength={6}
          required
        />
        <span className="p-ayuda">6 números. Si es tu primera vez, usá el PIN que te entregó RR.HH.</span>
      </label>

      <button className="p-btn" type="submit" disabled={cargando}>
        {cargando ? "Ingresando…" : "Ingresar"}
      </button>
      <p className="p-pie">¿Olvidaste tu PIN? Pedile a RR.HH. que te genere uno nuevo.</p>
    </form>
  );
}
