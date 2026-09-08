// FM RRHH — lib/vacaciones.ts
//
// ⚠️ Tramos según Art. 150 LCT — verificado con los casos límite exactos
// (4/5, 9/10, 19/20 años) antes de entregarlo, pero como con todo lo que
// toca legislación laboral en este proyecto: confirmar contra la normativa
// vigente y con un contador matriculado antes de usarlo para un caso real.
// La antigüedad relevante es la ANTIGÜEDAD RECONOCIDA si está cargada
// (puede diferir de la fecha de ingreso por acuerdos de convenio — ver
// 25-ficha-empleado-ampliada.md), la fecha de ingreso si no.
export function diasVacacionesPorAntiguedad(antiguedadAnios: number): number {
  if (antiguedadAnios < 5) return 14;
  if (antiguedadAnios < 10) return 21;
  if (antiguedadAnios < 20) return 28;
  return 35;
}

export function calcularAntiguedadAnios(fechaIngreso: Date, fechaAntiguedadReconocida: Date | null, fechaReferencia: Date): number {
  const fechaBase = fechaAntiguedadReconocida ?? fechaIngreso;
  return (fechaReferencia.getTime() - fechaBase.getTime()) / (365.25 * 24 * 3600 * 1000);
}
