// FM RRHH — app/portal/reclamos/page.tsx
// Los reclamos de haberes del empleado: hacer uno nuevo (sobre un recibo,
// eligiendo los motivos) y ver la respuesta de los anteriores.
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerSesionPortal } from "@/lib/portal";
import { reclamosDelEmpleado, recibosParaReclamar, motivosDeEmpresa, textoCantidad, ESTADOS_RECLAMO, type ItemReclamo } from "@/lib/reclamos";
import { fechaPeriodo } from "../formato";
import NuevoReclamo from "./NuevoReclamo";

export const dynamic = "force-dynamic";
const CHIP: Record<string, string> = { pendiente: "pendiente", aprobado: "conforme", parcial: "pendiente", rechazado: "disconforme" };

export default async function PortalReclamos({ searchParams }: { searchParams: { recibo?: string } }) {
  const sesion = await obtenerSesionPortal();
  if (!sesion) redirect("/portal/login");
  const [reclamos, recibos, { motivos }] = await Promise.all([reclamosDelEmpleado(sesion.legajoId), recibosParaReclamar(sesion.legajoId), motivosDeEmpresa(sesion.empresaId)]);
  // Lo que ya respondieron queda visto al abrir la pantalla.
  if (reclamos.some((r) => r.estado !== "pendiente" && !r.vistoEn)) await prisma.reclamoHaberes.updateMany({ where: { legajoId: sesion.legajoId, estado: { not: "pendiente" }, vistoEn: null }, data: { vistoEn: new Date() } });
  const reciboElegido = recibos.some((r) => r.id === searchParams.recibo) ? searchParams.recibo! : "";

  return (
    <>
      <a className="p-link" href="/portal/recibos">← Mis recibos</a>
      <h1>Reclamos de haberes</h1>
      <p className="p-sub">Si en tu recibo falta algo o hay algo de más, contalo acá. RR.HH. lo revisa y te responde por este mismo lugar.</p>

      <NuevoReclamo recibos={recibos.map((r) => ({ id: r.id, nombre: r.periodo.nombre }))} motivos={motivos.filter((m) => m.activo).map((m) => ({ id: m.id, nombre: m.nombre, unidad: m.unidad }))} reciboInicial={reciboElegido} abierto={!!reciboElegido} />

      {reclamos.length > 0 && <h2>Mis reclamos</h2>}
      {reclamos.map((r) => {
        const items = r.items as unknown as ItemReclamo[];
        return (
          <div key={r.id} className="p-card">
            <div style={{ display: "flex", justifyContent: "space-between", gap: "0.6rem", alignItems: "baseline" }}>
              <div className="p-card-titulo">{r.periodoNombre ? `Recibo ${r.periodoNombre}` : "Reclamo general"}</div>
              <span className={`p-chip ${CHIP[r.estado] ?? "pendiente"}`}>{ESTADOS_RECLAMO[r.estado] ?? r.estado}</span>
            </div>
            <div className="p-card-dato" style={{ color: "#6b727b", fontSize: "0.8rem" }}>Enviado el {fechaPeriodo(r.createdAt)}</div>
            {items.map((it) => (
              <div key={it.motivoId} className="p-card-dato">
                • {it.motivo}{it.cantidad !== null ? `: ${textoCantidad(it.unidad, it.cantidad)}` : ""}{it.detalle ? ` — ${it.detalle}` : ""}
                {r.estado !== "pendiente" && <strong style={{ color: it.aprobado ? "#215446" : "#8d2a2a" }}> · {it.aprobado ? `aprobado${it.cantidadAprobada !== null && it.cantidadAprobada !== undefined && it.cantidadAprobada !== it.cantidad ? ` (${textoCantidad(it.unidad, it.cantidadAprobada)})` : ""}` : "no corresponde"}</strong>}
              </div>
            ))}
            {r.comentario && <div className="p-card-dato" style={{ fontStyle: "italic" }}>“{r.comentario}”</div>}
            {r.estado !== "pendiente" && (
              <div className={`p-aviso ${r.estado === "rechazado" ? "error" : "ok"}`} style={{ marginTop: "0.6rem", marginBottom: 0 }}>
                {r.respuesta && <div>{r.respuesta}</div>}
                {r.estado !== "rechazado" && r.periodoAjuste && <div><strong>Se ajusta en la liquidación de {r.periodoAjuste}.</strong></div>}
                {r.resueltoEn && <div style={{ fontSize: "0.8rem", marginTop: 4 }}>Respondido el {fechaPeriodo(r.resueltoEn)}</div>}
              </div>
            )}
          </div>
        );
      })}
      <p className="p-pie">Tenés dos años para reclamar diferencias de sueldo. Si no estás de acuerdo con la respuesta, podés consultar a tu delegado o a RR.HH. por el chat.</p>
    </>
  );
}
