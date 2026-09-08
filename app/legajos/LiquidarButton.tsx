"use client";
import { useState } from "react";

export default function LiquidarButton({ periodoId, nombre }: { periodoId: string; nombre: string }) {
  const [resultado, setResultado] = useState<any>(null);
  const [cargando, setCargando] = useState(false);

  async function liquidar() {
    setCargando(true);
    const res = await fetch("/api/liquidar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ periodoId }),
    });
    try {
      const data = await res.json();
      setResultado(data);
    } catch {
      setResultado({ error: "El servidor no devolvió una respuesta válida — mirá la terminal donde corre npm run dev." });
    }
    setCargando(false);
  }

  return (
    <div style={{ marginTop: "2rem" }}>
      <button onClick={liquidar} disabled={cargando}>
        {cargando ? "Liquidando..." : `Liquidar "${nombre}" (motor de reglas real)`}
      </button>

      {resultado && (
        <div style={{ marginTop: "1rem", background: "white", padding: "1rem", border: "1px solid #ddd" }}>
          {resultado.error ? (
            <p style={{ color: "#B23A3A" }}>{resultado.error}</p>
          ) : (
            <>
              {(() => {
                const conError = resultado.resultados.filter((r: any) => r.error).length;
                const exitosos = resultado.legajosLiquidados - conError;
                return (
                  <>
                    <p style={{ color: "#2F6F5E", fontWeight: "bold" }}>
                      ✔ {exitosos} legajo{exitosos !== 1 ? "s" : ""} liquidado{exitosos !== 1 ? "s" : ""} para "{resultado.periodo}".
                    </p>
                    {conError > 0 && (
                      <p style={{ color: "#B8752B" }}>
                        ⚠ {conError} legajo{conError !== 1 ? "s" : ""} con error (revisá el detalle técnico más abajo).
                      </p>
                    )}
                  </>
                );
              })()}
              <p>
                <a href={`/preliquidacion?periodoId=${periodoId}`}>
                  <button>Ver resumen en tabla →</button>
                </a>
              </p>
              <details style={{ marginTop: "0.75rem" }}>
                <summary style={{ fontSize: "0.8rem", opacity: 0.6, cursor: "pointer" }}>Ver el detalle técnico (JSON crudo)</summary>
                <pre style={{ whiteSpace: "pre-wrap", fontSize: "0.75rem" }}>{JSON.stringify(resultado, null, 2)}</pre>
              </details>
            </>
          )}
        </div>
      )}
    </div>
  );
}
