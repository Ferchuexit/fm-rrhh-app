// FM RRHH — app/portal/empleos/page.tsx
// Búsquedas internas: los puestos que la empresa quiere cubrir primero con
// su propia gente. El empleado se postula con un toque.
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerSesionPortal } from "@/lib/portal";
import { busquedasInternas } from "@/lib/reclutamiento";
import Postularme from "./Postularme";
import { preguntasPublicas } from "@/lib/reclutamiento-filtros";

export const dynamic = "force-dynamic";

export default async function PortalEmpleos() {
  const sesion = await obtenerSesionPortal();
  if (!sesion) redirect("/portal/login");
  const busquedas = await busquedasInternas(sesion.empresaId);
  const mias = new Set((await prisma.candidato.findMany({ where: { empleadoId: sesion.legajoId, busquedaId: { in: busquedas.map((b) => b.id) } }, select: { busquedaId: true } })).map((c) => c.busquedaId));

  return (
    <>
      <h1>Empleos</h1>
      <p className="p-sub">Búsquedas abiertas dentro de la empresa. Si te interesa cambiar de puesto, postulate: RR.HH. ya tiene tus datos.</p>
      {busquedas.length === 0 && <p className="p-sub">Hoy no hay búsquedas internas.</p>}
      {busquedas.map((b) => (
        <div key={b.id} className="p-card">
          <div className="p-card-titulo">{b.titulo}</div>
          {b.lugar && <div className="p-card-dato">{b.lugar}</div>}
          <div className="p-card-dato" style={{ whiteSpace: "pre-wrap", marginTop: "0.4rem" }}>{b.descripcion}</div>
          {b.requisitos && <div className="p-card-dato" style={{ whiteSpace: "pre-wrap", marginTop: "0.4rem" }}><strong>Requisitos</strong>{"\n"}{b.requisitos}</div>}
          {b.ofrecemos && <div className="p-card-dato" style={{ whiteSpace: "pre-wrap", marginTop: "0.4rem" }}><strong>Condiciones</strong>{"\n"}{b.ofrecemos}</div>}
          <Postularme id={b.id} yaPostulado={mias.has(b.id)} preguntas={preguntasPublicas(b.preguntas)} />
        </div>
      ))}
      <p className="p-pie">Postularte no cambia nada de tu puesto actual. RR.HH. te contacta para contarte cómo sigue.</p>
    </>
  );
}
