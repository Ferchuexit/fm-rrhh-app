// FM RRHH — app/portal/capacitaciones/page.tsx
// Capacitaciones del empleado: las que tiene que confirmar, las que vienen,
// para qué está habilitado (y qué se le vence) y su historial.
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerSesionPortal } from "@/lib/portal";
import { hoyArgentina } from "@/lib/ausencias";
import { NIVELES, TIPOS_CAPACITACION, estadoHabilidad } from "@/lib/capacitaciones-reglas";
import { fechaPeriodo, fechaHora } from "../formato";
import ConfirmarCapacitacion from "./ConfirmarCapacitacion";

export const dynamic = "force-dynamic";

export default async function PortalCapacitaciones() {
  const sesion = await obtenerSesionPortal();
  if (!sesion) redirect("/portal/login");
  const hoy = hoyArgentina();

  const [asistencias, habilidades] = await Promise.all([
    prisma.asistenteCapacitacion.findMany({ where: { legajoId: sesion.legajoId, capacitacion: { estado: { not: "cancelada" } } }, include: { capacitacion: true }, orderBy: { capacitacion: { fecha: "desc" } }, take: 100 }),
    prisma.habilidadLegajo.findMany({ where: { legajoId: sesion.legajoId }, include: { habilidad: { select: { nombre: true, grupo: true } } }, orderBy: { habilidad: { nombre: "asc" } } }),
  ]);
  const paraConfirmar = asistencias.filter((a) => a.capacitacion.estado === "realizada" && a.asistio && !a.firmadoEn);
  const proximas = asistencias.filter((a) => a.capacitacion.estado === "programada" && a.capacitacion.fecha >= hoy).reverse();
  const hechas = asistencias.filter((a) => a.capacitacion.estado === "realizada" && a.asistio && a.firmadoEn);

  const detalle = (c: (typeof asistencias)[number]["capacitacion"]) => `${fechaPeriodo(c.fecha)}${c.horas ? ` · ${c.horas} hs` : ""}${c.instructor ? ` · dicta ${c.instructor}` : ""}${c.lugar ? ` · ${c.lugar}` : ""}`;

  return (
    <>
      <h1>Capacitaciones</h1>

      {paraConfirmar.length > 0 && <h2>Para confirmar ({paraConfirmar.length})</h2>}
      {paraConfirmar.map((a) => (
        <div key={a.id} className="p-card">
          <div className="p-card-titulo">{a.capacitacion.titulo}</div>
          <div className="p-card-dato">{TIPOS_CAPACITACION[a.capacitacion.tipo] ?? a.capacitacion.tipo} · {detalle(a.capacitacion)}</div>
          {a.capacitacion.descripcion && <div className="p-card-dato" style={{ whiteSpace: "pre-wrap" }}>{a.capacitacion.descripcion}</div>}
          <ConfirmarCapacitacion id={a.capacitacionId} />
          <p className="p-pie" style={{ margin: "0.5rem 0 0" }}>Queda registrado con la fecha y la hora. Si no la recibiste, no confirmes: avisale a RR.HH.</p>
        </div>
      ))}

      <h2>Próximas</h2>
      {proximas.length === 0 && <p className="p-sub">No tenés capacitaciones programadas.</p>}
      {proximas.map((a) => (
        <div key={a.id} className="p-card">
          <div className="p-card-titulo">{a.capacitacion.titulo}</div>
          <div className="p-card-dato">{detalle(a.capacitacion)}</div>
          {a.capacitacion.descripcion && <div className="p-card-dato" style={{ whiteSpace: "pre-wrap" }}>{a.capacitacion.descripcion}</div>}
        </div>
      ))}

      <h2>Para qué estoy habilitado</h2>
      {habilidades.length === 0 && <p className="p-sub">Todavía no tenés habilidades cargadas.</p>}
      {habilidades.length > 0 && (
        <div className="p-card" style={{ padding: 0 }}>
          {habilidades.map((h) => {
            const estado = estadoHabilidad(h.vence, hoy);
            return (
              <div key={h.id} style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", padding: "0.65rem 0.9rem", borderBottom: "1px solid var(--gris-claro)" }}>
                <span>
                  {h.habilidad.nombre}
                  <span style={{ display: "block", fontSize: "0.78rem", color: estado === "vencida" ? "#8d2a2a" : estado === "por_vencer" ? "#8a5413" : "#6b727b" }}>
                    {h.vence ? `${estado === "vencida" ? "Venció" : "Vence"} el ${fechaPeriodo(h.vence)}${estado === "vencida" ? " — hay que renovarla" : ""}` : "No vence"}
                  </span>
                </span>
                <span className="p-chip" style={{ background: NIVELES[h.nivel]?.color, color: h.nivel === 4 ? "white" : "#12202e", alignSelf: "center" }}>{NIVELES[h.nivel]?.corto}</span>
              </div>
            );
          })}
        </div>
      )}

      {hechas.length > 0 && (
        <>
          <h2>Mi historial</h2>
          {hechas.map((a) => (
            <div key={a.id} className="p-card">
              <div className="p-card-titulo">{a.capacitacion.titulo}</div>
              <div className="p-card-dato">{detalle(a.capacitacion)}</div>
              <div className="p-card-dato"><span className="p-chip conforme">Confirmada el {fechaHora(a.firmadoEn!)}</span></div>
            </div>
          ))}
        </>
      )}
    </>
  );
}
