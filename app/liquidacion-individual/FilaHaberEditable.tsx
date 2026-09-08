"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

// FM RRHH — app/liquidacion-individual/FilaHaberEditable.tsx
// Una fila de la tabla de Haberes de Liquidación Individual, con las
// acciones de los puntos 3 y 4 del rediseño: forzar importe, restaurar,
// excluir, reincluir. Cada acción pega a /api/liquidacion-individual/editar
// y refresca los datos del servidor (router.refresh()) para traer el
// recálculo real hecho por el motor — no hay ningún cálculo del lado del
// cliente, esto es solo la UI.

interface Props {
  detalleId: string;
  codigo: string;
  conceptoCodigo: string;
  convenioId: string;
  nombre: string;
  cant: string;
  importe: number;
  importeCalculado: number | null;
  forzado: boolean;
  excluido: boolean;
  origen: string; // 'motor' | 'manual'
  tipo: "remunerativo" | "no_remunerativo";
  periodoAbierto: boolean;
}

function money(n: number) {
  return n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function FilaHaberEditable(props: Props) {
  const router = useRouter();
  const [modoForzar, setModoForzar] = useState(false);
  const [valorForzado, setValorForzado] = useState(String(props.importe));
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enviarAccion(accion: "forzar" | "restaurar" | "excluir" | "reincluir", valor?: number) {
    setEnviando(true);
    setError(null);
    let data: any;
    try {
      const res = await fetch("/api/liquidacion-individual/editar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ liquidacionDetalleId: props.detalleId, accion, valor }),
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
    setModoForzar(false);
    setEnviando(false);
    if (data.advertencias?.length > 0) alert(data.advertencias.join("\n\n"));
    router.refresh();
  }

  const esManual = props.origen === "manual";

  return (
    <tr style={{ borderBottom: "1px solid #eee", opacity: props.excluido ? 0.45 : 1 }}>
      <td>{props.codigo}</td>
      <td>
        {props.excluido ? <s>{props.nombre}</s> : props.nombre}
        {props.forzado && !props.excluido && (
          <span style={{ marginLeft: "0.4rem", fontSize: "0.7rem", background: "#fdf2ea", color: "#B8752B", padding: "0 0.3rem", borderRadius: "3px" }}>
            forzado
          </span>
        )}
        {esManual && (
          <span style={{ marginLeft: "0.4rem", fontSize: "0.7rem", background: "#EEF1F4", color: "#163A5C", padding: "0 0.3rem", borderRadius: "3px" }}>
            manual
          </span>
        )}
      </td>
      <td style={{ opacity: 0.7 }}>{props.cant}</td>
      <td style={{ textAlign: "right" }}>{props.tipo === "remunerativo" ? money(props.importe) : ""}</td>
      <td style={{ textAlign: "right" }}>{props.tipo === "no_remunerativo" ? money(props.importe) : ""}</td>
      <td style={{ fontSize: "0.8rem" }}>
        {!props.periodoAbierto ? (
          <span style={{ opacity: 0.4 }}>Período cerrado</span>
        ) : modoForzar ? (
          <span style={{ display: "flex", gap: "0.3rem", alignItems: "center" }}>
            <input type="number" step="0.01" value={valorForzado} onChange={(e) => setValorForzado(e.target.value)} style={{ width: "100px" }} autoFocus />
            <button disabled={enviando} onClick={() => enviarAccion("forzar", Number(valorForzado))}>OK</button>
            <button disabled={enviando} onClick={() => setModoForzar(false)}>×</button>
          </span>
        ) : props.excluido ? (
          <button disabled={enviando} onClick={() => enviarAccion("reincluir")}>
            {enviando ? "..." : "Reincluir"}
          </button>
        ) : props.forzado ? (
          <span style={{ display: "flex", gap: "0.4rem", alignItems: "center", flexWrap: "wrap" }}>
            {props.importeCalculado != null && <span style={{ opacity: 0.6 }}>fórmula: {money(props.importeCalculado)}</span>}
            <button disabled={enviando} onClick={() => enviarAccion("restaurar")}>
              {enviando ? "..." : "Restaurar"}
            </button>
            {!esManual && (
              <a href={`/reglas?conceptoCodigo=${props.conceptoCodigo}&convenioId=${props.convenioId}`} target="_blank" rel="noopener noreferrer" title="Ver/editar la fórmula en /reglas">
                ƒ
              </a>
            )}
          </span>
        ) : (
          <span style={{ display: "flex", gap: "0.4rem" }}>
            <button
              disabled={enviando}
              onClick={() => {
                setValorForzado(String(props.importe));
                setModoForzar(true);
              }}
            >
              {esManual ? "Editar importe" : "Forzar"}
            </button>
            <button
              disabled={enviando}
              onClick={() => {
                if (confirm(`¿Excluir "${props.nombre}" de este recibo?`)) enviarAccion("excluir");
              }}
            >
              Excluir
            </button>
            {!esManual && (
              <a href={`/reglas?conceptoCodigo=${props.conceptoCodigo}&convenioId=${props.convenioId}`} target="_blank" rel="noopener noreferrer" title="Ver/editar la fórmula en /reglas">
                ƒ
              </a>
            )}
          </span>
        )}
        {error && <div style={{ color: "#B23A3A", fontSize: "0.75rem", marginTop: "0.2rem" }}>{error}</div>}
      </td>
    </tr>
  );
}
