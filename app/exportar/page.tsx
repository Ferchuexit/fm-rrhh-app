"use client";
import { useState, useEffect } from "react";

export default function ExportarPage() {
  const [periodoId, setPeriodoId] = useState("");
  const [periodos, setPeriodos] = useState<any[]>([]);
  const [errorLsd, setErrorLsd] = useState<any>(null);
  const [errorF931, setErrorF931] = useState<any>(null);
  const [cargandoLsd, setCargandoLsd] = useState(false);
  const [cargandoF931, setCargandoF931] = useState(false);

  useEffect(() => {
    fetch("/api/periodos").then((r) => r.json()).then((ps) => {
      setPeriodos(ps);
      const desdeUrl = new URLSearchParams(window.location.search).get("periodoId");
      setPeriodoId(desdeUrl && ps.some((p: any) => p.id === desdeUrl) ? desdeUrl : ps[0]?.id ?? "");
    });
  }, []);

  async function descargar(url: string, filenameFallback: string, setError: any, setCargando: any) {
    setError(null);
    setCargando(true);
    const res = await fetch(url);
    if (!res.ok) {
      try {
        setError(await res.json());
      } catch {
        setError({ error: "El servidor no devolvió una respuesta válida." });
      }
      setCargando(false);
      return;
    }
    const blob = await res.blob();
    const a = document.createElement("a");
    const disposition = res.headers.get("Content-Disposition") ?? "";
    const match = disposition.match(/filename="(.+)"/);
    a.href = URL.createObjectURL(blob);
    a.download = match ? match[1] : filenameFallback;
    a.click();
    setCargando(false);
  }

  return (
    <main>
      <h1>Exportación ARCA</h1>
      <p>
        LSD es un archivo de ancho fijo verificado contra tu Excel original. F.931 es un{" "}
        <strong>consolidado</strong>, no un archivo de presentación — tu sistema tampoco generaba un TXT para eso,
        ver <code>07-motor-exportacion-arca.md</code>.
      </p>
      <select
        value={periodoId}
        onChange={(e) => setPeriodoId(e.target.value)}
        style={{ marginRight: "0.5rem", marginBottom: "1rem", display: "block" }}
      >
        {periodos.length === 0 && <option value="">No hay períodos cargados todavía</option>}
        {periodos.map((p) => (
          <option key={p.id} value={p.id}>{p.nombre} ({p.estado})</option>
        ))}
      </select>

      <div style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem" }}>
        <button
          disabled={!periodoId || cargandoLsd}
          onClick={() => descargar(`/api/exportar/lsd?periodoId=${periodoId}`, "LSD.txt", setErrorLsd, setCargandoLsd)}
        >
          {cargandoLsd ? "Generando..." : "Descargar LSD (.txt)"}
        </button>
        <button
          disabled={!periodoId || cargandoF931}
          onClick={() => descargar(`/api/exportar/f931?periodoId=${periodoId}`, "F931.csv", setErrorF931, setCargandoF931)}
        >
          {cargandoF931 ? "Generando..." : "Descargar consolidado F.931 (.csv)"}
        </button>
      </div>

      {errorLsd && (
        <div style={{ border: "2px solid #B23A3A", background: "white", padding: "1rem", marginBottom: "1rem", maxWidth: "600px" }}>
          <strong style={{ color: "#B23A3A" }}>LSD: {errorLsd.error}</strong>
          {errorLsd.conceptosFaltantes && (
            <>
              <ul>
                {errorLsd.conceptosFaltantes.map((c: string) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
              <p>
                {errorLsd.solucion} → <a href="/conceptos">Ir a /conceptos</a>
              </p>
            </>
          )}
          {errorLsd.detalle && <p style={{ fontSize: "0.85rem" }}>{errorLsd.detalle}</p>}
        </div>
      )}
      {errorF931 && (
        <div style={{ border: "2px solid #B23A3A", background: "white", padding: "1rem", maxWidth: "600px" }}>
          <strong style={{ color: "#B23A3A" }}>F.931: {errorF931.error}</strong>
        </div>
      )}
    </main>
  );
}
