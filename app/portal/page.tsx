// FM RRHH — app/portal/page.tsx
// Inicio del portal: una grilla de "apps", como en el celular. Cada módulo
// nuevo del portal (legajo, noticias...) es un cuadrito más en APPS.
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerSesionPortal, recibosDelEmpleado } from "@/lib/portal";
import { cargarLegajoDigital } from "@/lib/legajo-digital";
import { noticiasPendientes } from "@/lib/noticias";
import AvisosCelular from "./AvisosCelular";

import { encuestasPendientesDe } from "@/lib/encuestas";
import { busquedasInternas, busquedasConReferidos } from "@/lib/reclutamiento";
import { eventosDe } from "@/lib/eventos";
import { festejosDeHoy, textoCelebracion } from "@/lib/cultura";
import { hoyArgentina } from "@/lib/ausencias-reglas";
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

  // Quién festeja hoy (cumpleaños o aniversario), para el saludo de arriba.
  const festejos = await festejosDeHoy(sesion.empresaId, hoyArgentina()).catch(() => []);
  const eventosPorVenir = await eventosDe(sesion.legajoId, hoyArgentina()).catch(() => []);
  const eventosPendientes = eventosPorVenir.filter((e) => e.estado === "publicado" && e.pideConfirmacion && !e.mia && (e.limiteConfirmar ?? e.fecha) >= hoyArgentina()).length;
  const conReferidos = await busquedasConReferidos(sesion.empresaId).then((b) => b.length).catch(() => 0);
  const empleosInternos = await busquedasInternas(sesion.empresaId).then((b) => b.length).catch(() => 0);
  const encuestasPendientes = await encuestasPendientesDe(sesion.legajoId).then((e) => e.length).catch(() => 0);

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
    { href: "/portal/muro", icono: "👏", label: "Muro", globo: 0 },
    ...(eventosPorVenir.length > 0 ? [{ href: "/portal/eventos", icono: "📅", label: "Eventos", globo: eventosPendientes }] : []),
    ...(conReferidos > 0 ? [{ href: "/portal/referidos", icono: "🤝", label: "Recomendá", globo: 0 }] : []),
    ...(empleosInternos > 0 ? [{ href: "/portal/empleos", icono: "🔎", label: "Empleos", globo: 0 }] : []),
    // Solo aparece cuando hay alguna para responder.
    ...(encuestasPendientes > 0 ? [{ href: "/portal/encuestas", icono: "📋", label: "Encuestas", globo: encuestasPendientes }] : []),
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

      {festejos.length > 0 && (
        <a href="/portal/muro" className="p-aviso ok" style={{ display: "block", textDecoration: "none" }}>
          🎉 {festejos.some((c) => c.legajoId === sesion.legajoId) ? (festejos.find((c) => c.legajoId === sesion.legajoId)!.tipo === "cumple" ? "¡Feliz cumpleaños!" : "¡Feliz aniversario con nosotros!") : festejos.length === 1 ? `Hoy ${textoCelebracion(festejos[0])}` : `Hoy hay ${festejos.length} festejos`} ›
        </a>
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
