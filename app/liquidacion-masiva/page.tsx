"use client";
import { useState, useEffect } from "react";

// FM RRHH — app/liquidacion-masiva/page.tsx
// Antes vivía en /liquidar. Se renombra a "Liquidación Masiva" para separarla
// conceptualmente de /liquidacion-individual (trabajo detallado sobre UN
// legajo) — ver "Rediseño del módulo de Liquidaciones", punto 1. El
// comportamiento no cambia: sigue calculando simultáneamente la nómina de
// una empresa/período completo, con los mismos filtros de siempre.
//
// La ruta vieja /liquidar ahora es un simple redirect (ver ese archivo) para
// no romper ningún link o bookmark existente.

function money(n: number) {
  return n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function LiquidacionMasivaPage() {
  const [periodos, setPeriodos] = useState<any[]>([]);
  const [periodoId, setPeriodoId] = useState("");
  const [convenios, setConvenios] = useState<any[]>([]);

  const [modo, setModo] = useState<"todos" | "convenio" | "rango">("todos");
  const [convenioId, setConvenioId] = useState("");
  const [legajoDesde, setLegajoDesde] = useState("");
  const [legajoHasta, setLegajoHasta] = useState("");

  const [estado, setEstado] = useState<any>(null);
  const [ultimoResultado, setUltimoResultado] = useState<Record<string, any>>({}); // legajoId -> resultado del último intento
  const [liquidando, setLiquidando] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const [cargandoEstado, setCargandoEstado] = useState(false);

  useEffect(() => {
    fetch("/api/periodos").then((r) => r.json()).then((ps) => {
      setPeriodos(ps);
      const desdeUrl = new URLSearchParams(window.location.search).get("periodoId");
      setPeriodoId(desdeUrl && ps.some((p: any) => p.id === desdeUrl) ? desdeUrl : ps[0]?.id ?? "");
    });
    fetch("/api/convenios").then((r) => r.json()).then(setConvenios);
  }, []);

  function filtroActual() {
    return {
      modo,
      convenioId: modo === "convenio" ? convenioId : undefined,
      legajoDesde: modo === "rango" && legajoDesde ? Number(legajoDesde) : undefined,
      legajoHasta: modo === "rango" && legajoHasta ? Number(legajoHasta) : undefined,
    };
  }

  async function cargarEstado() {
    if (!periodoId) return;
    setCargandoEstado(true);
    const f = filtroActual();
    const params = new URLSearchParams({ periodoId, modo: f.modo });
    if (f.convenioId) params.set("convenioId", f.convenioId);
    if (f.legajoDesde != null) params.set("legajoDesde", String(f.legajoDesde));
    if (f.legajoHasta != null) params.set("legajoHasta", String(f.legajoHasta));
    const res = await fetch(`/api/liquidar/estado?${params}`);
    setEstado(await res.json());
    setCargandoEstado(false);
  }

  useEffect(() => {
    cargarEstado();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodoId, modo, convenioId, legajoDesde, legajoHasta]);

  async function liquidar() {
    if (!periodoId) return;
    setLiquidando(true);
    const res = await fetch("/api/liquidar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ periodoId, filtro: filtroActual() }),
    });
    let data;
    try {
      data = await res.json();
    } catch {
      setLiquidando(false);
      alert("El servidor no devolvió una respuesta válida — mirá la terminal donde corre npm run dev.");
      return;
    }
    if (!res.ok || data.error) {
      alert(data.error);
      setLiquidando(false);
      return;
    }
    const porLegajoId: Record<string, any> = {};
    for (const r of data.resultados) porLegajoId[r.legajoId] = r;
    setUltimoResultado(porLegajoId);
    setLiquidando(false);
    cargarEstado();
  }

  async function eliminarLiquidaciones() {
    if (!periodoId) return;
    const cantidadTexto = modo === "todos" ? "TODAS las liquidaciones de este período" : "las liquidaciones del filtro actual";
    if (!confirm(`¿Eliminar ${cantidadTexto}? No se puede deshacer — habría que volver a liquidar.`)) return;

    setEliminando(true);
    const res = await fetch("/api/liquidar", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ periodoId, filtro: filtroActual() }),
    });
    let data;
    try {
      data = await res.json();
    } catch {
      setEliminando(false);
      alert("El servidor no devolvió una respuesta válida.");
      return;
    }
    setEliminando(false);
    if (!res.ok || data.error) {
      alert(data.error);
      return;
    }
    setUltimoResultado({});
    alert(`${data.eliminadas} liquidación(es) eliminada(s).`);
    cargarEstado();
  }

  const periodo = periodos.find((p) => p.id === periodoId);
  const cantidadAProcesar =
    modo === "todos" ? "todos los legajos" : modo === "convenio" ? "los legajos de este convenio" : "los legajos de este rango";

  return (
    <main>
      <h1>Liquidación Masiva</h1>
      <p>
        Procesa simultáneamente la nómina de una empresa/período. Separado de{" "}
        <a href="/liquidacion-individual">Liquidación Individual</a> a propósito — acá se calcula todo junto; ahí se
        trabaja el recibo de un solo legajo. También separado de <a href="/legajos">/legajos</a>, que solo administra
        a la gente.
      </p>
      {periodo?.convenio && (
        <p style={{ background: "#EEF1F4", padding: "0.5rem 0.75rem", fontSize: "0.85rem", maxWidth: "700px" }}>
          📌 Este período está restringido a <strong>{periodo.convenio.codigo} — {periodo.convenio.nombre}</strong> —
          "Todos" abajo solo va a tomar legajos de este convenio, ningún otro se cuela por accidente.
        </p>
      )}

      <div style={{ background: "white", border: "1px solid #dfe4e8", padding: "1rem", marginBottom: "1.5rem", maxWidth: "700px" }}>
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

        <button onClick={liquidar} disabled={liquidando || eliminando || !periodoId}>
          {liquidando ? "Liquidando..." : `Liquidar ${cantidadAProcesar}`}
        </button>{" "}
        <button
          onClick={eliminarLiquidaciones}
          disabled={eliminando || liquidando || !periodoId}
          style={{ background: "white", color: "#B23A3A", border: "1px solid #B23A3A" }}
        >
          {eliminando ? "Eliminando..." : `Eliminar liquidación de ${cantidadAProcesar}`}
        </button>{" "}
        {periodo && (
          <>
            <a href={`/preliquidacion?periodoId=${periodo.id}`} style={{ fontSize: "0.85rem", marginLeft: "0.5rem" }}>
              Ver tabla de conceptos completa →
            </a>{" "}
            <a href={`/liquidacion-individual?periodoId=${periodo.id}`} style={{ fontSize: "0.85rem", marginLeft: "0.5rem" }}>
              Ver/editar un legajo puntual →
            </a>{" "}
            <a href={`/recibos?periodoId=${periodo.id}`} style={{ fontSize: "0.85rem", marginLeft: "0.5rem" }}>
              Descargar recibos →
            </a>
          </>
        )}
      </div>

      {cargandoEstado && !estado ? (
        <p style={{ opacity: 0.6 }}>Cargando...</p>
      ) : estado ? (
        <>
          <p>
            <strong>{estado.liquidados}</strong> liquidados · <strong>{estado.pendientes}</strong> pendientes · {estado.total} en total
          </p>
          <table style={{ fontSize: "0.85rem" }}>
            <thead>
              <tr>
                <th>Legajo</th>
                <th>Apellido y Nombre</th>
                <th>Conv.</th>
                <th>Estado</th>
                <th style={{ textAlign: "right" }}>Bruto</th>
                <th style={{ textAlign: "right" }}>Neto</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {estado.filas.map((f: any) => {
                const ultimo = ultimoResultado[f.legajoId];
                const error = ultimo?.error;
                return (
                  <tr key={f.legajoId}>
                    <td>{f.numeroLegajo}</td>
                    <td>{f.apellido}, {f.nombre}</td>
                    <td>{f.convenio}</td>
                    <td>
                      {error ? (
                        <span style={{ color: "#B23A3A" }} title={error}>⚠ Error</span>
                      ) : f.estado === "liquidado" ? (
                        <span style={{ color: "#2F6F5E" }}>✔ Liquidado</span>
                      ) : (
                        <span style={{ opacity: 0.5 }}>— Pendiente</span>
                      )}
                    </td>
                    <td style={{ textAlign: "right" }}>{f.bruto != null ? money(f.bruto) : "—"}</td>
                    <td style={{ textAlign: "right" }}>{f.neto != null ? money(f.neto) : "—"}</td>
                    <td>
                      {periodoId && (
                        <a href={`/liquidacion-individual?periodoId=${periodoId}&legajoId=${f.legajoId}`} style={{ fontSize: "0.8rem" }}>
                          Ver legajo →
                        </a>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {Object.values(ultimoResultado).some((r: any) => r.error) && (
            <div style={{ marginTop: "1rem", background: "#fdf2ea", border: "1px solid #B8752B", padding: "0.75rem", fontSize: "0.85rem" }}>
              <strong>Errores del último intento:</strong>
              <ul>
                {Object.values(ultimoResultado)
                  .filter((r: any) => r.error)
                  .map((r: any) => (
                    <li key={r.legajoId}>Legajo {r.legajo} ({r.apellido}): {r.error}</li>
                  ))}
              </ul>
            </div>
          )}
        </>
      ) : null}
    </main>
  );
}
