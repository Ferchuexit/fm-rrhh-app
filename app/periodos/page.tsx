"use client";
import { useState, useEffect } from "react";

export default function PeriodosPage() {
  const [periodos, setPeriodos] = useState<any[]>([]);
  const [convenios, setConvenios] = useState<any[]>([]);
  const [nombre, setNombre] = useState("1ra. Quincena Agosto 2026");
  const [fechaDesde, setFechaDesde] = useState("2026-08-01");
  const [fechaHasta, setFechaHasta] = useState("2026-08-15");
  const [convenioId, setConvenioId] = useState("");
  const [error, setError] = useState("");

  async function cargar() {
    const res = await fetch("/api/periodos");
    setPeriodos(await res.json());
  }

  useEffect(() => {
    cargar();
    fetch("/api/convenios").then((r) => r.json()).then(setConvenios);
  }, []);

  async function crear() {
    setError("");
    const res = await fetch("/api/periodos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre, fechaDesde, fechaHasta, convenioId: convenioId || null }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error);
      return;
    }
    cargar();
  }

  function diasDe(p: any) {
    return Math.round((new Date(p.fechaHasta).getTime() - new Date(p.fechaDesde).getTime()) / (24 * 3600 * 1000)) + 1;
  }

  return (
    <main>
      <h1>Períodos</h1>
      <p>
        Cada período define su propio nombre y rango de fechas — las novedades cargadas impactan según en qué rango
        cae su fecha, no según un mes calendario fijo. Así podés tener "1ra. Quincena Agosto 2026" (01/08 al 15/08)
        conviviendo con un período mensual completo.
      </p>

      <div style={{ background: "white", border: "1px solid #dfe4e8", padding: "1rem", marginBottom: "1.5rem", maxWidth: "600px" }}>
        <h3 style={{ marginTop: 0 }}>Nuevo período</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", maxWidth: "400px" }}>
          <label>
            Nombre
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} style={{ width: "100%" }} />
          </label>
          <label>
            Fecha desde
            <input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} style={{ width: "100%" }} />
          </label>
          <label>
            Fecha hasta
            <input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} style={{ width: "100%" }} />
          </label>
          <label>
            Convenio (opcional)
            <select value={convenioId} onChange={(e) => setConvenioId(e.target.value)} style={{ width: "100%" }}>
              <option value="">Todos los convenios (sin restricción)</option>
              {convenios.map((c) => <option key={c.id} value={c.id}>{c.codigo} — {c.nombre}</option>)}
            </select>
          </label>
        </div>
        <p style={{ fontSize: "0.75rem", opacity: 0.6, marginTop: "0.4rem" }}>
          Si elegís un convenio, este período queda restringido a él — "Todos" en /liquidacion-masiva, /recibos y borrado
          masivo va a respetar eso automáticamente, para que otro convenio no se cuele por accidente (por ejemplo,
          Comercio en una quincena pensada solo para Madera).
        </p>
        <button onClick={crear} style={{ marginTop: "0.75rem" }}>Crear período</button>
        {error && <p style={{ color: "#B23A3A" }}>{error}</p>}
      </div>

      <h3>Períodos existentes</h3>
      <table>
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Desde</th>
            <th>Hasta</th>
            <th>Días</th>
            <th>Convenio</th>
            <th>Estado</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {periodos.map((p) => (
            <tr key={p.id}>
              <td>{p.nombre}</td>
              <td>{p.fechaDesde.slice(0, 10)}</td>
              <td>{p.fechaHasta.slice(0, 10)}</td>
              <td>{diasDe(p)}</td>
              <td>{p.convenio ? p.convenio.codigo : <span style={{ opacity: 0.4 }}>—</span>}</td>
              <td>{p.estado}</td>
              <td>
                <a href={`/liquidacion-masiva?periodoId=${p.id}`}>Ir a Liquidar →</a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
