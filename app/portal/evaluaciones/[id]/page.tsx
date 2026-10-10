// FM RRHH — app/portal/evaluaciones/[id]/page.tsx
// Una evaluación, vista por su evaluador (la completa) o por el evaluado
// (la lee y la firma). A cualquier otro, no se le muestra.
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerSesionPortal } from "@/lib/portal";
import { ESCALA, type Competencia } from "@/lib/evaluaciones-reglas";
import { fechaPeriodo, fechaHora } from "../../formato";
import FormularioEvaluador from "./FormularioEvaluador";
import FirmarEvaluacion from "./FirmarEvaluacion";

export const dynamic = "force-dynamic";

export default async function PortalEvaluacion({ params }: { params: { id: string } }) {
  const sesion = await obtenerSesionPortal();
  if (!sesion) redirect("/portal/login");
  const e = await prisma.evaluacion.findFirst({
    where: { id: params.id, OR: [{ evaluadorId: sesion.legajoId }, { legajoId: sesion.legajoId, estado: { in: ["entregada", "firmada"] } }] },
    include: { ciclo: true, legajo: { select: { apellido: true, nombre: true } } },
  });
  if (!e) notFound();
  const competencias = e.ciclo.competencias as unknown as Competencia[];
  const puntajes = (e.puntajes ?? {}) as Record<string, number>;
  const esMia = e.legajoId === sesion.legajoId;
  const editable = !esMia && e.ciclo.estado === "abierto" && (e.estado === "pendiente" || e.estado === "completada");

  return (
    <>
      <a href="/portal/evaluaciones" className="p-link">‹ Evaluaciones</a>
      <h1>{esMia ? e.ciclo.nombre : `${e.legajo.nombre} ${e.legajo.apellido}`}</h1>
      <p className="p-sub">{esMia ? `Entregada el ${fechaPeriodo(e.entregadaEn!)}` : `${e.ciclo.nombre} · hasta el ${fechaPeriodo(e.ciclo.fechaLimite)}`}</p>

      {editable ? (
        <FormularioEvaluador id={e.id} competencias={competencias} inicial={{ puntajes, fortalezas: e.fortalezas ?? "", aMejorar: e.aMejorar ?? "" }} completada={e.estado === "completada"} />
      ) : (
        <>
          {!esMia && <div className="p-aviso info">{e.estado === "pendiente" ? "RR.HH. cerró este ciclo: ya no se puede completar." : "Ya se le entregó al empleado: no se modifica."}</div>}
          <div className="p-card" style={{ padding: 0 }}>
            {competencias.map((c, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", padding: "0.65rem 0.9rem", borderBottom: "1px solid var(--gris-claro)" }}>
                <span>{c.nombre}{c.descripcion && <span style={{ display: "block", fontSize: "0.78rem", color: "#6b727b" }}>{c.descripcion}</span>}</span>
                {puntajes[i] ? <span className="p-chip" style={{ background: ESCALA[puntajes[i]].color, color: puntajes[i] === 5 ? "white" : "#12202e", alignSelf: "center" }}>{puntajes[i]} · {ESCALA[puntajes[i]].nombre}</span> : <span className="p-chip cancelada" style={{ alignSelf: "center" }}>—</span>}
              </div>
            ))}
          </div>
          {e.fortalezas && <div className="p-card"><div className="p-card-titulo">Fortalezas</div><div className="p-card-dato" style={{ whiteSpace: "pre-wrap" }}>{e.fortalezas}</div></div>}
          {e.aMejorar && <div className="p-card"><div className="p-card-titulo">A mejorar</div><div className="p-card-dato" style={{ whiteSpace: "pre-wrap" }}>{e.aMejorar}</div></div>}

          {esMia && e.estado === "entregada" && <FirmarEvaluacion id={e.id} />}
          {e.estado === "firmada" && (
            <div className={`p-aviso ${e.firma === "conforme" ? "ok" : "error"}`}>
              {esMia ? "Firmaste" : "Firmó"} <strong>{e.firma === "conforme" ? "conforme" : "en disconformidad"}</strong> el {fechaHora(e.firmadoEn!)}.
              {e.comentarioEmpleado && <div style={{ marginTop: "0.4rem", whiteSpace: "pre-wrap" }}>«{e.comentarioEmpleado}»</div>}
            </div>
          )}
        </>
      )}
    </>
  );
}
