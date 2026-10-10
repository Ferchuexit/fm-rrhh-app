// FM RRHH — app/portal/objetivos/page.tsx
// Objetivos en el portal:
//   - los MÍOS, con mi plan de carrera (a qué puesto apunto, qué me falta);
//   - si tengo gente a cargo, los de MI EQUIPO: cargar, seguir y cerrar.
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerSesionPortal } from "@/lib/portal";
import { equipoDe } from "@/lib/equipo";
import { hoyArgentina } from "@/lib/ausencias";
import { NIVELES } from "@/lib/capacitaciones-reglas";
import { brecha, type Requisito } from "@/lib/objetivos-reglas";
import { fechaPeriodo } from "../formato";
import ObjetivoCard from "./ObjetivoCard";
import NuevoObjetivo from "./NuevoObjetivo";

export const dynamic = "force-dynamic";

export default async function PortalObjetivos() {
  const sesion = await obtenerSesionPortal();
  if (!sesion) redirect("/portal/login");
  const hoy = hoyArgentina();
  const equipo = await equipoDe(sesion.legajoId);
  const idsEquipo = equipo.map((m) => m.id);

  const [mios, plan, tengo, delEquipo] = await Promise.all([
    prisma.objetivo.findMany({ where: { legajoId: sesion.legajoId, estado: { not: "cancelado" } }, orderBy: { fechaLimite: "asc" }, take: 60 }),
    prisma.planCarrera.findUnique({ where: { legajoId: sesion.legajoId } }),
    prisma.habilidadLegajo.findMany({ where: { legajoId: sesion.legajoId }, select: { habilidadId: true, nivel: true, vence: true } }),
    idsEquipo.length ? prisma.objetivo.findMany({ where: { legajoId: { in: idsEquipo }, estado: "en_curso" }, orderBy: { fechaLimite: "asc" } }) : [],
  ]);
  const requisitos = (plan?.requisitos ?? []) as unknown as Requisito[];
  const b = plan ? brecha(requisitos, tengo, hoy) : null;
  const nombres = requisitos.length ? new Map((await prisma.habilidad.findMany({ where: { id: { in: requisitos.map((r) => r.habilidadId) } }, select: { id: true, nombre: true } })).map((h) => [h.id, h.nombre])) : new Map<string, string>();

  const dto = (o: (typeof mios)[number]) => ({ id: o.id, titulo: o.titulo, descripcion: o.descripcion, limite: fechaPeriodo(o.fechaLimite), vencido: o.estado === "en_curso" && o.fechaLimite < hoy, avance: o.avance, estado: o.estado, nota: o.nota, comentarioCierre: o.comentarioCierre });
  const enCurso = mios.filter((o) => o.estado === "en_curso");
  const cerrados = mios.filter((o) => o.estado !== "en_curso");

  return (
    <>
      <h1>Objetivos</h1>

      <h2>Mis objetivos</h2>
      {enCurso.length === 0 && <p className="p-sub">No tenés objetivos en curso.</p>}
      {enCurso.map((o) => <ObjetivoCard key={o.id} o={dto(o)} modo="mio" />)}

      {plan && b && (
        <>
          <h2>Mi plan de carrera</h2>
          <div className="p-card">
            <div className="p-card-titulo">🎯 {plan.puestoObjetivo}</div>
            {plan.fechaObjetivo && <div className="p-card-dato">Para el {fechaPeriodo(plan.fechaObjetivo)}</div>}
            {plan.notas && <div className="p-card-dato" style={{ whiteSpace: "pre-wrap" }}>{plan.notas}</div>}
            {b.total > 0 && <div className="p-card-dato" style={{ marginTop: "0.5rem" }}>Ya tenés <strong>{b.cumplidos} de {b.total}</strong> habilidades que pide el puesto:</div>}
            {b.detalle.map((d) => (
              <div key={d.habilidadId} style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", padding: "0.5rem 0", borderTop: "1px solid var(--gris-claro)", fontSize: "0.9rem" }}>
                <span>{nombres.get(d.habilidadId) ?? "Habilidad"}<span style={{ display: "block", fontSize: "0.78rem", color: "#6b727b" }}>{d.cumple ? "Listo" : d.vencida ? "Se te venció: hay que renovarla" : `Necesitás: ${NIVELES[d.pedido]?.nombre.toLowerCase()}${d.actual ? ` · hoy: ${NIVELES[d.actual]?.nombre.toLowerCase()}` : ""}`}</span></span>
                <span className={`p-chip ${d.cumple ? "conforme" : "pendiente"}`} style={{ alignSelf: "center" }}>{d.cumple ? "✓" : "Falta"}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {equipo.length > 0 && (
        <>
          <h2>De mi equipo</h2>
          <NuevoObjetivo equipo={equipo.map((m) => ({ id: m.id, nombre: `${m.apellido}, ${m.nombre}` }))} hoy={hoy.toISOString().slice(0, 10)} />
          {equipo.map((m) => {
            const suyos = delEquipo.filter((o) => o.legajoId === m.id);
            if (suyos.length === 0) return null;
            return (
              <div key={m.id}>
                <div style={{ fontWeight: 700, color: "var(--azul-oscuro)", margin: "0.9rem 0 0.4rem" }}>{m.apellido}, {m.nombre}</div>
                {suyos.map((o) => <ObjetivoCard key={o.id} o={dto(o)} modo="jefe" />)}
              </div>
            );
          })}
          {delEquipo.length === 0 && <p className="p-sub">Tu equipo no tiene objetivos en curso.</p>}
        </>
      )}

      {cerrados.length > 0 && (
        <>
          <h2>Mis objetivos cerrados</h2>
          {cerrados.map((o) => <ObjetivoCard key={o.id} o={dto(o)} modo="mio" />)}
        </>
      )}
    </>
  );
}
