// Las preguntas de filtro de una búsqueda, como campos de formulario
// (r0, r1, r2…). Lo usan la página pública y el portal del empleado.
import type { PreguntaPublica } from "@/lib/reclutamiento-filtros";

export default function CamposFiltro({ preguntas, clase }: { preguntas: PreguntaPublica[]; clase: string }) {
  return (
    <>
      {preguntas.map((p, i) => (
        <fieldset key={i} style={{ border: 0, padding: 0, margin: "0 0 0.9rem" }}>
          <legend style={{ fontSize: "0.9rem", fontWeight: 600, padding: 0, marginBottom: "0.3rem" }}>{p.texto}</legend>
          {p.tipo === "numero" && <label className={clase} style={{ marginBottom: 0 }}><input name={`r${i}`} type="number" min={0} max={1000} step="0.5" inputMode="decimal" required aria-label={p.texto} style={{ maxWidth: 140 }} /></label>}
          {p.tipo !== "numero" && (
            <div style={{ display: "flex", flexDirection: p.tipo === "si_no" ? "row" : "column", gap: p.tipo === "si_no" ? "1.5rem" : "0.35rem" }}>
              {(p.tipo === "si_no" ? [["si", "Sí"], ["no", "No"]] : (p.opciones ?? []).map((o, k) => [String(k), o])).map(([valor, texto]) => (
                <label key={valor} style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.95rem", fontWeight: 400 }}>
                  <input type="radio" name={`r${i}`} value={valor} required style={{ width: 20, height: 20, margin: 0 }} />{texto}
                </label>
              ))}
            </div>
          )}
        </fieldset>
      ))}
    </>
  );
}
