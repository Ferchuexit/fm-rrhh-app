// FM RRHH — app/api/conceptos/[id]/route.ts
// PATCH acepta `numero` y/o `nombre` por separado — se puede editar uno sin
// tocar el otro. El `codigo` (identificador interno del motor) y el `tipo`
// no se editan acá a propósito: cambiarlos rompería reglas y liquidaciones
// ya existentes que los referencian por ese valor exacto.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validarNumeroConcepto } from "@/lib/motor/catalogo-conceptos.mjs";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const { numero, nombre, categoriaNovedad } = await req.json();

  const concepto = await prisma.concepto.findUniqueOrThrow({ where: { id: params.id } });
  const data: { numero?: number; nombre?: string; categoriaNovedad?: string | null } = {};

  if (numero !== undefined) {
    const rangos = await prisma.rangoNumeracion.findMany();
    const conceptosExistentes = (await prisma.concepto.findMany()).filter((c) => c.id !== concepto.id);
    const validacion = validarNumeroConcepto(Number(numero), concepto.tipo, rangos, conceptosExistentes);
    if (!validacion.ok) {
      return NextResponse.json({ error: validacion.errores.join(" ") }, { status: 400 });
    }
    data.numero = Number(numero);
  }

  if (nombre !== undefined) {
    if (!nombre.trim()) return NextResponse.json({ error: "El nombre no puede quedar vacío." }, { status: 400 });
    data.nombre = nombre.trim();
  }

  if (categoriaNovedad !== undefined) {
    data.categoriaNovedad = categoriaNovedad || null;
  }

  const actualizado = await prisma.concepto.update({ where: { id: params.id }, data });
  return NextResponse.json(actualizado);
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const concepto = await prisma.concepto.findUniqueOrThrow({ where: { id: params.id } });
  const forzar = new URL(req.url).searchParams.get("forzar") === "true";

  // Chequeo que "forzar" NUNCA salta — si otra fórmula referencia a este
  // concepto por nombre (CONCEPTO('X') o CANTIDAD('X')), borrarlo deja esa
  // OTRA fórmula rota, sin ningún aviso hasta que alguien intente liquidar
  // de nuevo. Pasó de verdad (ver 73-borrado-seguro.md) — Antigüedad,
  // Presentismo y S.N.R. seguían mencionando un concepto ya borrado.
  const todasLasReglas = await prisma.reglaConcepto.findMany({ include: { concepto: true } });
  const reglasQueLoReferencian = todasLasReglas.filter(
    (r) => r.conceptoId !== params.id && (r.formula.includes(`'${concepto.codigo}'`) || r.formula.includes(`"${concepto.codigo}"`))
  );
  if (reglasQueLoReferencian.length > 0) {
    return NextResponse.json(
      {
        error: `No se puede eliminar "${concepto.codigo}" — otras fórmulas lo mencionan por nombre y quedarían rotas.`,
        puedeForzar: false, // a propósito — esto no tiene un "forzar" seguro, hay que arreglar las fórmulas primero
        formulasQueLoMencionan: reglasQueLoReferencian.map((r) => `${r.concepto.codigo}: "${r.formula}"`),
        solucion: `Editá esas fórmulas en /reglas para que dejen de usar "${concepto.codigo}" antes de borrarlo.`,
      },
      { status: 409 }
    );
  }

  const [enReglas, detalleQueUsanElConcepto, enNovedades] = await Promise.all([
    prisma.reglaConcepto.count({ where: { conceptoId: params.id } }),
    prisma.liquidacionDetalle.findMany({ where: { conceptoId: params.id }, select: { liquidacionId: true } }),
    prisma.novedad.count({ where: { conceptoId: params.id } }),
  ]);
  const liquidacionIds = [...new Set(detalleQueUsanElConcepto.map((d) => d.liquidacionId))];

  const usos: string[] = [];
  if (enReglas > 0) usos.push(`${enReglas} regla(s)`);
  if (liquidacionIds.length > 0) usos.push(`${liquidacionIds.length} liquidación(es)`);
  if (enNovedades > 0) usos.push(`${enNovedades} novedad(es)`);

  if (usos.length > 0 && !forzar) {
    return NextResponse.json(
      {
        error: `No se puede eliminar "${concepto.codigo}" — está en uso en: ${usos.join(", ")}.`,
        // El cliente usa esto para ofrecer el botón de "forzar" solo cuando
        // corresponde, con el detalle de qué se va a borrar en el mensaje.
        puedeForzar: true,
        detalleUso: { reglas: enReglas, liquidaciones: liquidacionIds.length, novedades: enNovedades },
      },
      { status: 409 }
    );
  }

  if (forzar) {
    // Se borran las liquidaciones ENTERAS que usaron este concepto (no solo
    // la línea de este concepto) — dejar el resto del detalle sin esa línea
    // haría que el bruto/neto ya guardado no coincida más con lo que
    // realmente se sumó. Si hace falta esa liquidación, hay que volver a
    // correrla desde /liquidar después de esto.
    if (liquidacionIds.length > 0) {
      await prisma.liquidacionDetalle.deleteMany({ where: { liquidacionId: { in: liquidacionIds } } });
      await prisma.liquidacion.deleteMany({ where: { id: { in: liquidacionIds } } });
    }
    await prisma.reglaConcepto.deleteMany({ where: { conceptoId: params.id } });
    await prisma.novedad.deleteMany({ where: { conceptoId: params.id } });
  }

  await prisma.concepto.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true, liquidacionesEliminadas: forzar ? liquidacionIds.length : 0 });
}
