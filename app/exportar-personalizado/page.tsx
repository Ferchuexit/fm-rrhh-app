// FM RRHH — app/exportar-personalizado/page.tsx
// Exportador a medida — pensado para depósitos bancarios y "cualquier otro
// reporte con datos", como pidió Fernando: elegís los campos, apretás
// descargar, sale un .xlsx real.
"use client";
import { useState, useEffect } from "react";

const GRUPOS: { titulo: string; campos: { clave: string; etiqueta: string; disponible?: boolean; nota?: string }[] }[] = [
  {
    titulo: "Identificación",
    campos: [
      { clave: "legajo", etiqueta: "Legajo" },
      { clave: "nombreApellido", etiqueta: "Nombre y Apellido" },
      { clave: "cuil", etiqueta: "CUIL" },
      { clave: "dni", etiqueta: "DNI" },
    ],
  },
  {
    titulo: "Situación laboral",
    campos: [
      { clave: "categoria", etiqueta: "Categoría" },
      { clave: "convenio", etiqueta: "Convenio" },
      { clave: "basico", etiqueta: "Básico" },
      { clave: "turno", etiqueta: "Turno" },
      { clave: "sector", etiqueta: "Sector" },
      { clave: "sucursal", etiqueta: "Sucursal" },
    ],
  },
  {
    titulo: "Domicilio",
    campos: [
      { clave: "direccion", etiqueta: "Dirección" },
      { clave: "localidad", etiqueta: "Localidad" },
      { clave: "provincia", etiqueta: "Provincia" },
      { clave: "partido", etiqueta: "Partido" },
    ],
  },
  {
    titulo: "Obra social / Banco / ART",
    campos: [
      { clave: "obraSocial", etiqueta: "Obra Social" },
      { clave: "banco", etiqueta: "Banco" },
      { clave: "cbu", etiqueta: "CBU" },
      { clave: "art", etiqueta: "ART" },
    ],
  },
  {
    titulo: "Liquidación (necesita elegir un período abajo)",
    campos: [
      { clave: "bruto", etiqueta: "Bruto" },
      { clave: "neto", etiqueta: "Neto" },
      { clave: "otros", etiqueta: "Otros", disponible: false, nota: "no está claro a qué te referís — avisame y lo agrego" },
      { clave: "periodo", etiqueta: "Período" },
      { clave: "anio", etiqueta: "Año" },
    ],
  },
];

const CAMPOS_QUE_NECESITAN_PERIODO = ["bruto", "neto", "periodo", "anio"];

export default function ExportarPersonalizadoPage() {
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set(["legajo", "nombreApellido", "cuil"]));
  const [periodos, setPeriodos] = useState<any[]>([]);
  const [periodoId, setPeriodoId] = useState("");
  const [convenios, setConvenios] = useState<any[]>([]);
  const [convenioId, setConvenioId] = useState("");
  const [descargando, setDescargando] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/periodos").then((r) => r.json()).then(setPeriodos);
    fetch("/api/convenios").then((r) => r.json()).then(setConvenios);
  }, []);

  function toggle(clave: string) {
    setSeleccionados((prev) => {
      const next = new Set(prev);
      if (next.has(clave)) next.delete(clave);
      else next.add(clave);
      return next;
    });
  }

  const necesitaPeriodo = [...seleccionados].some((c) => CAMPOS_QUE_NECESITAN_PERIODO.includes(c));

  async function descargar() {
    setError("");
    if (seleccionados.size === 0) { setError("Elegí al menos un campo."); return; }
    if (necesitaPeriodo && !periodoId) { setError("Elegiste Bruto, Neto, Período o Año — hace falta elegir un período de liquidación."); return; }

    setDescargando(true);
    const params = new URLSearchParams({ campos: [...seleccionados].join(",") });
    if (periodoId) params.set("periodoId", periodoId);
    if (convenioId) params.set("convenioId", convenioId);

    try {
      const res = await fetch(`/api/exportar-personalizado?${params}`);
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "No se pudo exportar.");
        return;
      }
      const blob = await res.blob();
      const a = document.createElement("a");
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="(.+)"/);
      a.href = URL.createObjectURL(blob);
      a.download = match ? match[1] : "exportacion.xlsx";
      a.click();
    } catch {
      setError("El servidor no devolvió una respuesta válida.");
    } finally {
      setDescargando(false);
    }
  }

  return (
    <main>
      <h1>Exportador personalizado</h1>
      <p style={{ opacity: 0.7, marginTop: "-0.5rem" }}>
        Elegí los campos que necesitás y descargá un Excel — sirve para depósitos bancarios, listados para el contador, o cualquier reporte con datos de legajos.
      </p>

      <div style={{ background: "white", border: "1px solid #dfe4e8", padding: "1.2rem", marginBottom: "1.25rem" }}>
        {GRUPOS.map((grupo) => (
          <div key={grupo.titulo} style={{ marginBottom: "1.1rem" }}>
            <h4 style={{ margin: "0 0 0.4rem" }}>{grupo.titulo}</h4>
            <div style={{ display: "flex", gap: "1.2rem", flexWrap: "wrap" }}>
              {grupo.campos.map((c) => (
                <label key={c.clave} title={c.nota} style={{ opacity: c.disponible === false ? 0.45 : 1, fontSize: "0.9rem" }}>
                  <input
                    type="checkbox"
                    disabled={c.disponible === false}
                    checked={seleccionados.has(c.clave)}
                    onChange={() => toggle(c.clave)}
                    style={{ marginRight: "0.35rem" }}
                  />
                  {c.etiqueta}
                  {c.disponible === false && <span style={{ fontSize: "0.75rem" }}> (no disponible)</span>}
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div style={{ background: "white", border: "1px solid #dfe4e8", padding: "1rem", marginBottom: "1.25rem", display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "flex-end" }}>
        <label>
          Período {necesitaPeriodo && <span style={{ color: "var(--rojo)" }}>*</span>}<br />
          <select value={periodoId} onChange={(e) => setPeriodoId(e.target.value)}>
            <option value="">{necesitaPeriodo ? "Elegir..." : "(no hace falta para los campos elegidos)"}</option>
            {periodos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </label>
        <label>
          Convenio (opcional, filtra el listado)<br />
          <select value={convenioId} onChange={(e) => setConvenioId(e.target.value)}>
            <option value="">Todos</option>
            {convenios.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </label>
        <button onClick={descargar} disabled={descargando}>
          {descargando ? "Generando..." : "Descargar Excel"}
        </button>
      </div>

      {error && <p style={{ color: "var(--rojo)" }}>{error}</p>}
    </main>
  );
}
