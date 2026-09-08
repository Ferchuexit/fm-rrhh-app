// FM RRHH — lib/liquidacion-individual-recalculo.ts
//
// Orquesta el recálculo COMPLETO de una liquidación individual — motor de
// reglas + SAC + Retención de Ganancias + Embargos — para Liquidación
// Individual (07/09/2026, segunda etapa: ya no se preservan sin tocar,
// se recalculan de verdad).
//
// DECISIÓN DE DISEÑO: esto reutiliza calcularSAC / calcularRetencionGanancias
// / procesarEmbargosDelLegajo — las mismas funciones PURAS que usa
// app/api/liquidar/route.ts, ya probadas en tests/motor-sac.test.mjs,
// tests/motor-ganancias.test.mjs, tests/motor-embargos.test.mjs y
// tests/embargos-prioridad.test.mjs. Lo que este archivo hace es
// replicar la ORQUESTACIÓN de route.ts (qué datos juntar de la base antes
// de llamar a esas funciones) — no reinventa ninguna fórmula.
//
// CASO BORDE IMPORTANTE — cuota de Embargo Comercial: cada CuotaEmbargo se
// tiene que aplicar UNA sola vez en la vida (es la cuota de ese mes de una
// deuda real) — por eso tiene un flag `aplicado`. Si esta liquidación
// individual ya tiene una fila EMBARGO_COMERCIAL (porque la Masiva ya la
// aplicó, o porque un recálculo individual anterior ya la aplicó), un
// recálculo posterior NO tiene que volver a buscar "¿hay una cuota
// pendiente?" — porque ya no hay ninguna pendiente (aplicado=true) y el
// embargo desaparecería de la liquidación sin querer. En ese caso, este
// código reutiliza el importe ya aplicado tal cual, y solo lo vuelve a
// pasar por procesarEmbargosDelLegajo() para que la prioridad frente al
// embargo judicial (y el neto disponible) se recalculen bien si el resto
// de la liquidación cambió. La cuota solo se marca aplicado=true la
// PRIMERA vez que aparece.
//
// VALIDACIÓN DE CATÁLOGO (encontrado probando con legajo 9007 de Moras,
// 08/09/2026): SAC/Ganancias/Embargos necesitan que exista el Concepto
// correspondiente (código SAC, SAC_PROPORCIONAL, RETENCION_GANANCIAS,
// EMBARGO_JUDICIAL, EMBARGO_COMERCIAL) en el catálogo de la empresa — si
// no existe, la fila no se puede persistir (no hay conceptoId al que
// asociarla). Antes de este fix, igual restaba el importe del neto aunque
// la fila no se guardara — un neto más bajo sin ninguna línea que lo
// explicara. Ahora, si falta el concepto, NO se aplica nada de esa pieza
// (ni la fila ni la resta al neto) y se devuelve una advertencia clara
// pidiendo crear el concepto.
import { prisma } from "@/lib/prisma";
import { liquidarLegajo } from "@/lib/motor/motor-reglas.mjs";
import { armarContextoTopes } from "@/lib/motor/parametros-topes.mjs";
import { calcularRetencionGanancias, calcularDeduccionesGeneralesConTopes } from "@/lib/motor/motor-ganancias.mjs";
import { calcularTopeEmbargoComercial, procesarEmbargosDelLegajo } from "@/lib/motor/motor-embargos.mjs";
import { calcularDiasTrabajadosEnPeriodo } from "@/lib/motor/prorrateo.mjs";
import { obtenerSemestre, calcularSAC } from "@/lib/motor/motor-sac.mjs";

// Códigos que este módulo sabe recalcular dinámicamente. Si el usuario los
// forzó o excluyó a mano, el llamador NO debe pedir el recálculo dinámico
// para ellos (ver `codigosBajoControlManual` más abajo).
export const CODIGOS_SAC = ["SAC", "SAC_PROPORCIONAL"];
export const CODIGO_GANANCIAS = "RETENCION_GANANCIAS";
export const CODIGOS_EMBARGO = ["EMBARGO_JUDICIAL", "EMBARGO_COMERCIAL"];

interface ParametrosRecalculo {
  legajo: any;
  periodo: any;
  varsBase: Record<string, number>;
  reglas: any[];
  conceptos: any[];
  cantidadesPorConcepto: Record<string, number>;
  valoresCategoria: Record<string, number>;
  topes: Record<string, any>;
  overrides: Record<string, number>; // conceptos CON regla, forzados/excluidos
  insumosDirectos: Record<string, number>; // insumos ya resueltos por el llamador (novedades + preservados + manuales + SAC/Ganancias/Embargos forzados)
  codigosBajoControlManual: Set<string>; // SAC/GANANCIAS/EMBARGO_* que el usuario forzó o excluyó — no recalcular
  hadEmbargoComercialAntes: boolean; // ¿esta liquidación YA tenía una fila EMBARGO_COMERCIAL antes de este recálculo?
}

export async function recalcularLiquidacionCompleta(p: ParametrosRecalculo) {
  const { legajo, periodo, varsBase, reglas, conceptos, cantidadesPorConcepto, valoresCategoria, topes, overrides } = p;
  const insumosDirectos = { ...p.insumosDirectos };
  const fechaReferencia = periodo.fechaDesde;
  const fechaFinPeriodo = periodo.fechaHasta;
  const advertencias: string[] = [];
  const existeConcepto = (codigo: string) => conceptos.some((c) => c.codigo === codigo);

  // ── SAC (solo en cierre de semestre — junio/diciembre) ──
  const fechaFinDeMes6o12 =
    (fechaFinPeriodo.getUTCMonth() === 5 && fechaFinPeriodo.getUTCDate() === 30) ||
    (fechaFinPeriodo.getUTCMonth() === 11 && fechaFinPeriodo.getUTCDate() === 31);

  if (fechaFinDeMes6o12 && !CODIGOS_SAC.some((c) => p.codigosBajoControlManual.has(c))) {
    try {
      const primeraPasada = liquidarLegajo({ varsBase, conceptos: conceptos as any, reglas, insumosDirectos, cantidades: cantidadesPorConcepto, valoresCategoria, topes, overrides });
      const remunerativoDeEsteMes = primeraPasada.remTotal;

      const semestre = obtenerSemestre(fechaFinPeriodo);
      const detallesDelSemestre = await prisma.liquidacionDetalle.findMany({
        where: {
          liquidacion: {
            legajoId: legajo.id, vigente: true,
            periodoId: { not: periodo.id },
            periodo: { fechaDesde: { gte: semestre.desde, lte: semestre.hasta } },
          },
        },
        include: { concepto: true, liquidacion: { include: { periodo: true } } },
      });

      const remunerativoPorMes: Record<string, number> = {};
      for (const d of detallesDelSemestre) {
        if (d.concepto.tipo !== "remunerativo") continue;
        const per = d.liquidacion.periodo;
        const clave = `${per.fechaDesde.getUTCFullYear()}-${per.fechaDesde.getUTCMonth()}`;
        remunerativoPorMes[clave] = (remunerativoPorMes[clave] ?? 0) + d.importe;
      }
      const claveEsteMes = `${fechaReferencia.getUTCFullYear()}-${fechaReferencia.getUTCMonth()}`;
      remunerativoPorMes[claveEsteMes] = (remunerativoPorMes[claveEsteMes] ?? 0) + remunerativoDeEsteMes;

      const mejorRemuneracionMensual = Math.max(0, ...Object.values(remunerativoPorMes));

      const diasTrabajadosEnSemestre = calcularDiasTrabajadosEnPeriodo({
        fechaDesdePeriodo: semestre.desde, fechaHastaPeriodo: semestre.hasta,
        fechaIngresoLegajo: legajo.fechaIngreso, fechaEgresoLegajo: legajo.fechaEgreso,
      });
      const diasDelSemestre = Math.round((semestre.hasta.getTime() - semestre.desde.getTime()) / (24 * 3600 * 1000)) + 1;

      const importeSac = calcularSAC({ mejorRemuneracionMensualDelSemestre: mejorRemuneracionMensual, diasTrabajadosEnSemestre, diasDelSemestre });
      if (importeSac > 0) {
        const codigoSac = diasTrabajadosEnSemestre >= diasDelSemestre ? "SAC" : "SAC_PROPORCIONAL";
        if (existeConcepto(codigoSac)) {
          insumosDirectos[codigoSac] = importeSac;
        } else {
          advertencias.push(`Corresponde SAC ($${importeSac.toFixed(2)}) pero falta crear el concepto "${codigoSac}" en el catálogo de esta empresa — no se aplicó.`);
        }
      }
    } catch (e: any) {
      console.error(`Error calculando SAC (recálculo individual) para legajo ${legajo.numeroLegajo}:`, e);
    }
  }

  let resultado: any;
  try {
    resultado = liquidarLegajo({ varsBase, conceptos: conceptos as any, reglas, insumosDirectos, cantidades: cantidadesPorConcepto, valoresCategoria, topes, overrides });
  } catch (e: any) {
    throw new Error(`Error del motor de reglas al recalcular: ${e.message}`);
  }

  // ── Retención de Ganancias ──
  if (!p.codigosBajoControlManual.has(CODIGO_GANANCIAS)) {
    try {
      const anioActual = fechaReferencia.getUTCFullYear();
      const mesActual = fechaReferencia.getUTCMonth() + 1;

      const tablaMes = await prisma.tablaGananciasMensual.findUnique({ where: { anio_mes: { anio: anioActual, mes: mesActual } }, include: { tramos: true } });

      if (tablaMes) {
        const brutoDelMes = resultado.detalle
          .filter((d: any) => {
            const c = conceptos.find((cc) => cc.codigo === d.conceptoCodigo);
            return c && (c.tipo === "remunerativo" || c.tipo === "no_remunerativo");
          })
          .reduce((a: number, d: any) => a + d.importe, 0);

        const aportesDelMes = resultado.detalle
          .filter((d: any) => ["JUBILACION", "OBRA_SOCIAL", "LEY_19032"].includes(d.conceptoCodigo))
          .reduce((a: number, d: any) => a + d.importe, 0);

        const detallesAnioPrevio = await prisma.liquidacionDetalle.findMany({
          where: {
            liquidacion: {
              legajoId: legajo.id, vigente: true,
              periodoId: { not: periodo.id },
              periodo: { fechaDesde: { gte: new Date(Date.UTC(anioActual, 0, 1)), lt: fechaReferencia } },
            },
          },
          include: { concepto: true },
        });

        const brutoAcumuladoPrevio = detallesAnioPrevio.filter((d) => d.concepto.tipo === "remunerativo" || d.concepto.tipo === "no_remunerativo").reduce((a, d) => a + d.importe, 0);
        const aportesAcumuladoPrevio = detallesAnioPrevio.filter((d) => ["JUBILACION", "OBRA_SOCIAL", "LEY_19032"].includes(d.concepto.codigo)).reduce((a, d) => a + d.importe, 0);
        const retencionesPracticadasPrevias = detallesAnioPrevio.filter((d) => d.concepto.codigo === "RETENCION_GANANCIAS").reduce((a, d) => a + d.importe, 0);

        const saldoInicial = await prisma.saldoInicialGanancias.findUnique({ where: { legajoId_anio: { legajoId: legajo.id, anio: anioActual } } });

        const cargasVigentes = await prisma.cargaFamiliarGanancias.findMany({
          where: { legajoId: legajo.id, vigenciaDesde: { lte: fechaReferencia }, OR: [{ vigenciaHasta: null }, { vigenciaHasta: { gte: fechaReferencia } }] },
        });
        const cargas = {
          conyuge: cargasVigentes.some((c) => c.tipo === "conyuge"),
          hijos: cargasVigentes.filter((c) => c.tipo === "hijo").length,
          hijosIncapacitados: cargasVigentes.filter((c) => c.tipo === "hijo_incapacitado").length,
        };

        const siradigVigentes = await prisma.deduccionSiradig.findMany({ where: { legajoId: legajo.id, anio: anioActual, vigente: true } });
        const siradigPorTipo: Record<string, number> = {};
        for (const s of siradigVigentes) siradigPorTipo[s.tipo] = (siradigPorTipo[s.tipo] ?? 0) + (s.montoAnual * mesActual) / 12;

        const gananciaSujetaAAportesPrevia =
          brutoAcumuladoPrevio + brutoDelMes + (saldoInicial?.brutoAcumuladoPrevio ?? 0) - (aportesAcumuladoPrevio + aportesDelMes + (saldoInicial?.aportesAcumuladoPrevio ?? 0));
        const { total: deduccionesGeneralesAcumuladas } = calcularDeduccionesGeneralesConTopes({
          siradigPorTipo, ganNoImponibleAcum: tablaMes.ganNoImponibleAcum, gananciaSujetaAAportes: gananciaSujetaAAportesPrevia, mesActual,
        });

        const resultadoGanancias = calcularRetencionGanancias({
          gananciaBrutaAcumulada: brutoAcumuladoPrevio + brutoDelMes + (saldoInicial?.brutoAcumuladoPrevio ?? 0),
          aportesAcumulados: aportesAcumuladoPrevio + aportesDelMes + (saldoInicial?.aportesAcumuladoPrevio ?? 0),
          deduccionesGeneralesAcumuladas,
          cargas,
          retencionesPracticadasAcumuladas: retencionesPracticadasPrevias + (saldoInicial?.retencionAcumuladaPrevia ?? 0),
          tabla: tablaMes,
        });

        if (resultadoGanancias.retencionEsteMes > 0) {
          if (existeConcepto(CODIGO_GANANCIAS)) {
            resultado.detalle.push({ conceptoCodigo: "RETENCION_GANANCIAS", nombre: "Retención de Ganancias", tipo: "descuento", importe: resultadoGanancias.retencionEsteMes, aporta: false, contribuye: false, formula: null });
            resultado.neto -= resultadoGanancias.retencionEsteMes;
          } else {
            advertencias.push(`Corresponde Retención de Ganancias ($${resultadoGanancias.retencionEsteMes.toFixed(2)}) pero falta crear el concepto "RETENCION_GANANCIAS" en el catálogo de esta empresa — no se aplicó.`);
          }
        }
      }
    } catch (e: any) {
      console.error(`Error calculando Ganancias (recálculo individual) para legajo ${legajo.numeroLegajo}:`, e);
    }
  }

  // ── Embargos ──
  let esAplicacionNuevaDeCuota = false;
  let cuotaAAplicar: { id: string } | null = null;

  const tieneJudicialBajoControl = p.codigosBajoControlManual.has("EMBARGO_JUDICIAL");
  const tieneComercialBajoControl = p.codigosBajoControlManual.has("EMBARGO_COMERCIAL");

  if (!tieneJudicialBajoControl || !tieneComercialBajoControl) {
    try {
      const embargosActivos = await prisma.embargo.findMany({
        where: { legajoId: legajo.id, activo: true, fechaInicio: { lte: fechaFinPeriodo }, OR: [{ fechaFin: null }, { fechaFin: { gte: fechaReferencia } }] },
      });

      const netoPreEmbargos = resultado.neto;
      const anioActualEmbargo = fechaReferencia.getUTCFullYear();
      const mesActualEmbargo = fechaReferencia.getUTCMonth() + 1;

      const embargosJudiciales = tieneJudicialBajoControl ? [] : embargosActivos.filter((e) => e.tipo === "judicial" && e.porcentaje != null);

      let embargoComercialActivo: (typeof embargosActivos)[number] | null = null;
      let cuotaComercial: { id: string; importe: number; aplicado: boolean } | null = null;
      if (!tieneComercialBajoControl) {
        for (const embargo of embargosActivos.filter((e) => e.tipo === "comercial")) {
          if (p.hadEmbargoComercialAntes) {
            // Ya se aplicó antes en ESTA liquidación — buscar la cuota tal
            // cual esté (aplicado=true la mayoría de las veces) para
            // reusar su importe, no una "pendiente" que ya no existe.
            const cuota = await prisma.cuotaEmbargo.findUnique({ where: { embargoId_anio_mes: { embargoId: embargo.id, anio: anioActualEmbargo, mes: mesActualEmbargo } } });
            if (cuota) { embargoComercialActivo = embargo; cuotaComercial = cuota; break; }
          } else {
            const cuota = await prisma.cuotaEmbargo.findUnique({ where: { embargoId_anio_mes: { embargoId: embargo.id, anio: anioActualEmbargo, mes: mesActualEmbargo } } });
            if (cuota && !cuota.aplicado) { embargoComercialActivo = embargo; cuotaComercial = cuota; esAplicacionNuevaDeCuota = true; break; }
          }
        }
      }

      if (embargosJudiciales.length > 0 || cuotaComercial) {
        const resultadoEmbargos = procesarEmbargosDelLegajo({
          netoPreEmbargos,
          embargosJudiciales: embargosJudiciales.map((e) => ({ porcentaje: e.porcentaje! })),
          embargoComercialSolicitado: cuotaComercial?.importe ?? 0,
        });

        if (resultadoEmbargos.totalJudicial > 0) {
          if (existeConcepto("EMBARGO_JUDICIAL")) {
            resultado.detalle.push({ conceptoCodigo: "EMBARGO_JUDICIAL", nombre: "Embargo Judicial", tipo: "descuento", importe: resultadoEmbargos.totalJudicial, aporta: false, contribuye: false, formula: null });
            resultado.neto -= resultadoEmbargos.totalJudicial;
          } else {
            advertencias.push(`Corresponde Embargo Judicial ($${resultadoEmbargos.totalJudicial.toFixed(2)}) pero falta crear el concepto "EMBARGO_JUDICIAL" en el catálogo de esta empresa — no se aplicó.`);
          }
        }

        if (resultadoEmbargos.comercialAplicado > 0 && embargoComercialActivo && cuotaComercial) {
          if (!existeConcepto("EMBARGO_COMERCIAL")) {
            advertencias.push(`Corresponde Embargo Comercial ($${resultadoEmbargos.comercialAplicado.toFixed(2)}) pero falta crear el concepto "EMBARGO_COMERCIAL" en el catálogo de esta empresa — no se aplicó.`);
          } else {
            if (topes.SMVM) {
              const tope = calcularTopeEmbargoComercial(resultado.bruto, topes.SMVM);
              if (cuotaComercial.importe > tope) {
                advertencias.push(`Embargo comercial "${embargoComercialActivo.descripcion}": la cuota de este mes ($${cuotaComercial.importe.toFixed(2)}) supera el tope legal del Decreto 484/87 para este sueldo ($${tope.toFixed(2)}).`);
              }
            }
            resultado.detalle.push({ conceptoCodigo: "EMBARGO_COMERCIAL", nombre: "Embargo Comercial", tipo: "descuento", importe: resultadoEmbargos.comercialAplicado, aporta: false, contribuye: false, formula: null });
            resultado.neto -= resultadoEmbargos.comercialAplicado;
            // La cuota solo se marca aplicado=true si realmente se pudo
            // persistir la fila — si faltaba el concepto, no se toca el
            // flag, para no "quemar" una cuota real sin haberla aplicado.
            if (esAplicacionNuevaDeCuota) cuotaAAplicar = { id: cuotaComercial.id };
          }
        }

        advertencias.push(...resultadoEmbargos.advertencias);
      }
    } catch (e: any) {
      console.error(`Error calculando embargos (recálculo individual) para legajo ${legajo.numeroLegajo}:`, e);
    }
  }

  return { resultado, advertenciasEmbargo: advertencias, cuotaAAplicar };
}
