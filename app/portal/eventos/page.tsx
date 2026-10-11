// FM RRHH — app/portal/eventos/page.tsx
// Los eventos que vienen: qué, cuándo, dónde, y el botón para avisar si va.
import { redirect } from "next/navigation";
import { obtenerSesionPortal } from "@/lib/portal";
import { hoyArgentina } from "@/lib/ausencias";
import { eventosDe, cuandoEs, motivoNoResponder } from "@/lib/eventos";
import Responder from "./Responder";

export const dynamic = "force-dynamic";

export default async function PortalEventos() {
  const sesion = await obtenerSesionPortal();
  if (!sesion) redirect("/portal/login");
  const hoy = hoyArgentina();
  const eventos = await eventosDe(sesion.legajoId, hoy);

  return (
    <>
      <h1>Eventos</h1>
      {eventos.length === 0 && <p className="p-sub">Por ahora no hay eventos programados.</p>}
      {eventos.map((e) => {
        const cancelado = e.estado === "cancelado";
        const cerrado = motivoNoResponder(e, hoy);
        return (
          <div key={e.id} className="p-card" style={cancelado ? { opacity: 0.7 } : undefined}>
            <div className="p-card-titulo" style={cancelado ? { textDecoration: "line-through" } : undefined}>{e.titulo}</div>
            <div className="p-card-dato">📅 {cuandoEs(e).replace(/^./, (c) => c.toUpperCase())}</div>
            {e.lugar && <div className="p-card-dato">📍 {e.lugar}</div>}
            {e.descripcion && <div className="p-card-dato" style={{ whiteSpace: "pre-wrap", marginTop: "0.4rem" }}>{e.descripcion}</div>}
            {cancelado && <div className="p-aviso error" style={{ marginTop: "0.6rem" }}>Este evento se canceló.</div>}
            {!cancelado && e.pideConfirmacion && (
              <>
                <div className="p-card-dato" style={{ marginTop: "0.4rem", color: "#6b727b" }}>
                  {e.van > 0 && `${e.van === 1 ? "Ya confirmó 1 compañero" : `Ya confirmaron ${e.van} compañeros`}`}{e.van > 0 && e.quedan !== null && " · "}{e.quedan !== null && (e.quedan === 0 ? "No quedan lugares" : e.quedan === 1 ? "Queda 1 lugar" : `Quedan ${e.quedan} lugares`)}
                  {e.limiteConfirmar && !cerrado && <>{(e.van > 0 || e.quedan !== null) && " · "}Confirmá hasta el {e.limiteConfirmar.toLocaleDateString("es-AR", { day: "numeric", month: "long", timeZone: "UTC" })}</>}
                </div>
                <Responder id={e.id} mia={e.mia ? { va: e.mia.va, acompanantes: e.mia.acompanantes } : null} maxAcompanantes={e.maxAcompanantes} cerrado={cerrado} />
              </>
            )}
          </div>
        );
      })}
    </>
  );
}
