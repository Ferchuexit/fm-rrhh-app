// FM RRHH — app/portal/encuestas/[id]/page.tsx
import { redirect } from "next/navigation";
import { obtenerSesionPortal } from "@/lib/portal";
import { encuestasPendientesDe, type Pregunta } from "@/lib/encuestas";
import ResponderEncuesta from "./ResponderEncuesta";

export const dynamic = "force-dynamic";

export default async function PortalEncuesta({ params }: { params: { id: string } }) {
  const sesion = await obtenerSesionPortal();
  if (!sesion) redirect("/portal/login");
  // Solo si es para esta persona, está abierta y todavía no la respondió.
  const encuesta = (await encuestasPendientesDe(sesion.legajoId)).find((e) => e.id === params.id);
  if (!encuesta) redirect("/portal/encuestas");

  return (
    <>
      <a href="/portal/encuestas" className="p-link">‹ Encuestas</a>
      <h1>{encuesta.titulo}</h1>
      {encuesta.descripcion && <p className="p-sub" style={{ whiteSpace: "pre-wrap" }}>{encuesta.descripcion}</p>}
      <div className="p-aviso info">🔒 Es anónima. Se guarda que respondiste, pero no qué respondiste: nadie puede ver tus respuestas.</div>
      <ResponderEncuesta id={encuesta.id} preguntas={encuesta.preguntas as unknown as Pregunta[]} />
    </>
  );
}
