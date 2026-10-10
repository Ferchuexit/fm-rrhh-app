// FM RRHH — app/portal/page.tsx
// Inicio del portal: una grilla de "apps", como en el celular. Cada módulo
// nuevo del portal (legajo, noticias...) es un cuadrito más en APPS.
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerSesionPortal, recibosDelEmpleado } from "@/lib/portal";
import { cargarLegajoDigital } from "@/lib/legajo-digital";
import { noticiasPendientes } from "@/lib/noticias";
import AvisosCelular from "./AvisosCelular";

export const dynamic = "force-dynamic";

export default async function PortalInicio() {
  const sesion = await obtenerSesionPortal();
  if (!sesion) redirect("/portal/login");

  // ¿Está en pleno ingreso? Mientras lo esté, "Mi ingreso" va primero.
  const enIngreso = await prisma.ingreso.findFirst({ where: { legajoId: sesion.legajoId, estado: "en_curso" }, select: { tareas: { where: { responsable: "empleado", estado: "pendiente" }, select: { id: true } } } }).catch(() => null);

  // Capacitaciones que le falta confirmar (si falla, el inicio abre igual).
  const capacitacionesSinConfirmar = await prisma.asistenteCapacitacion.count({ where: { legajoId: sesion.legajoId, asistio: true, firmadoEn: null, capacitacion: { estado: "realizada" } } }).catch(() => 0);

  // Evaluaciones: las de su equipo sin completar + las suyas sin firmar.
  const evaluacionesPendientes = await prisma.evaluacion.count({ where: { OR: [{ evaluadorId: sesion.legajoId, estado: "pendiente", ciclo: { estado: "abierto" } }, { legajoId: sesion.legajoId, estado: "entregada" }, { legajoId: sesion.legajoId, autoCompletadaEn: null, estado: { in: ["pendiente", "completada"] }, ciclo: { estado: "abierto", conAutoevaluacion: true } }] } }).catch(() => 0);

  const [recibos, legajoDigital, noticiasNuevas, pedidosPendientes, genteACargo] = await Promise.all([
    recibosDelEmpleado(sesion.legajoId),
    // Si el legajo digital falla (por ejemplo, falta aplicar su migración),
    // el inicio del portal tiene que seguir abriendo: recibos y vacaciones
    // no dependen de eso.
    cargarLegajoDigital(sesion.legajoId).catch((e) => { console.error("Portal: no se pudo cargar el legajo digital:", e); return null; }),
    noticiasPendientes(sesion.legajoId).catch(() => 0),
    prisma.solicitudAusencia.count({ where: { legajoId: sesion.legajoId, estado: "pendiente" } }),
    // .catch: si falta aplicar la migración de jefes, el inicio abre igual.
    prisma.legajo.count({ where: { jefeId: sesion.legajoId, condicion: "activo" } }).catch(() => 0),
  ]);
  const sinFirmar = recibos.filter((r) => !r.reciboDigital?.firma).length;
  const pendientesLegajo = legajoDigital?.resumen.pendientesEmpleado ?? 0;

  // globo = cosas que esperan una acción DEL EMPLEADO (no de RR.HH.).
  const APPS = [
    ...(enIngreso ? [{ href: "/portal/ingreso", icono: "🚀", label: "Mi ingreso", globo: enIngreso.tareas.length }] : []),
    { href: "/portal/noticias", icono: "📣", label: "Noticias", globo: noticiasNuevas },
    { href: "/portal/recibos", icono: "🧾", label: "Recibos", globo: sinFirmar },
    { href: "/portal/vacaciones", icono: "🏖️", label: "Vacaciones y permisos", globo: 0 },
    { href: "/portal/horario", icono: "🕒", label: "Mi horario", globo: 0 },
    { href: "/portal/capacitaciones", icono: "🎓", label: "Capacitaciones", globo: capacitacionesSinConfirmar },
    { href: "/portal/evaluaciones", icono: "📊", label: "Evaluaciones", globo: evaluacionesPendientes },
    { href: "/portal/objetivos", icono: "🎯", label: "Objetivos", globo: 0 },
    // Solo para quien tiene gente a cargo ("Reporta a" en el legajo).
    ...(genteACargo > 0 ? [{ href: "/portal/equipo", icono: "👥", label: "Mi equipo", globo: 0 }] : []),
    { href: "/portal/legajo", icono: "📁", label: "Mi legajo", globo: pendientesLegajo },
    { href: "/portal/cambiar-pin", icono: "🔑", label: "Mi PIN", globo: 0 },
  ];

  return (
    <>
      <h1>Hola, {sesion.nombre.split(" ")[0]}</h1>

      {noticiasNuevas > 0 && (
        <a href="/portal/noticias" className="p-aviso info" style={{ display: "block", textDecoration: "none" }}>
          Hay <strong>{noticiasNuevas} {noticiasNuevas === 1 ? "noticia nueva" : "noticias nuevas"}</strong> ›
        </a>
      )}
      {sinFirmar > 0 ? (
        <a href="/portal/recibos" className="p-aviso pendiente" style={{ display: "block", textDecoration: "none" }}>
          Tenés <strong>{sinFirmar} {sinFirmar === 1 ? "recibo" : "recibos"}</strong> para firmar ›
        </a>
      ) : pendientesLegajo > 0 ? (
        <a href="/portal/legajo" className="p-aviso pendiente" style={{ display: "block", textDecoration: "none" }}>
          A tu legajo le {pendientesLegajo === 1 ? "falta 1 cosa" : `faltan ${pendientesLegajo} cosas`} que dependen de vos ›
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
      <AvisosCelular />
    </>
  );
}
