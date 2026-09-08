"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

// FM RRHH — app/liquidacion-individual/AgregarConcepto.tsx
// Punto 3 del rediseño (mitad "agregar"). Usa un <datalist> nativo para el
// autocompletado código↔descripción — el navegador filtra sugerencias
// tanto por el código (value) como por la descripción (label), así que
// escribir cualquiera de los dos encuentra el concepto. Es más simple que
// armar un combobox propio, a costa de no controlar 100% cómo cada
// navegador arma la sugerencia visualmente.
interface ConceptoDisponible {
  codigo: string;
  numero: number | null;
  nombre: string;
  tipo: string;
}

export default function AgregarConcepto({ liquidacionId, conceptosDisponibles }: { liquidacionId: string; conceptosDisponibles: ConceptoDisponible[] }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [importe, setImporte] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const conceptoElegido = conceptosDisponibles.find((c) => c.codigo === codigo);

  async function agregar() {
    if (!conceptoElegido) {
      setError("Elegí un concepto de la lista (o escribí su código exacto).");
      return;
    }
    if (!importe || isNaN(Number(importe))) {
      setError("Falta el importe.");
      return;
    }
    setEnviando(true);
    setError(null);
    let data: any;
    try {
      const res = await fetch("/api/liquidacion-individual/agregar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ liquidacionId, conceptoCodigo: codigo, importe: Number(importe) }),
      });
      data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error ?? "Error inesperado.");
        setEnviando(false);
        return;
      }
    } catch {
      setError("El servidor no devolvió una respuesta válida.");
      setEnviando(false);
      return;
    }
    setEnviando(false);
    setAbierto(false);
    setCodigo("");
    setImporte("");
    if (data.advertencias?.length > 0) alert(data.advertencias.join("\n\n"));
    router.refresh();
  }

  if (!abierto) {
    return (
      <button onClick={() => setAbierto(true)} style={{ fontSize: "0.85rem" }}>
        + Agregar concepto
      </button>
    );
  }

  return (
    <div style={{ background: "#EEF1F4", border: "1px solid #dfe4e8", padding: "0.75rem", maxWidth: "600px", marginBottom: "1rem" }}>
      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
        <input
          list="conceptos-disponibles"
          placeholder="Código o descripción del concepto"
          value={codigo}
          onChange={(e) => setCodigo(e.target.value)}
          style={{ width: "260px" }}
          autoFocus
        />
        <datalist id="conceptos-disponibles">
          {conceptosDisponibles.map((c) => (
            <option key={c.codigo} value={c.codigo} label={`${c.numero ?? "s/n"} — ${c.nombre}`} />
          ))}
        </datalist>
        <input type="number" step="0.01" placeholder="Importe" value={importe} onChange={(e) => setImporte(e.target.value)} style={{ width: "120px" }} />
        <button disabled={enviando} onClick={agregar}>{enviando ? "Agregando..." : "Agregar"}</button>
        <button disabled={enviando} onClick={() => setAbierto(false)}>Cancelar</button>
      </div>
      {conceptoElegido && (
        <p style={{ fontSize: "0.8rem", opacity: 0.7, margin: "0.4rem 0 0" }}>
          {conceptoElegido.nombre} — {conceptoElegido.tipo === "remunerativo" ? "remunerativo" : "no remunerativo"}
        </p>
      )}
      {error && <p style={{ color: "#B23A3A", fontSize: "0.8rem", margin: "0.4rem 0 0" }}>{error}</p>}
    </div>
  );
}
