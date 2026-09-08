"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

// FM RRHH — app/liquidacion-individual/AccionesLiquidacion.tsx
//
// Liquidar / volver a liquidar / eliminar UN legajo desde Liquidación
// Individual, sin tener que ir a Liquidación Masiva. Pedido explícito de
// Fernando (08/09/2026).
//
// DECISIÓN DE DISEÑO: esto NO reimplementa el cálculo — llama al mismo
// POST/DELETE /api/liquidar que ya usa Liquidación Masiva, con el filtro
// "por legajo" (legajoDesde = legajoHasta = este legajo) que esa pantalla
// ya tenía. Así "liquidar desde Individual" corre exactamente el motor
// completo (SAC, Ganancias, Embargos con sus acumulados reales) — no la
// versión acotada de lib/liquidacion-individual-recalculo.ts, que es
// solo para los ajustes en vivo sobre una liquidación que ya existe.
export default function AccionesLiquidacion({
  legajoId,
  numeroLegajo,
  periodoId,
  yaLiquidado,
  periodoAbierto,
}: {
  legajoId: string;
  numeroLegajo: number;
  periodoId: string;
  yaLiquidado: boolean;
  periodoAbierto: boolean;
}) {
  const router = useRouter();
  const [procesando, setProcesando] = useState<"liquidar" | "eliminar" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filtro = { modo: "rango" as const, legajoDesde: numeroLegajo, legajoHasta: numeroLegajo };

  async function liquidar() {
    setProcesando("liquidar");
    setError(null);
    try {
      const res = await fetch("/api/liquidar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ periodoId, filtro }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error ?? "Error inesperado.");
        setProcesando(null);
        return;
      }
      const resultado = data.resultados?.[0];
      if (resultado?.error) {
        setError(resultado.error);
        setProcesando(null);
        return;
      }
    } catch {
      setError("El servidor no devolvió una respuesta válida.");
      setProcesando(null);
      return;
    }
    setProcesando(null);
    router.refresh();
  }

  async function eliminar() {
    if (!confirm(`¿Eliminar la liquidación de este legajo (Nº ${numeroLegajo}) en este período? No afecta a los demás legajos. No se puede deshacer.`)) return;
    setProcesando("eliminar");
    setError(null);
    try {
      const res = await fetch("/api/liquidar", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ periodoId, filtro }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error ?? "Error inesperado.");
        setProcesando(null);
        return;
      }
    } catch {
      setError("El servidor no devolvió una respuesta válida.");
      setProcesando(null);
      return;
    }
    setProcesando(null);
    router.refresh();
  }

  if (!periodoAbierto) {
    return <p style={{ fontSize: "0.85rem", opacity: 0.5 }}>Período cerrado — no se puede liquidar ni eliminar acá.</p>;
  }

  return (
    <div style={{ display: "flex", gap: "0.6rem", alignItems: "center", flexWrap: "wrap", margin: "0.75rem 0" }}>
      {!yaLiquidado ? (
        <button onClick={liquidar} disabled={procesando !== null} style={{ fontWeight: "bold" }}>
          {procesando === "liquidar" ? "Liquidando..." : "Liquidar este legajo"}
        </button>
      ) : (
        <>
          <button
            onClick={() => {
              if (confirm("¿Volver a liquidar este legajo desde cero? Cualquier importe forzado o concepto excluido/agregado a mano en esta liquidación se pierde — se recalcula todo desde las fórmulas.")) liquidar();
            }}
            disabled={procesando !== null}
          >
            {procesando === "liquidar" ? "Liquidando..." : "Volver a liquidar desde cero"}
          </button>
          <button onClick={eliminar} disabled={procesando !== null} style={{ background: "white", color: "#B23A3A", border: "1px solid #B23A3A" }}>
            {procesando === "eliminar" ? "Eliminando..." : "Eliminar liquidación de este legajo"}
          </button>
        </>
      )}
      {error && <span style={{ color: "#B23A3A", fontSize: "0.85rem" }}>{error}</span>}
    </div>
  );
}
