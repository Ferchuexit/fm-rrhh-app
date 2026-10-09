// FM RRHH — app/portal/vacaciones/page.tsx
// Vacaciones y permisos del empleado: saldo, pedir, y seguir sus pedidos.
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerSesionPortal } from "@/lib/portal";
import { saldoVacaciones, hoyArgentina } from "@/lib/ausencias";
import { fechaPeriodo } from "../formato";
import PedidoForm from "./PedidoForm";
import CancelarPedido from "./CancelarPedido";

export const dynamic = "force-dynamic";

const TEXTO_ESTADO: Record<string, string> = { pendiente: "Esperando respuesta", aprobada: "Aprobado", rechazada: "Rechazado", cancelada: "Cancelado por vos" };

export default async function PortalVacaciones() {
  const sesion = await obtenerSesionPortal();
  if (!sesion) redirect("/portal/login");

  const hoy = hoyArgentina();
  const anio = hoy.getUTCFullYear();
  const [saldo, saldoProximo, solicitudes, vacaciones] = await Promise.all([
    saldoVacaciones(sesion.legajoId, anio),
    saldoVacaciones(sesion.legajoId, anio + 1),
    prisma.solicitudAusencia.findMany({ where: { legajoId: sesion.legajoId }, orderBy: { createdAt: "desc" }, take: 30 }),
    prisma.vacacion.findMany({ where: { legajoId: sesion.legajoId, fechaHasta: { gte: hoy } }, orderBy: { fechaDesde: "asc" } }),
  ]);

  return (
    <>
      <h1>Vacaciones y permisos</h1>

      <div className="p-card">
        <strong style={{ color: "var(--azul-oscuro)" }}>Vacaciones {anio}</strong>
        <div className="p-saldo">
          <div><strong>{saldo.corresponden}</strong>te corresponden</div>
          <div><strong>{saldo.registrados + saldo.enTramite}</strong>tomados o pedidos</div>
          <div className="dest"><strong>{saldo.disponibles}</strong>disponibles</div>
        </div>
        <p className="p-pie" style={{ marginBottom: 0 }}>
          Son días corridos (cuentan sábados, domingos y feriados). El cálculo es por tu antigüedad; ante cualquier duda, vale lo que te confirme RR.HH.
        </p>
      </div>

      {vacaciones.length > 0 && (
        <>
          <h2>Próximas vacaciones</h2>
          {vacaciones.map((v) => (
            <div key={v.id} className="p-card">
              <div className="p-card-titulo">{fechaPeriodo(v.fechaDesde)} al {fechaPeriodo(v.fechaHasta)}</div>
              <div className="p-card-dato">{v.diasCorresponden} días · corresponden al año {v.anioCorresponde}</div>
            </div>
          ))}
        </>
      )}

      <h2>Hacer un pedido</h2>
      <PedidoForm
        hoy={hoy.toISOString().slice(0, 10)}
        saldos={{ [anio]: saldo.disponibles, [anio + 1]: saldoProximo.disponibles }}
      />

      <h2>Mis pedidos</h2>
      {solicitudes.length === 0 && <p className="p-sub">Todavía no hiciste ningún pedido.</p>}
      {solicitudes.map((s) => (
        <div key={s.id} className="p-card">
          <div className="p-card-titulo">
            {s.tipo === "vacaciones" ? "Vacaciones" : "Permiso"} · {fechaPeriodo(s.fechaDesde)}{s.dias > 1 ? ` al ${fechaPeriodo(s.fechaHasta)}` : ""}
          </div>
          <div className="p-card-dato">
            {s.dias} {s.dias === 1 ? "día" : "días"}{s.motivo ? ` · ${s.motivo}` : ""}
          </div>
          <div className="p-card-dato"><span className={`p-chip ${s.estado}`}>{TEXTO_ESTADO[s.estado] ?? s.estado}</span></div>
          {s.respuesta && <div className="p-respuesta"><strong>RR.HH.:</strong> {s.respuesta}</div>}
          {s.estado === "pendiente" && <CancelarPedido id={s.id} />}
        </div>
      ))}
    </>
  );
}
