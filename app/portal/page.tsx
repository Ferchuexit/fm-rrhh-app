// FM RRHH — app/portal/page.tsx
// Inicio del portal: una grilla de "apps", como en el celular. Cada módulo
// nuevo del portal (legajo, noticias...) es un cuadrito más en APPS.
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerSesionPortal, recibosDelEmpleado } from "@/lib/portal";
import { cargarLegajoDigital } from "@/lib/legajo-digital";

export const dynamic = "force-dynamic";

export default async function PortalInicio() {
  const sesion = await obtenerSesionPortal();
  if (!sesion) redirect("/portal/login");

  const [recibos, legajoDigital, pedidosPendientes] = await Promise.all([
    recibosDelEmpleado(sesion.legajoId),
    cargarLegajoDigital(sesion.legajoId),
    prisma.solicitudAusencia.count({ where: { legajoId: sesion.legajoId, estado: "pendiente" } }),
  ]);
  const sinFirmar = recibos.filter((r) => !r.reciboDigital?.firma).length;

  // globo = cosas que esperan una acción DEL EMPLEADO (no de RR.HH.).
  const APPS = [
    { href: "/portal/recibos", icono: "🧾", label: "Recibos", globo: sinFirmar },
    { href: "/portal/vacaciones", icono: "🏖️", label: "Vacaciones y permisos", globo: 0 },
    { href: "/portal/legajo", icono: "📁", label: "Mi legajo", globo: legajoDigital.resumen.pendientesEmpleado },
    { href: "/portal/cambiar-pin", icono: "🔑", label: "Mi PIN", globo: 0 },
  ];

  return (
    <>
      <h1>Hola, {sesion.nombre.split(" ")[0]}</h1>

      {sinFirmar > 0 ? (
        <a href="/portal/recibos" className="p-aviso pendiente" style={{ display: "block", textDecoration: "none" }}>
          Tenés <strong>{sinFirmar} {sinFirmar === 1 ? "recibo" : "recibos"}</strong> para firmar ›
        </a>
      ) : legajoDigital.resumen.pendientesEmpleado > 0 ? (
        <a href="/portal/legajo" className="p-aviso pendiente" style={{ display: "block", textDecoration: "none" }}>
          A tu legajo le {legajoDigital.resumen.pendientesEmpleado === 1 ? "falta 1 cosa" : `faltan ${legajoDigital.resumen.pendientesEmpleado} cosas`} que dependen de vos ›
        </a>
      ) : pedidosPendientes > 0 ? (
        <a href="/portal/vacaciones" className="p-aviso info" style={{ display: "block", textDecoration: "none" }}>
          Tenés {pedidosPendientes} {pedidosPendientes === 1 ? "pedido esperando" : "pedidos esperando"} respuesta de RR.HH. ›
        </a>
      ) : (
        <p className="p-sub">Estás al día. ¿Qué necesitás?</p>
      )}

      <div className="p-apps">
        {APPS.map((a) => (
          <a key={a.href} href={a.href} className="p-app">
            <span className="p-app-ico">
              <span aria-hidden="true">{a.icono}</span>
              {a.globo > 0 && <span className="p-globo" aria-label={`${a.globo} pendientes`}>{a.globo}</span>}
            </span>
            {a.label}
          </a>
        ))}
      </div>
    </>
  );
}
