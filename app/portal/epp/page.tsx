// FM RRHH — app/portal/epp/page.tsx
// El EPP y la ropa de trabajo del empleado: lo que le entregaron y falta
// confirmar, lo que le corresponde con su vencimiento, y el historial.
import { redirect } from "next/navigation";
import { obtenerSesionPortal } from "@/lib/portal";
import { hoyArgentina } from "@/lib/ausencias";
import { eppDelEmpleado, ESTADOS_EPP, type EstadoEpp } from "@/lib/epp";
import { fechaPeriodo } from "../formato";
import Confirmar from "./Confirmar";

export const dynamic = "force-dynamic";
const CHIP: Record<EstadoEpp, string> = { falta: "disconforme", vencido: "disconforme", por_vencer: "pendiente", sin_firmar: "pendiente", vigente: "conforme" };

export default async function PortalEpp() {
  const sesion = await obtenerSesionPortal();
  if (!sesion) redirect("/portal/login");
  const datos = await eppDelEmpleado(sesion.legajoId, hoyArgentina());
  if (!datos) redirect("/portal");
  const pedir = datos.filas.some((f) => f.estado === "falta" || f.estado === "vencido");

  return (
    <>
      <h1>Mis elementos de trabajo</h1>
      <p className="p-sub">La ropa y los elementos de protección que te entrega la empresa.</p>

      {datos.sinFirmar.length > 0 && (
        <div className="p-card" style={{ borderColor: "var(--verde)", borderWidth: 2 }}>
          <div className="p-card-titulo">Confirmá lo que recibiste</div>
          {datos.sinFirmar.map((e) => <div key={e.id} className="p-card-dato">• {e.cantidad > 1 ? `${e.cantidad} × ` : ""}<strong>{e.producto}</strong>{e.tipoModelo && ` — ${e.tipoModelo}`}{e.talle && ` (talle ${e.talle})`} · {fechaPeriodo(e.fechaEntrega)}</div>)}
          <Confirmar ids={datos.sinFirmar.map((e) => e.id)} />
          <div className="p-card-dato" style={{ color: "#6b727b", fontSize: "0.8rem", marginTop: "0.4rem" }}>Si algo no lo recibiste o no es tu talle, no confirmes: avisale a RR.HH. o a tu jefe.</div>
        </div>
      )}

      <h2>Lo que te corresponde</h2>
      {datos.filas.length === 0 && <p className="p-sub">La empresa todavía no definió qué elementos le corresponden a tu puesto.</p>}
      {datos.filas.length > 0 && (
        <div className="p-card" style={{ padding: 0 }}>
          {datos.filas.map((f) => (
            <div key={f.elementoId} style={{ display: "flex", justifyContent: "space-between", gap: "0.7rem", alignItems: "center", padding: "0.65rem 0.9rem", borderBottom: "1px solid var(--gris-claro)" }}>
              <span>
                <span style={{ display: "block", fontWeight: 600 }}>{f.nombre}</span>
                <span style={{ display: "block", fontSize: "0.82rem", color: "#6b727b" }}>{f.ultima ? `Entregado el ${fechaPeriodo(f.ultima.fechaEntrega)}${f.ultima.vence ? ` · se repone el ${fechaPeriodo(f.ultima.vence)}` : ""}` : "Todavía no te lo entregaron"}</span>
              </span>
              <span className={`p-chip ${CHIP[f.estado]}`}>{ESTADOS_EPP[f.estado]}</span>
            </div>
          ))}
        </div>
      )}
      {pedir && <a href="/portal/chat" className="p-btn sec">Pedirle a RR.HH. lo que me falta</a>}

      {datos.historial.length > 0 && (
        <>
          <h2>Historial de entregas</h2>
          <div className="p-card" style={{ padding: 0 }}>
            {datos.historial.slice(0, 40).map((e) => (
              <div key={e.id} style={{ padding: "0.55rem 0.9rem", borderBottom: "1px solid var(--gris-claro)", fontSize: "0.9rem" }}>
                <strong>{e.producto}</strong>{e.cantidad > 1 && ` × ${e.cantidad}`}{e.talle && ` · talle ${e.talle}`}
                <span style={{ display: "block", fontSize: "0.8rem", color: "#6b727b" }}>{fechaPeriodo(e.fechaEntrega)} · {e.firmadoEn ? "confirmado por vos" : e.enPapel ? "firmado en papel" : "sin confirmar"}</span>
              </div>
            ))}
          </div>
        </>
      )}
      <p className="p-pie">Usar los elementos de protección es obligatorio y es para cuidarte. Si alguno se rompe o se desgasta antes de tiempo, pedí el cambio: no esperes al vencimiento.</p>
    </>
  );
}
