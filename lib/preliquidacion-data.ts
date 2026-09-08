// FM RRHH — lib/preliquidacion-data.ts
// Convierte el detalle de liquidación (una fila por legajo × concepto, con
// códigos) en una tabla pivote (una fila por legajo, una columna por
// concepto, con nombres reales) — lo que pediste como "resumen estilo
// tabla en vez de estilo códigos". Un solo lugar para esta lógica, para que
// la pantalla y la exportación a CSV nunca puedan desincronizarse.
import { prisma } from "./prisma";

export interface ColumnaConcepto {
  codigo: string;
  nombre: string;
  numero: number | null;
}

export interface FilaPreliquidacion {
  numeroLegajo: number;
  apellido: string;
  nombre: string;
  convenio: string;
  porConcepto: Record<string, number>; // codigo -> importe
  porConceptoId: Record<string, string>; // codigo -> id de LiquidacionDetalle, para "¿Cómo se calculó?"
  bruto: number;
  neto: number;
}

export async function obtenerPreliquidacion(periodoId: string): Promise<{ columnas: ColumnaConcepto[]; filas: FilaPreliquidacion[] }> {
  const liquidaciones = await prisma.liquidacion.findMany({
    where: { periodoId, vigente: true },
    include: {
      legajo: { include: { convenio: true } },
      detalle: { include: { concepto: true } },
    },
    orderBy: { legajo: { numeroLegajo: "asc" } },
  });

  // Columnas = unión de todos los conceptos que aparecen en CUALQUIER
  // legajo de este período (Madera y Comercio hoy tienen conceptos
  // distintos — ver 38-validado-contra-recibo-real.md) — ordenadas por el
  // número real de ARCA, no alfabéticamente ni por orden de aparición.
  const columnasPorCodigo = new Map<string, ColumnaConcepto>();
  for (const liq of liquidaciones) {
    for (const d of liq.detalle) {
      if (!columnasPorCodigo.has(d.concepto.codigo)) {
        columnasPorCodigo.set(d.concepto.codigo, { codigo: d.concepto.codigo, nombre: d.concepto.nombre, numero: d.concepto.numero });
      }
    }
  }
  const columnas = [...columnasPorCodigo.values()].sort((a, b) => (a.numero ?? 999999) - (b.numero ?? 999999));

  const filas: FilaPreliquidacion[] = liquidaciones.map((liq) => {
    const porConcepto: Record<string, number> = {};
    const porConceptoId: Record<string, string> = {};
    for (const d of liq.detalle) { porConcepto[d.concepto.codigo] = d.importe; porConceptoId[d.concepto.codigo] = d.id; }
    return {
      numeroLegajo: liq.legajo.numeroLegajo,
      apellido: liq.legajo.apellido,
      nombre: liq.legajo.nombre,
      convenio: liq.legajo.convenio.codigo,
      porConcepto, porConceptoId,
      bruto: liq.bruto,
      neto: liq.neto,
    };
  });

  return { columnas, filas };
}
