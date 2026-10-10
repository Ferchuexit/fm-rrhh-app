// FM RRHH — app/portal/equipo/page.tsx
// "Mi equipo": la gente que reporta directo a quien está logueado. El jefe
// ve saldos y ausencias de su gente y pide sus vacaciones; RR.HH. decide.
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerSesionPortal } from "@/lib/portal";
import { equipoDe } from "@/lib/equipo";
import { saldoVacaciones, hoyArgentina } from "@/lib/ausencias";
import { horariosDeEmpresa, jornadaDelDia, vistaDeJornada } from "@/lib/turnos";
import { fechaPeriodo } from "../formato";
import PedidoForm from "../vacaciones/PedidoForm";
import CancelarPedido from "../vacaciones/CancelarPedido";

export const dynamic = "force-dynamic";

const TEXTO_ESTADO: Record<string, string> = { pendiente: "Esperando a RR.HH.", aprobada: "Aprobado", rechazada: "Rechazado", cancelada: "Cancelado" };

export default async function PortalEquipo() {
  const sesion = await obtenerSesionPortal();
  if (!sesion) redirect("/portal/login");

  const equipo = await equipoDe(sesion.legajoId);
  if (equipo.length === 0) {
    return (
      <>
        <h1>Mi equipo</h1>
        <p className="p-sub">No tenés gente a cargo cargada en el sistema. Si es un error, avisale a RR.HH.</p>
      </>
    );
  }

  const hoy = hoyArgentina();
  const anio = hoy.getUTCFullYear();
  const ids = equipo.map((m) => m.id);
  // Qué turno tiene hoy cada uno. Si falla (falta la migración de turnos),
  // la pantalla sigue sin ese dato.
  const turnoDeHoy = new Map<string, string>();
  try {
    const [horarios, asignaciones] = await Promise.all([horariosDeEmpresa(sesion.empresaId), prisma.asignacionHorario.findMany({ where: { legajoId: { in: ids } } })]);
    for (const id of ids) {
      const j = vistaDeJornada(jornadaDelDia(hoy, asignaciones.filter((a) => a.legajoId === id), horarios));
      if (j.tipo === "trabaja") turnoDeHoy.set(id, `Hoy: ${j.ingreso} a ${j.salida} (${j.horario})`);
      else if (j.tipo === "franco") turnoDeHoy.set(id, "Hoy: franco");
    }
  } catch (e) {
    console.error("Portal equipo: no se pudieron cargar los turnos:", e);
  }

  const [saldos, vacaciones, pedidos] = await Promise.all([
    Promise.all(equipo.map(async (m) => ({ id: m.id, actual: await saldoVacaciones(m.id, anio), proximo: await saldoVacaciones(m.id, anio + 1) }))),
    prisma.vacacion.findMany({ where: { legajoId: { in: ids }, fechaHasta: { gte: hoy } }, orderBy: { fechaDesde: "asc" } }),
    prisma.solicitudAusencia.findMany({ where: { legajoId: { in: ids } }, orderBy: { createdAt: "desc" }, take: 40 }),
  ]);
  const nombre = (id: string) => { const m = equipo.find((e) => e.id === id)!; return `${m.apellido}, ${m.nombre}`; };
  const saldoDe = (id: string) => saldos.find((s) => s.id === id)!;

  return (
    <>
      <h1>Mi equipo</h1>
      <p className="p-sub">Vos pedís las vacaciones de tu gente y RR.HH. las aprueba o no. Hasta que RR.HH. responda, no están confirmadas.</p>

      {equipo.map((m) => {
        const s = saldoDe(m.id).actual;
        const proximas = vacaciones.filter((v) => v.legajoId === m.id);
        return (
          <div key={m.id} className="p-card">
            <div className="p-card-titulo">{m.apellido}, {m.nombre}</div>
            {turnoDeHoy.has(m.id) && <div className="p-card-dato">🕒 {turnoDeHoy.get(m.id)}</div>}
            <div className="p-card-dato">
              Vacaciones {anio}: <strong>{s.disponibles}</strong> disponibles de {s.corresponden}
              {s.enTramite > 0 ? ` · ${s.enTramite} esperando a RR.HH.` : ""}
            </div>
            {proximas.map((v) => (
              <div key={v.id} className="p-card-dato">🏖️ {fechaPeriodo(v.fechaDesde)} al {fechaPeriodo(v.fechaHasta)} ({v.diasCorresponden} días)</div>
            ))}
          </div>
        );
      })}

      <h2>Pedir vacaciones para alguien del equipo</h2>
      <PedidoForm
        hoy={hoy.toISOString().slice(0, 10)}
        equipo={equipo.map((m) => ({ id: m.id, nombre: `${m.apellido}, ${m.nombre}`, saldos: { [anio]: saldoDe(m.id).actual.disponibles, [anio + 1]: saldoDe(m.id).proximo.disponibles } }))}
      />

      <h2>Pedidos del equipo</h2>
      {pedidos.length === 0 && <p className="p-sub">Todavía no hay pedidos.</p>}
      {pedidos.map((p) => {
        const mio = p.solicitadoPorId === sesion.legajoId;
        return (
          <div key={p.id} className="p-card">
            <div className="p-card-titulo">{nombre(p.legajoId)}</div>
            <div className="p-card-dato">
              {p.tipo === "vacaciones" ? "Vacaciones" : "Permiso"} · {fechaPeriodo(p.fechaDesde)}{p.dias > 1 ? ` al ${fechaPeriodo(p.fechaHasta)}` : ""} · {p.dias} {p.dias === 1 ? "día" : "días"}
            </div>
            {/* El motivo de un permiso que pidió el empleado es entre él y RR.HH.: al jefe le alcanza con las fechas. */}
            {mio && p.motivo && <div className="p-card-dato">{p.motivo}</div>}
            <div className="p-card-dato"><span className={`p-chip ${p.estado}`}>{TEXTO_ESTADO[p.estado] ?? p.estado}</span>{!mio ? " · Lo pidió la persona" : ""}</div>
            {mio && p.respuesta && <div className="p-respuesta"><strong>RR.HH.:</strong> {p.respuesta}</div>}
            {mio && p.estado === "pendiente" && <CancelarPedido id={p.id} />}
          </div>
        );
      })}
    </>
  );
}
