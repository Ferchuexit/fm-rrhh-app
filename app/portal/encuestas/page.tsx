// FM RRHH — app/portal/encuestas/page.tsx
// Las encuestas que el empleado tiene para responder.
import { redirect } from "next/navigation";
import { obtenerSesionPortal } from "@/lib/portal";
import { hoyArgentina } from "@/lib/ausencias";
import { cerrarVencidas, encuestasPendientesDe } from "@/lib/encuestas";
import { fechaPeriodo } from "../formato";

export const dynamic = "force-dynamic";

export default async function PortalEncuestas({ searchParams }: { searchParams: { gracias?: string } }) {
  const sesion = await obtenerSesionPortal();
  if (!sesion) redirect("/portal/login");
  await cerrarVencidas(hoyArgentina(), sesion.empresaId).catch(() => {});
  const pendientes = await encuestasPendientesDe(sesion.legajoId);

  return (
    <>
      <h1>Encuestas</h1>
      {searchParams.gracias && <div className="p-aviso ok">¡Gracias por responder! Tu respuesta se guardó sin tu nombre.</div>}
      {pendientes.length === 0 && <p className="p-sub">No tenés encuestas para responder.</p>}
      {pendientes.map((e) => (
        <a key={e.id} href={`/portal/encuestas/${e.id}`} className="p-card">
          <div className="p-card-cuerpo">
            <div className="p-card-titulo">{e.titulo}</div>
            <div className="p-card-dato">{(e.preguntas as unknown[]).length} preguntas · hasta el {fechaPeriodo(e.fechaCierre)}</div>
          </div>
          <span className="p-chip pendiente">Responder</span>
        </a>
      ))}
      <p className="p-pie">Las encuestas son anónimas: el sistema guarda que respondiste, pero no qué respondiste vos. Nadie de la empresa puede ver tus respuestas.</p>
    </>
  );
}
