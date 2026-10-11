// FM RRHH — app/portal/referidos/page.tsx
// Programa de referidos: las búsquedas para las que se puede recomendar a
// alguien, y en qué anda cada persona que el empleado ya recomendó.
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerSesionPortal } from "@/lib/portal";
import { busquedasConReferidos, estadoParaReferidor, MAX_REFERIDOS_POR_BUSQUEDA } from "@/lib/reclutamiento";
import Recomendar from "./Recomendar";

export const dynamic = "force-dynamic";
const CHIP = { recibido: "info", proceso: "pendiente", ingreso: "conforme", no: "cancelada" } as const;

export default async function PortalReferidos() {
  const sesion = await obtenerSesionPortal();
  if (!sesion) redirect("/portal/login");
  const [busquedas, mios] = await Promise.all([
    busquedasConReferidos(sesion.empresaId),
    prisma.candidato.findMany({ where: { referidoPorId: sesion.legajoId, busqueda: { empresaId: sesion.empresaId } }, select: { id: true, nombre: true, apellido: true, etapa: true, busquedaId: true, createdAt: true, premioReferidoEn: true, busqueda: { select: { titulo: true, premioReferido: true } } }, orderBy: { createdAt: "desc" }, take: 50 }),
  ]);
  const cuantos = (id: string) => mios.filter((c) => c.busquedaId === id).length;

  return (
    <>
      <h1>Recomendá a alguien</h1>
      <p className="p-sub">¿Conocés a alguien bueno para alguno de estos puestos? Recomendalo: nadie conoce mejor que vos qué hace falta para trabajar acá.</p>
      {busquedas.length === 0 && <p className="p-sub">Hoy no hay búsquedas abiertas a recomendaciones.</p>}
      {busquedas.map((b) => (
        <div key={b.id} className="p-card">
          <div className="p-card-titulo">{b.titulo}</div>
          {b.lugar && <div className="p-card-dato">{b.lugar}</div>}
          <div className="p-card-dato" style={{ whiteSpace: "pre-wrap", marginTop: "0.4rem" }}>{b.descripcion}</div>
          {b.requisitos && <div className="p-card-dato" style={{ whiteSpace: "pre-wrap", marginTop: "0.4rem" }}><strong>Requisitos</strong>{"\n"}{b.requisitos}</div>}
          {b.premioReferido && <div className="p-aviso ok" style={{ marginTop: "0.6rem" }}>🎁 Si tu recomendado queda: <strong>{b.premioReferido}</strong></div>}
          <Recomendar id={b.id} quedan={Math.max(0, MAX_REFERIDOS_POR_BUSQUEDA - cuantos(b.id))} />
        </div>
      ))}

      {mios.length > 0 && (
        <>
          <h2>Mis recomendados</h2>
          {mios.map((c) => {
            const e = estadoParaReferidor(c.etapa);
            return (
              <div key={c.id} className="p-card">
                <div className="p-card-titulo">{c.nombre} {c.apellido}</div>
                <div className="p-card-dato">{c.busqueda.titulo}</div>
                <div className="p-card-dato" style={{ marginTop: "0.3rem" }}><span className={`p-chip ${CHIP[e.clave]}`}>{e.texto}</span>{e.clave === "ingreso" && c.busqueda.premioReferido && <span style={{ marginLeft: 6 }}>🎁 {c.premioReferidoEn ? "Premio entregado" : `Premio: ${c.busqueda.premioReferido}`}</span>}</div>
              </div>
            );
          })}
        </>
      )}
      <p className="p-pie">Tu recomendado pasa por el mismo proceso que cualquier candidato: recomendar suma, pero no asegura el puesto. Avisale antes de pasar sus datos.</p>
    </>
  );
}
