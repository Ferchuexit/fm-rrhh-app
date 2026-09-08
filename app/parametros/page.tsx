"use client";
import { useState, useEffect } from "react";

export default function ParametrosPage() {
  const [parametros, setParametros] = useState<any[]>([]);
  const [clave, setClave] = useState("");
  const [claveNueva, setClaveNueva] = useState("");
  const [valor, setValor] = useState("");
  const [vigenciaDesde, setVigenciaDesde] = useState("");
  const [fuente, setFuente] = useState("");

  async function cargar() {
    const res = await fetch("/api/parametros");
    setParametros(await res.json());
  }

  useEffect(() => {
    cargar();
  }, []);

  const claves = Array.from(new Set(parametros.map((p) => p.clave))).sort();

  // Primera carga: apuntar el selector a la primera clave existente, así
  // no arranca vacío ni con un valor hardcodeado que ya no tiene sentido.
  useEffect(() => {
    if (!clave && claves.length > 0) setClave(claves[0]);
  }, [claves, clave]);

  const [error, setError] = useState("");

  async function actualizar() {
    setError("");
    const claveFinal = clave === "__nueva__" ? claveNueva.trim().toUpperCase() : clave;
    if (!claveFinal || !valor || !vigenciaDesde) {
      alert("Completá la clave, el valor y la fecha de vigencia.");
      return;
    }
    try {
      const res = await fetch("/api/parametros", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clave: claveFinal, valor, vigenciaDesde, fuente }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? `No se pudo guardar (error ${res.status}) — probá de nuevo en unos segundos.`);
        return;
      }
      setValor("");
      setFuente("");
      setClaveNueva("");
      if (clave === "__nueva__") setClave(claveFinal);
      cargar();
    } catch {
      setError("No se pudo conectar con el servidor — probá de nuevo en unos segundos.");
    }
  }

  return (
    <main>
      <h1>Parámetros y Topes</h1>
      <p>Actualizar acá no pisa el valor anterior — cierra su vigencia y crea uno nuevo.</p>

      <h3>Actualizar</h3>
      <div style={{ display: "flex", gap: "0.5rem", alignItems: "flex-end", flexWrap: "wrap" }}>
        <label>Clave<br />
          <select value={clave} onChange={(e) => setClave(e.target.value)} style={{ minWidth: "220px" }}>
            {claves.map((c) => <option key={c} value={c}>{c}</option>)}
            <option value="__nueva__">+ Nueva clave...</option>
          </select>
        </label>
        {clave === "__nueva__" && (
          <label>Nombre de la clave nueva<br />
            <input
              value={claveNueva}
              onChange={(e) => setClaveNueva(e.target.value.toUpperCase())}
              placeholder="Ej: TOPE_ALGO_NUEVO"
              style={{ minWidth: "200px" }}
            />
          </label>
        )}
        <label>Nuevo valor<br />
          <input value={valor} onChange={(e) => setValor(e.target.value)} style={{ width: "120px" }} />
        </label>
        <label>Vigente desde<br />
          <input type="date" value={vigenciaDesde} onChange={(e) => setVigenciaDesde(e.target.value)} />
        </label>
        <label>Fuente<br />
          <input value={fuente} onChange={(e) => setFuente(e.target.value)} placeholder="Ej: Resolución 9/2025" style={{ minWidth: "220px" }} />
        </label>
        <button onClick={actualizar}>Actualizar</button>
      </div>
      {error && <p style={{ color: "#B23A3A", fontSize: "0.85rem", marginTop: "0.4rem" }}>{error}</p>}
      {clave && clave !== "__nueva__" && (
        <p style={{ fontSize: "0.8rem", opacity: 0.6, marginTop: "0.4rem" }}>
          Esto actualiza <strong>{clave}</strong> — si en realidad querés cargar algo distinto, elegí "+ Nueva clave..." arriba.
        </p>
      )}

      {claves.map((c) => {
        const historial = parametros.filter((p) => p.clave === c).sort((a, b) => (a.vigenciaDesde < b.vigenciaDesde ? 1 : -1));
        const vigente = historial.find((h) => !h.vigenciaHasta);
        return (
          <div key={c} style={{ marginTop: "1.5rem" }}>
            <h3 style={{ marginBottom: "0.25rem" }}>{c}</h3>
            {vigente && (
              <p style={{ fontSize: "1.2rem", fontWeight: "bold", color: "#2F6F5E" }}>
                $ {vigente.valor.toLocaleString("es-AR")} <span style={{ fontSize: "0.75rem", fontWeight: "normal", opacity: 0.7 }}>vigente desde {vigente.vigenciaDesde.slice(0, 10)}</span>
              </p>
            )}
            <table>
              <thead>
                <tr><th>Valor</th><th>Desde</th><th>Hasta</th><th>Fuente</th></tr>
              </thead>
              <tbody>
                {historial.map((h) => (
                  <tr key={h.id}>
                    <td>$ {h.valor.toLocaleString("es-AR")}</td>
                    <td>{h.vigenciaDesde.slice(0, 10)}</td>
                    <td>{h.vigenciaHasta ? h.vigenciaHasta.slice(0, 10) : "vigente"}</td>
                    <td>{h.fuente ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </main>
  );
}
