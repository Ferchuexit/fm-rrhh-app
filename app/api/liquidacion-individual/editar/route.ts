// FM RRHH — app/api/liquidacion-individual/editar/route.ts
//
// Forzar / restaurar / excluir / reincluir UN concepto de UNA liquidación
// puntual (Liquidación Individual, puntos 4, 5 y 10 del rediseño). Recalcula
// en vivo usando el motor real (liquidarLegajo con overrides) — así que
// aportes, contribuciones y neto cascadean solos, sin lógica paralela.
//
// ALCANCE (actualizado 07/09/2026, tercera etapa): ahora también recalcula
// SAC, Retención de Ganancias y Embargos en vivo, reutilizando las mismas
// funciones puras que la Masiva (ver lib/liquidacion-individual-recalculo.ts)
// — salvo que el usuario haya forzado o excluido alguno de esos tres a
// mano, en cuyo caso se respeta esa decisión y no se recalculan solos.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { construirContextoMotorLegajo } from "@/lib/liquidacion-individual-motor";
import { recalcularLiquidacionCompleta, CODIGOS_SAC, CODIGO_GANANCIAS, CODIGOS_EMBARGO } from "@/lib/liquidacion-individual-recalculo";
import { obtenerSesionActual } from "@/lib/auth";

const CODIGOS_ESPECIALES = [...CODIGOS_SAC, CODIGO_GANANCIAS, ...CODIGOS_EMBARGO];

type Accion = "forzar" | "restaurar" | "excluir" | "reincluir";

export async function POST(req: Request) {
  try {
    const sesion = await obtenerSesionActual();
    if (!sesion) return NextResponse.json({ error: "No hay sesión activa." }, { status: 401 });

    const { liquidacionDetalleId, accion, valor, nota } = (await req.json()) as {
      liquidacionDetalleId: string;
      accion: Accion;
      valor?: number;
      nota?: string;
    };
    if (!liquidacionDetalleId || !accion) return NextResponse.json({ error: "Faltan datos (liquidacionDetalleId, accion)." }, { status: 400 });
    if (accion === "forzar" && (valor == null || isNaN(valor))) {
      return NextResponse.json({ error: "Falta el importe a forzar." }, { status: 400 });
    }

    const filaObjetivo = await prisma.liquidacionDetalle.findUniqueOrThrow({
      where: { id: liquidacionDetalleId },
      include: { concepto: true, liquidacion: { include: { periodo: true } } },
    });
    const { liquidacion } = filaObjetivo;
    const { periodo } = liquidacion;

    if (periodo.estado === "cerrada") {
      return NextResponse.json(
        { error: `El período "${periodo.nombre}" está cerrado — no se puede editar sin querer. Reabrilo primero en /auditoria si es intencional.` },
        { status: 409 }
      );
    }
    if (!liquidacion.vigente) {
      return NextResponse.json({ error: "Esta es una versión vieja de la liquidación (no la vigente) — no se puede editar." }, { status: 409 });
    }

    const contexto = await construirContextoMotorLegajo(liquidacion.legajoId, liquidacion.periodoId);
    if (!contexto.ok) return NextResponse.json({ error: contexto.error }, { status: 422 });
    const { legajo, varsBase, reglas, conceptos, insumosDirectosNovedades, cantidadesPorConcepto, valoresCategoria, topes } = contexto;

    const codigosConRegla = new Set(reglas.map((r) => r.conceptoCodigo));
    const tieneRegla = codigosConRegla.has(filaObjetivo.concepto.codigo);
    const esEspecialObjetivo = CODIGOS_ESPECIALES.includes(filaObjetivo.concepto.codigo);

    // ── Traer TODAS las filas actuales de esta liquidación, para no perder
    // otras excepciones ya vigentes al recalcular por ESTE cambio ──
    const detalleActual = await prisma.liquidacionDetalle.findMany({ where: { liquidacionId: liquidacion.id }, include: { concepto: true } });
    const hadEmbargoComercialAntes = detalleActual.some((d) => d.concepto.codigo === "EMBARGO_COMERCIAL");

    // Overrides: conceptos CON regla que están forzados o excluidos (excluido = forzado a 0).
    const overrides: Record<string, number> = {};
    for (const d of detalleActual) {
      if (!codigosConRegla.has(d.concepto.codigo)) continue;
      if (d.excluido) overrides[d.concepto.codigo] = 0;
      else if (d.forzado) overrides[d.concepto.codigo] = d.importe;
    }

    // Insumos: conceptos SIN regla. Los "especiales" (SAC/Ganancias/Embargos)
    // NO se preservan a ciegas acá — se recalculan dinámicamente más abajo,
    // salvo que estén forzados o excluidos (control manual del usuario).
    const insumosPreservados: Record<string, number> = {};
    const codigosBajoControlManual = new Set<string>();
    for (const d of detalleActual) {
      if (codigosConRegla.has(d.concepto.codigo)) continue;
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
      if (esEspecial) continue; // se recalcula solo, no se copia a ciegas
      insumosPreservados[d.concepto.codigo] = d.importe; // concepto manual genérico
    }
    const insumosDirectos = { ...insumosPreservados, ...insumosDirectosNovedades };

    // ── Aplicar la acción pedida sobre el concepto objetivo ──
    const codigo = filaObjetivo.concepto.codigo;
    let excluidoNuevo = filaObjetivo.excluido;
    if (accion === "forzar") {
      if (filaObjetivo.excluido) return NextResponse.json({ error: "Este concepto está excluido — reincluilo antes de forzar un importe." }, { status: 409 });
      if (tieneRegla) overrides[codigo] = valor!;
      else {
        insumosDirectos[codigo] = valor!;
        if (esEspecialObjetivo) codigosBajoControlManual.add(codigo);
      }
    } else if (accion === "restaurar") {
      if (tieneRegla) delete overrides[codigo];
      else if (esEspecialObjetivo) {
        codigosBajoControlManual.delete(codigo); // vuelve a calcularse solo
        delete insumosDirectos[codigo];
      }
      // si no tiene regla y no es especial, "restaurar" no aplica — el cliente no debería ofrecer este botón ahí
    } else if (accion === "excluir") {
      excluidoNuevo = true;
      if (tieneRegla) overrides[codigo] = 0;
      else {
        delete insumosDirectos[codigo];
        if (esEspecialObjetivo) codigosBajoControlManual.add(codigo);
      }
    } else if (accion === "reincluir") {
      excluidoNuevo = false;
      if (tieneRegla) delete overrides[codigo]; // vuelve a la fórmula — si estaba forzado a otro valor antes de excluirlo, ese forzado se pierde (simplificación a propósito)
      else if (esEspecialObjetivo) {
        codigosBajoControlManual.delete(codigo); // vuelve a calcularse solo, no al último importe viejo
      } else {
        insumosDirectos[codigo] = filaObjetivo.importe; // vuelve con el último importe que tenía
      }
    }

    let resultado: any, advertenciasEmbargo: string[], cuotasAAplicar: { id: string }[];
    try {
      ({ resultado, advertenciasEmbargo, cuotasAAplicar } = await recalcularLiquidacionCompleta({
        legajo, periodo, varsBase, reglas, conceptos, cantidadesPorConcepto, valoresCategoria, topes,
        overrides, insumosDirectos, codigosBajoControlManual, hadEmbargoComercialAntes,
      }));
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 422 });
    }

    // ── Persistir: actualizar cada fila de detalle con su nuevo valor efectivo ──
    await prisma.$transaction(async (tx) => {
      for (const d of resultado.detalle as any[]) {
        const concepto = conceptos.find((c) => c.codigo === d.conceptoCodigo);
        if (!concepto) continue;
        const filaExistente = detalleActual.find((f) => f.conceptoId === concepto.id);
        const esElObjetivo = concepto.codigo === codigo;
        const nuevoExcluido = esElObjetivo ? excluidoNuevo : filaExistente?.excluido ?? false;
        const forzadoEfectivo = !!d.forzado || (codigosBajoControlManual.has(concepto.codigo) && !nuevoExcluido);

        if (filaExistente) {
          await tx.liquidacionDetalle.update({
            where: { id: filaExistente.id },
            data: {
              importe: d.importe,
              importeCalculado: d.forzado ? d.importeCalculado : null,
              forzado: forzadoEfectivo,
              excluido: nuevoExcluido,
              formulaUsada: d.formula ?? filaExistente.formulaUsada,
            },
          });
        } else {
          await tx.liquidacionDetalle.create({
            data: {
              liquidacionId: liquidacion.id,
              conceptoId: concepto.id,
              importe: d.importe,
              importeCalculado: d.forzado ? d.importeCalculado : null,
              forzado: forzadoEfectivo,
              excluido: nuevoExcluido,
              formulaUsada: d.formula ?? null,
              origen: d.formula ? "motor" : "manual",
            },
          });
        }
      }

      for (const cuota of cuotasAAplicar) {
        await tx.cuotaEmbargo.update({ where: { id: cuota.id }, data: { aplicado: true } });
      }

      await tx.liquidacion.update({ where: { id: liquidacion.id }, data: { bruto: resultado.bruto, neto: resultado.neto } });

      await tx.liquidacionDetalleEdicion.create({
        data: {
          liquidacionDetalleId: filaObjetivo.id,
          conceptoId: filaObjetivo.conceptoId,
          tipoAccion: accion,
          valorAnterior: filaObjetivo.importe,
          valorNuevo: accion === "excluir" ? null : accion === "forzar" ? valor! : (resultado.detalle as any[]).find((d) => d.conceptoCodigo === codigo)?.importe ?? null,
          usuarioId: sesion.id,
          nota: nota?.trim() || null,
        },
      });
    });

    return NextResponse.json({ ok: true, bruto: resultado.bruto, neto: resultado.neto, advertencias: advertenciasEmbargo });
  } catch (e: any) {
    console.error("Error en POST /api/liquidacion-individual/editar:", e);
    return NextResponse.json({ error: e.message ?? "Error inesperado." }, { status: 500 });
  }
}
