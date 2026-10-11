"use client";
import { useState } from "react";

// "No mostrar mi cumpleaños": decisión del empleado, se cambia cuando quiera.
export default function PreferenciaCumple({ oculto }: { oculto: boolean }) {
  const [valor, setValor] = useState(oculto);
  async function cambiar(nuevo: boolean) {
    setValor(nuevo);
    const res = await fetch("/api/portal/preferencias", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ocultarCumple: nuevo }) }).catch(() => null);
    if (!res?.ok) setValor(!nuevo);
  }
  return (
    <label className="p-pie" style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginTop: "1.5rem" }}>
      <input type="checkbox" checked={valor} onChange={(e) => cambiar(e.target.checked)} style={{ width: 18, height: 18 }} />
      No mostrar mi cumpleaños a mis compañeros (nunca se muestra el año ni la edad).
    </label>
  );
}
