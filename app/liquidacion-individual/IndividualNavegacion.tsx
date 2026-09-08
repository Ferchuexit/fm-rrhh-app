"use client";
import { useState, useEffect } from "react";

// FM RRHH — app/liquidacion-individual/IndividualNavegacion.tsx
// Mismo patrón que app/legajos/[id]/editar/LegajoNavegacion.tsx (reutiliza
// la misma API /api/legajos/[id]/adyacentes, que ya ordena por número de
// legajo dentro de la empresa) — solo cambia el destino del link, que acá
// tiene que preservar periodoId en la URL. Ver "Rediseño del módulo de
// Liquidaciones", punto 9.
//
// Ojo: "anterior/siguiente" recorre TODOS los legajos de la empresa, no solo
// los que ya están liquidados en este período — si cae en uno sin liquidar,
// la página va a mostrar "todavía no está liquidado", que es la respuesta
// correcta (no un error).
export default function IndividualNavegacion({ legajoId, periodoId }: { legajoId: string; periodoId: string }) {
  const [adyacentes, setAdyacentes] = useState<{ anterior: any; siguiente: any } | null>(null);

  useEffect(() => {
    setAdyacentes(null);
    fetch(`/api/legajos/${legajoId}/adyacentes`).then((r) => r.json()).then(setAdyacentes);
  }, [legajoId]);

  return (
    <div style={{ display: "flex", gap: "1rem", alignItems: "center", fontSize: "0.9rem" }}>
      {!adyacentes ? (
        <span style={{ opacity: 0.4 }}>Cargando navegación...</span>
      ) : (
        <>
          {adyacentes.anterior ? (
            <a href={`/liquidacion-individual?periodoId=${periodoId}&legajoId=${adyacentes.anterior.id}`}>
              ◀ {adyacentes.anterior.numeroLegajo} — {adyacentes.anterior.apellido}
            </a>
          ) : (
            <span style={{ opacity: 0.3 }}>◀ (es el primero)</span>
          )}
          {adyacentes.siguiente ? (
            <a href={`/liquidacion-individual?periodoId=${periodoId}&legajoId=${adyacentes.siguiente.id}`}>
              {adyacentes.siguiente.numeroLegajo} — {adyacentes.siguiente.apellido} ▶
            </a>
          ) : (
            <span style={{ opacity: 0.3 }}>(es el último) ▶</span>
          )}
        </>
      )}
    </div>
  );
}
