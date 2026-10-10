// FM RRHH — lib/evaluaciones.ts
// Lado base de datos de la evaluación de desempeño. Las reglas (qué es una
// evaluación completa, promedios) están en lib/evaluaciones-reglas.ts.
import { prisma, prismaSistema } from "./prisma";
import { FORMULARIO_INICIAL, limpiarPuntajes, motivoIncompleta, promedio, type Competencia } from "./evaluaciones-reglas";
export * from "./evaluaciones-reglas";

// Los formularios de la empresa. La primera vez se crea uno de partida,
// para que nadie arranque con la pantalla vacía. Se crea sin el filtro de
// alcance: tiene que existir aunque el primero en entrar sea alguien
// limitado a un sector (que no puede crear formularios).
export async function formulariosDe(empresaId: string) {
  const lista = await prisma.formularioEvaluacion.findMany({ where: { empresaId }, orderBy: { nombre: "asc" } });
  if (lista.length > 0) return lista;
  await prismaSistema.formularioEvaluacion.createMany({ data: [{ empresaId, nombre: FORMULARIO_INICIAL.nombre, competencias: FORMULARIO_INICIAL.competencias as any }], skipDuplicates: true });
  return prisma.formularioEvaluacion.findMany({ where: { empresaId }, orderBy: { nombre: "asc" } });
}

// Lo que escribió el evaluador → los datos a guardar. Con `completar`, si
// falta algo devuelve el motivo y no se guarda nada como completo.
// Lo usan el portal (el jefe) y el panel (RR.HH.): misma regla para los dos.
export function datosDeEvaluacion(competencias: Competencia[], body: any, completar: boolean, quien: string): { error: string } | { data: Record<string, unknown> } {
  const puntajes = limpiarPuntajes(body?.puntajes, competencias.length);
  const fortalezas = String(body?.fortalezas ?? "").trim().slice(0, 1500);
  const aMejorar = String(body?.aMejorar ?? "").trim().slice(0, 1500);
  if (completar) {
    const motivo = motivoIncompleta(competencias, puntajes, aMejorar);
    if (motivo) return { error: motivo };
  }
  return {
    data: {
      puntajes, fortalezas: fortalezas || null, aMejorar: aMejorar || null,
      // El promedio se guarda solo al completar: un borrador a medias no
      // tiene que aparecer en el resumen del ciclo.
      ...(completar ? { estado: "completada", promedio: promedio(puntajes), completadaPor: quien, completadaEn: new Date() } : {}),
    },
  };
}
