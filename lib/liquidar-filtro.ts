// FM RRHH — lib/liquidar-filtro.ts
// Los tres modos de filtro que pediste: todos, por convenio, o por rango de
// número de legajo (uno solo = rango con desde=hasta). Un solo lugar para
// construir el WHERE de Prisma, usado tanto por /api/liquidar (para saber
// a quién liquidar) como por /api/liquidar/estado (para saber a quién
// mostrar en la tabla) — así los dos nunca pueden mostrar/liquidar
// conjuntos distintos de gente por error.
export interface FiltroLegajos {
  modo: "todos" | "convenio" | "rango";
  convenioId?: string;
  legajoDesde?: number;
  legajoHasta?: number;
}

// periodoConvenioId: si el período tiene un convenio asociado (Periodo.convenioId),
// "Todos" respeta eso automáticamente — para que un período pensado para un
// solo convenio (como una quincena de Madera) no pueda liquidar/exportar/
// borrar accidentalmente legajos de otro convenio (como Comercio) solo
// porque alguien dejó el filtro en "Todos".
export function whereDeFiltro(empresaId: string, filtro: FiltroLegajos, periodoConvenioId?: string | null) {
  const where: any = { empresaId, condicion: "activo" };

  if (filtro.modo === "convenio" && filtro.convenioId) {
    where.convenioId = filtro.convenioId;
  } else if (filtro.modo === "todos" && periodoConvenioId) {
    where.convenioId = periodoConvenioId;
  }
  if (filtro.modo === "rango") {
    // "Hasta" vacío significa "un solo legajo" (mismo valor que "desde")
    // — así lo dice la pantalla ("igual al de arriba = uno solo"), pero
    // antes esto no se aplicaba de verdad: si faltaba "hasta", no se
    // filtraba nada y terminaba matcheando TODOS los legajos en silencio.
    if (filtro.legajoDesde != null) {
      const hasta = filtro.legajoHasta ?? filtro.legajoDesde;
      where.numeroLegajo = { gte: filtro.legajoDesde, lte: hasta };
    } else {
      // Ni siquiera se cargó "desde" — mejor no matchear nada que
      // matchear a todo el mundo por accidente.
      where.numeroLegajo = { equals: -1 };
    }
    // Si el período también tiene convenio asociado, se combina con el rango
    // (por ejemplo, "legajo 4 a 20, y además tiene que ser de Madera").
    if (periodoConvenioId) where.convenioId = periodoConvenioId;
  }

  return where;
}
