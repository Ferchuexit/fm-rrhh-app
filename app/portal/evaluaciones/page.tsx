// FM RRHH — app/portal/evaluaciones/page.tsx
// Evaluaciones en el portal. Dos papeles en la misma pantalla:
//   - como JEFE: las de mi equipo que tengo que completar;
//   - como EMPLEADO: las mías, recién cuando RR.HH. me las entrega.
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerSesionPortal } from "@/lib/portal";
import { hoyArgentina } from "@/lib/ausencias";
import { fechaPeriodo } from "../formato";

export const dynamic = "force-dynamic";

export default async function PortalEvaluaciones() {
  const sesion = await obtenerSesionPortal();
  if (!sesion) redirect("/portal/login");
  const hoy = hoyArgentina();

  const [aCargo, mias] = await Promise.all([
    prisma.evaluacion.findMany({ where: { evaluadorId: sesion.legajoId, ciclo: { estado: "abierto" }, estado: { in: ["pendiente", "completada"] } }, include: { ciclo: { select: { nombre: true, fechaLimite: true } }, legajo: { select: { apellido: true, nombre: true } } }, orderBy: [{ ciclo: { fechaLimite: "asc" } }, { legajo: { apellido: "asc" } }] }),
    prisma.evaluacion.findMany({ where: { legajoId: sesion.legajoId, estado: { in: ["entregada", "firmada"] } }, include: { ciclo: { select: { nombre: true } } }, orderBy: { entregadaEn: "desc" }, take: 30 }),
  ]);
  const pendientes = aCargo.filter((e) => e.estado === "pendiente");

  return (
    <>
      <h1>Evaluaciones</h1>

      {aCargo.length > 0 && (
        <>
          <h2>De mi equipo</h2>
          {pendientes.length > 0
            ? <div className="p-aviso pendiente">Te {pendientes.length === 1 ? "falta completar 1 evaluación" : `faltan completar ${pendientes.length} evaluaciones`}.</div>
            : <div className="p-aviso ok">Completaste todas. RR.HH. las revisa y se las entrega a cada uno; hasta entonces las podés corregir.</div>}
          {aCargo.map((e) => {
            const vencida = e.estado === "pendiente" && e.ciclo.fechaLimite < hoy;
            return (
              <a key={e.id} href={`/portal/evaluaciones/${e.id}`} className="p-card">
                <div className="p-card-cuerpo">
                  <div className="p-card-titulo">{e.legajo.apellido}, {e.legajo.nombre}</div>
                  <div className="p-card-dato">{e.ciclo.nombre} · <span style={vencida ? { color: "#8d2a2a", fontWeight: 700 } : undefined}>hasta el {fechaPeriodo(e.ciclo.fechaLimite)}{vencida ? " (vencida)" : ""}</span></div>
                </div>
                <span className={`p-chip ${e.estado === "pendiente" ? "pendiente" : "conforme"}`}>{e.estado === "pendiente" ? (e.puntajes ? "En borrador" : "Sin completar") : "Completada"}</span>
              </a>
            );
          })}
        </>
      )}

      <h2>Mis evaluaciones</h2>
      {mias.length === 0 && <p className="p-sub">Todavía no tenés evaluaciones. Cuando RR.HH. te entregue una, la vas a ver acá.</p>}
      {mias.map((e) => (
        <a key={e.id} href={`/portal/evaluaciones/${e.id}`} className="p-card">
          <div className="p-card-cuerpo">
            <div className="p-card-titulo">{e.ciclo.nombre}</div>
            <div className="p-card-dato">Entregada el {fechaPeriodo(e.entregadaEn!)}</div>
          </div>
          <span className={`p-chip ${e.estado === "entregada" ? "pendiente" : e.firma === "disconforme" ? "disconforme" : "conforme"}`}>{e.estado === "entregada" ? "Para leer y firmar" : e.firma === "disconforme" ? "Firmada en disconformidad" : "Firmada"}</span>
        </a>
      ))}
    </>
  );
}
