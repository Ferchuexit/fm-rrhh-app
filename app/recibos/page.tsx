"use client";
import { useState, useEffect } from "react";

export default function RecibosPage() {
  const [periodos, setPeriodos] = useState<any[]>([]);
  const [periodoId, setPeriodoId] = useState("");
  const [convenios, setConvenios] = useState<any[]>([]);

  const [modo, setModo] = useState<"todos" | "convenio" | "rango">("todos");
  const [convenioId, setConvenioId] = useState("");
  const [legajoDesde, setLegajoDesde] = useState("");
  const [legajoHasta, setLegajoHasta] = useState("");
  const [descargando, setDescargando] = useState(false);

  useEffect(() => {
    fetch("/api/periodos").then((r) => r.json()).then((ps) => {
      setPeriodos(ps);
      const desdeUrl = new URLSearchParams(window.location.search).get("periodoId");
      setPeriodoId(desdeUrl && ps.some((p: any) => p.id === desdeUrl) ? desdeUrl : ps[0]?.id ?? "");
    });
    fetch("/api/convenios").then((r) => r.json()).then(setConvenios);
  }, []);

  async function descargar() {
    if (!periodoId) return;
    setDescargando(true);
    const filtro = {
      modo,
      convenioId: modo === "convenio" ? convenioId : undefined,
      legajoDesde: modo === "rango" && legajoDesde ? Number(legajoDesde) : undefined,
      legajoHasta: modo === "rango" && legajoHasta ? Number(legajoHasta) : undefined,
    };
    const res = await fetch("/api/recibos/exportar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ periodoId, filtro }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: "Error inesperado." }));
      alert(data.error);
      setDescargando(false);
      return;
    }

    const sinLiquidar = res.headers.get("X-Legajos-Sin-Liquidar");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = res.headers.get("Content-Disposition")?.match(/filename="(.+)"/)?.[1] ?? "recibos.pdf";
    a.click();
    URL.revokeObjectURL(url);

    setDescargando(false);
    if (sinLiquidar) {
      alert(`Descargado. Estos legajos no estaban liquidados en este período y se saltearon: ${sinLiquidar}`);
    }
  }

  const periodo = periodos.find((p) => p.id === periodoId);
  const descripcion = modo === "todos" ? "todos los legajos" : modo === "convenio" ? "los legajos de este convenio" : "los legajos de este rango";

  return (
    <main>
      <h1>Recibos</h1>
      <p>
        Descarga masiva — un solo PDF combinado con un recibo por página, en el mismo orden que el filtro. Solo
        incluye a quien ya esté liquidado en el período elegido; si alguien del filtro no lo está, se avisa al
        terminar en vez de fallar todo.
      </p>

      <div style={{ background: "white", border: "1px solid #dfe4e8", padding: "1rem", maxWidth: "700px" }}>
        <div style={{ marginBottom: "0.75rem" }}>
          <label>
            Período:{" "}
            <select value={periodoId} onChange={(e) => setPeriodoId(e.target.value)}>
              {periodos.map((p) => (
                <option key={p.id} value={p.id}>{p.nombre} ({p.estado})</option>
              ))}
            </select>
          </label>
        </div>

        <div style={{ marginBottom: "0.75rem" }}>
          <label style={{ marginRight: "1rem" }}>
            <input type="radio" checked={modo === "todos"} onChange={() => setModo("todos")} /> Todos
          </label>
          <label style={{ marginRight: "1rem" }}>
            <input type="radio" checked={modo === "convenio"} onChange={() => setModo("convenio")} /> Por convenio
          </label>
          <label>
            <input type="radio" checked={modo === "rango"} onChange={() => setModo("rango")} /> Por legajo (uno solo o rango)
          </label>
        </div>

        {modo === "convenio" && (
          <div style={{ marginBottom: "0.75rem" }}>
            <select value={convenioId} onChange={(e) => setConvenioId(e.target.value)}>
              <option value="">Elegir convenio...</option>
              {convenios.map((c) => <option key={c.id} value={c.id}>{c.codigo} — {c.nombre}</option>)}
            </select>
          </div>
        )}

        {modo === "rango" && (
          <div style={{ marginBottom: "0.75rem", display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <input type="number" placeholder="Legajo desde" value={legajoDesde} onChange={(e) => setLegajoDesde(e.target.value)} style={{ width: "120px" }} />
            <span>hasta</span>
            <input type="number" placeholder="(igual al de arriba = uno solo)" value={legajoHasta} onChange={(e) => setLegajoHasta(e.target.value)} style={{ width: "220px" }} />
          </div>
        )}

        <button onClick={descargar} disabled={descargando || !periodoId}>
          {descargando ? "Generando..." : `Descargar recibos de ${descripcion}`}
        </button>
      </div>

      <p style={{ fontSize: "0.8rem", opacity: 0.6, marginTop: "1.5rem", maxWidth: "700px" }}>
        Filtrar por "tipo de liquidación" (mensual, SAC, vacaciones, finales) todavía no es posible — el sistema
        hoy solo distingue períodos y convenios, no tipos de liquidación dentro de un mismo período. Es un hueco
        real, no una omisión de esta pantalla — ver 60-recibos-masivos.md.
      </p>
    </main>
  );
}
