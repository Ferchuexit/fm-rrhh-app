// FM RRHH — app/api/liquidacion-individual/agregar/route.ts
//
// Agrega un concepto SIN fórmula propia a una liquidación puntual (punto 3
// del rediseño). Solo tiene sentido para conceptos que no tienen una
// ReglaConcepto en el convenio del legajo — si la tuviera, el motor ya lo
// calcula solo y no hace falta (ni corresponde) agregarlo a mano. Tampoco
// se puede agregar SAC/Ganancias/Embargos manualmente — esos se calculan
// solos (ver lib/liquidacion-individual-recalculo.ts); si aparecen en la
// liquidación es porque el recálculo automático los generó.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { construirContextoMotorLegajo } from "@/lib/liquidacion-individual-motor";
import { recalcularLiquidacionCompleta, CODIGOS_SAC, CODIGO_GANANCIAS, CODIGOS_EMBARGO } from "@/lib/liquidacion-individual-recalculo";
import { obtenerSesionActual } from "@/lib/auth";

const CODIGOS_ESPECIALES = [...CODIGOS_SAC, CODIGO_GANANCIAS, ...CODIGOS_EMBARGO];

export async function POST(req: Request) {
  try {
    const sesion = await obtenerSesionActual();
    if (!sesion) return NextResponse.json({ error: "No hay sesión activa." }, { status: 401 });

    const { liquidacionId, conceptoCodigo, importe, nota } = (await req.json()) as {
      liquidacionId: string;
      conceptoCodigo: string;
      importe: number;
      nota?: string;
    };
    if (!liquidacionId || !conceptoCodigo || importe == null || isNaN(importe)) {
      return NextResponse.json({ error: "Faltan datos (liquidacionId, conceptoCodigo, importe)." }, { status: 400 });
    }
    if (CODIGOS_ESPECIALES.includes(conceptoCodigo)) {
      return NextResponse.json({ error: "SAC, Retención de Ganancias y Embargos se calculan solos — no se agregan a mano." }, { status: 409 });
    }

    const liquidacion = await prisma.liquidacion.findUniqueOrThrow({ where: { id: liquidacionId }, include: { periodo: true } });
    if (liquidacion.periodo.estado === "cerrada") {
      return NextResponse.json(
        { error: `El período "${liquidacion.periodo.nombre}" está cerrado — no se puede editar sin querer. Reabrilo primero en /auditoria si es intencional.` },
        { status: 409 }
      );
    }
    if (!liquidacion.vigente) {
      return NextResponse.json({ error: "Esta es una versión vieja de la liquidación — no se puede editar." }, { status: 409 });
    }

    const concepto = await prisma.concepto.findUnique({ where: { codigo: conceptoCodigo } });
    if (!concepto) return NextResponse.json({ error: `No existe ningún concepto con código "${conceptoCodigo}".` }, { status: 404 });

    const detalleActual = await prisma.liquidacionDetalle.findMany({ where: { liquidacionId }, include: { concepto: true } });
    if (detalleActual.some((d) => d.conceptoId === concepto.id)) {
      return NextResponse.json({ error: `"${concepto.nombre}" ya está en esta liquidación — usá "Forzar" sobre esa fila en vez de agregarlo de nuevo.` }, { status: 409 });
    }
    const hadEmbargoComercialAntes = detalleActual.some((d) => d.concepto.codigo === "EMBARGO_COMERCIAL");

    const contexto = await construirContextoMotorLegajo(liquidacion.legajoId, liquidacion.periodoId);
    if (!contexto.ok) return NextResponse.json({ error: contexto.error }, { status: 422 });
    const { legajo, periodo, reglas, conceptos, insumosDirectosNovedades, cantidadesPorConcepto, valoresCategoria, topes, varsBase } = contexto;

    const codigosConRegla = new Set(reglas.map((r) => r.conceptoCodigo));
    if (codigosConRegla.has(conceptoCodigo)) {
      return NextResponse.json(
        { error: `"${concepto.nombre}" ya tiene una fórmula para este convenio — se calcula solo, no se puede agregar a mano. Si el número no es el esperado, revisá la fórmula en /reglas.` },
        { status: 409 }
      );
    }

    const overrides: Record<string, number> = {};
    const insumosPreservados: Record<string, number> = {};
    const codigosBajoControlManual = new Set<string>();
    for (const d of detalleActual) {
      if (codigosConRegla.has(d.concepto.codigo)) {
        if (d.excluido) overrides[d.concepto.codigo] = 0;
        else if (d.forzado) overrides[d.concepto.codigo] = d.importe;
        continue;
      }
      const esEspecial = CODIGOS_ESPECIALES.includes(d.concepto.codigo);
      if (d.excluido) {
        if (esEspecial) codigosBajoControlManual.add(d.concepto.codigo);
        continue;
      }
      if (d.forzado) {
        insumosPreservados[d.concepto.codigo] = d.importe;
        if (esEspecial) codigosBajoControlManual.add(d.concepto.codigo);
        continue;
      }
      if (esEspecial) continue; // se recalcula solo
      insumosPreservados[d.concepto.codigo] = d.importe;
    }
    const insumosDirectos = { ...insumosPreservados, ...insumosDirectosNovedades, [conceptoCodigo]: importe };

    let resultado: any, advertenciasEmbargo: string[], cuotaAAplicar: { id: string } | null;
    try {
      ({ resultado, advertenciasEmbargo, cuotaAAplicar } = await recalcularLiquidacionCompleta({
        legajo, periodo, varsBase, reglas, conceptos, cantidadesPorConcepto, valoresCategoria, topes,
        overrides, insumosDirectos, codigosBajoControlManual, hadEmbargoComercialAntes,
      }));
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 422 });
    }

    await prisma.$transaction(async (tx) => {
      let filaNuevaId: string | null = null;
      for (const d of resultado.detalle as any[]) {
        const c = conceptos.find((cc) => cc.codigo === d.conceptoCodigo);
        if (!c) continue;
        const filaExistente = detalleActual.find((f) => f.conceptoId === c.id);
        const forzadoEfectivo = !!d.forzado || codigosBajoControlManual.has(c.codigo);
        if (filaExistente) {
          await tx.liquidacionDetalle.update({
            where: { id: filaExistente.id },
            data: { importe: d.importe, importeCalculado: d.forzado ? d.importeCalculado : null, forzado: forzadoEfectivo, formulaUsada: d.formula ?? filaExistente.formulaUsada },
          });
        } else {
          const creada = await tx.liquidacionDetalle.create({
            data: {
              liquidacionId,
              conceptoId: c.id,
              importe: d.importe,
              formulaUsada: d.formula ?? null,
              origen: d.formula ? "motor" : "manual",
            },
          });
          if (c.codigo === conceptoCodigo) filaNuevaId = creada.id;
        }
      }

      if (cuotaAAplicar) {
        await tx.cuotaEmbargo.update({ where: { id: cuotaAAplicar.id }, data: { aplicado: true } });
      }

      await tx.liquidacion.update({ where: { id: liquidacionId }, data: { bruto: resultado.bruto, neto: resultado.neto } });

      if (filaNuevaId) {
        await tx.liquidacionDetalleEdicion.create({
          data: {
            liquidacionDetalleId: filaNuevaId,
            conceptoId: concepto.id,
            tipoAccion: "agregado",
            valorAnterior: null,
            valorNuevo: importe,
            usuarioId: sesion.id,
            nota: nota?.trim() || null,
          },
        });
      }
    });

    return NextResponse.json({ ok: true, bruto: resultado.bruto, neto: resultado.neto, advertencias: advertenciasEmbargo });
  } catch (e: any) {
    console.error("Error en POST /api/liquidacion-individual/agregar:", e);
    return NextResponse.json({ error: e.message ?? "Error inesperado." }, { status: 500 });
  }
}
