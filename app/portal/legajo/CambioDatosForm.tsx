"use client";
import { useState } from "react";

const CAMPOS: { clave: string; nombre: string; opciones?: string[]; tipo?: string }[] = [
  { clave: "domicilio", nombre: "Domicilio (calle, número, piso)" },
  { clave: "localidad", nombre: "Localidad" },
  { clave: "partido", nombre: "Partido" },
  { clave: "provincia", nombre: "Provincia" },
  { clave: "telefono", nombre: "Teléfono", tipo: "tel" },
  { clave: "email", nombre: "Email", tipo: "email" },
  { clave: "estadoCivil", nombre: "Estado civil", opciones: ["Soltero/a", "Casado/a", "Divorciado/a", "Viudo/a"] },
];

export default function CambioDatosForm({ actuales }: { actuales: Record<string, string> }) {
  const [abierto, setAbierto] = useState(false);
  const [f, setF] = useState(actuales);
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setEnviando(true);
    try {
      const res = await fetch("/api/portal/legajo/cambio-datos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
      const data = await res.json().catch(() => ({ error: "No hubo respuesta del servidor." }));
      if (res.status === 401) { window.location.href = "/portal/login"; return; }
      if (!res.ok) { setError(data.error); setEnviando(false); return; }
      window.location.reload();
    } catch {
      setError("No hay conexión. Probá de nuevo.");
      setEnviando(false);
    }
  }

  if (!abierto) return <button className="p-btn sec" style={{ marginTop: "0.9rem", marginBottom: 0 }} onClick={() => setAbierto(true)}>Pedir un cambio en mis datos</button>;
  return (
    <form onSubmit={enviar} style={{ marginTop: "1rem" }}>
      <p className="p-sub">Corregí lo que haga falta. RR.HH. revisa el cambio antes de que quede en tu ficha.</p>
      {error && <div className="p-aviso error" role="alert">{error}</div>}
      {CAMPOS.map((c) => (
        <label key={c.clave} className="p-campo">
          {c.nombre}
          {c.opciones ? (
            <select value={f[c.clave] ?? ""} onChange={(e) => setF({ ...f, [c.clave]: e.target.value })}>
              <option value="">—</option>
              {c.opciones.map((o) => <option key={o}>{o}</option>)}
            </select>
          ) : (
            <input type={c.tipo ?? "text"} value={f[c.clave] ?? ""} onChange={(e) => setF({ ...f, [c.clave]: e.target.value })} />
          )}
        </label>
      ))}
      <button className="p-btn" type="submit" disabled={enviando}>{enviando ? "Enviando…" : "Enviar a RR.HH."}</button>
      <button className="p-btn sec" type="button" disabled={enviando} style={{ marginBottom: 0 }} onClick={() => { setAbierto(false); setF(actuales); setError(""); }}>Cancelar</button>
    </form>
  );
}
