"use client";
import { useState, useEffect } from "react";

export default function LegajoNavegacion({ legajoId }: { legajoId: string }) {
  const [adyacentes, setAdyacentes] = useState<{ anterior: any; siguiente: any } | null>(null);

  useEffect(() => {
    fetch(`/api/legajos/${legajoId}/adyacentes`).then((r) => r.json()).then(setAdyacentes);
  }, [legajoId]);

  if (!adyacentes) return null;

  return (
    <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem", fontSize: "0.9rem" }}>
      {adyacentes.anterior ? (
        <a href={`/legajos/${adyacentes.anterior.id}/editar`}>
          ← {adyacentes.anterior.numeroLegajo} — {adyacentes.anterior.apellido}
        </a>
      ) : (
        <span style={{ opacity: 0.3 }}>← (es el primero)</span>
      )}
      {adyacentes.siguiente ? (
        <a href={`/legajos/${adyacentes.siguiente.id}/editar`}>
          {adyacentes.siguiente.numeroLegajo} — {adyacentes.siguiente.apellido} →
        </a>
      ) : (
        <span style={{ opacity: 0.3 }}>(es el último) →</span>
      )}
    </div>
  );
}
