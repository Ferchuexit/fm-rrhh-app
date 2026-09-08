"use client";
import { useState } from "react";

export default function CeldaComoSeCalculo({ detalleId, importe }: { detalleId: string; importe: number }) {
  const [abierto, setAbierto] = useState(false);
  const [datos, setDatos] = useState<any>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  function money(n: number) {
    return n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  async function abrir() {
    setAbierto(true);
    if (datos) return; // ya lo cargamos antes, no repetir el pedido
    setCargando(true);
    setError("");
    try {
      const res = await fetch(`/api/liquidacion-detalle/${detalleId}/como-se-calculo`);
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "No se pudo cargar."); return; }
      setDatos(data);
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setCargando(false);
    }
  }

  return (
    <>
      <button
        onClick={abrir}
        title="¿Cómo se calculó?"
        style={{ background: "none", border: "none", cursor: "pointer", padding: 0, font: "inherit", color: "inherit", textDecoration: "underline dotted" }}
      >
        {money(importe)}
      </button>

      {abierto && (
        <div
          onClick={() => setAbierto(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ background: "white", padding: "1.5rem", maxWidth: "520px", width: "90%", borderRadius: "4px", fontSize: "0.85rem" }}>
            {cargando && <p>Cargando...</p>}
            {error && <p style={{ color: "#B23A3A" }}>{error}</p>}
            {datos && (
              <>
                <h3 style={{ marginTop: 0 }}>¿Cómo se calculó? — {datos.conceptoNombre}</h3>
                {datos.esCasoEspecial ? (
                  <p>{datos.explicacion}</p>
                ) : (
                  <>
                    <p><strong>Convenio:</strong> {datos.convenioNombre}</p>
                    <p><strong>Regla vigente desde:</strong> {datos.reglaVigenteDesde}</p>
                    <p><strong>Fórmula:</strong></p>
                    <pre style={{ background: "var(--gris-claro)", padding: "0.6rem", overflowX: "auto", fontSize: "0.78rem" }}>{datos.formula}</pre>
                    <p><strong>Con los valores de este cálculo:</strong></p>
                    <pre style={{ background: "var(--gris-claro)", padding: "0.6rem", overflowX: "auto", fontSize: "0.78rem" }}>{datos.formulaConValores}</pre>
                    <p style={{ fontSize: "0.75rem", opacity: 0.6, marginTop: "0.8rem" }}>{datos.avisoReconstruccion}</p>
                  </>
                )}
                <p style={{ fontWeight: "bold", fontSize: "1rem", marginTop: "0.8rem" }}>Importe: ${money(datos.importe)}</p>
              </>
            )}
            <button onClick={() => setAbierto(false)} style={{ marginTop: "0.5rem" }}>Cerrar</button>
          </div>
        </div>
      )}
    </>
  );
}
