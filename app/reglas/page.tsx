"use client";
import { useSearchParams } from "next/navigation";
import FormulaEditor from "./FormulaEditor";

// FM RRHH — app/reglas/page.tsx
// Desde el 08/09/2026 esto es un wrapper delgado — la lógica del editor
// vive en FormulaEditor.tsx, reusada también desde /conceptos (rediseño
// pedido por Fernando para que crear un concepto y su fórmula se sientan
// como una sola pantalla). Los links viejos con ?conceptoCodigo=&convenioId=
// (desde /conceptos, /liquidacion-individual) siguen funcionando igual.
export default function ReglasPage() {
  const params = useSearchParams();
  const cc = params.get("conceptoCodigo") ?? "";
  const cv = params.get("convenioId") ?? "";

  return (
    <main>
      <h1>Editor de reglas</h1>
      <FormulaEditor conceptoCodigoInicial={cc} convenioIdInicial={cv} />
    </main>
  );
}
