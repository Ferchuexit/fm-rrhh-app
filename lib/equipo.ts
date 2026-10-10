// FM RRHH — lib/equipo.ts
// Lado base de datos de la jerarquía "reporta a".
import { prisma } from "./prisma";
import { motivoJefeInvalido } from "./equipo-reglas";
export * from "./equipo-reglas";

// La gente a cargo DIRECTO de un jefe (solo activos). Un gerente no ve
// desde acá a la gente de sus jefes: cada jefe coordina a los suyos.
export function equipoDe(jefeLegajoId: string) {
  return prisma.legajo.findMany({
    where: { jefeId: jefeLegajoId, condicion: "activo" },
    select: { id: true, numeroLegajo: true, apellido: true, nombre: true, centroCosto: { select: { nombre: true } } },
    orderBy: [{ apellido: "asc" }, { nombre: "asc" }],
  });
}

export async function validarJefe(empresaId: string, legajoId: string | null, jefeId: string): Promise<string | null> {
  const legajos = await prisma.legajo.findMany({ where: { empresaId }, select: { id: true, jefeId: true } });
  return motivoJefeInvalido(legajoId, jefeId, new Map(legajos.map((l) => [l.id, l.jefeId])));
}
