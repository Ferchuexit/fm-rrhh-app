import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const periodoId = searchParams.get("periodoId");
  if (!periodoId) return NextResponse.json({ error: "Falta periodoId" }, { status: 400 });

  const periodo = await prisma.periodo.findUniqueOrThrow({ where: { id: periodoId }, include: { convenio: true, empresa: true } });

  const legajos = await prisma.legajo.findMany({
    where: { empresaId: periodo.empresaId, condicion: "activo", ...(periodo.convenioId ? { convenioId: periodo.convenioId } : {}) },
    orderBy: { numeroLegajo: "asc" },
  });

  // Solo los conceptos que ESTE convenio realmente usa (tiene una regla
  // vigente) — para no listarle a Fernando 80 códigos de otros convenios
  // que no le sirven para nada acá.
  const reglas = periodo.convenioId
    ? await prisma.reglaConcepto.findMany({ where: { convenioId: periodo.convenioId, vigenciaHasta: null }, include: { concepto: true } })
    : [];
  const conceptosDelConvenio = reglas.map((r) => r.concepto).filter((c) => c.tipo !== "descuento");

  const fechaPeriodo = periodo.fechaDesde.toISOString().slice(0, 10);

  // Hoja 1: una fila por legajo, lista para completar — legajoNumero y
  // fecha YA puestos, para que solo haya que llenar concepto/cantidad/valor.
  const filasPlantilla = legajos.map((l) => ({
    legajoNumero: l.numeroLegajo,
    apellido: l.apellido, // de referencia, no se importa — para saber de quién es la fila sin tener que buscar
    nombre: l.nombre,
    fecha: fechaPeriodo,
    conceptoCodigo: "",
    cantidad: "",
    valor: "",
  }));
  // Una fila de ejemplo con datos realistas, primero, para que quede
  // claro el formato esperado — igual que hace cargarEjemplo() en la pantalla.
  filasPlantilla.unshift({
    legajoNumero: legajos[0]?.numeroLegajo ?? 1,
    apellido: "(ejemplo, borrar esta fila)",
    nombre: "",
    fecha: fechaPeriodo,
    conceptoCodigo: conceptosDelConvenio[0]?.codigo ?? "HS_EXTRA_50",
    cantidad: "8",
    valor: "",
  });

  const wsNovedades = XLSX.utils.json_to_sheet(filasPlantilla);
  wsNovedades["!cols"] = [{ wch: 12 }, { wch: 18 }, { wch: 18 }, { wch: 12 }, { wch: 16 }, { wch: 10 }, { wch: 12 }];

  // Hoja 2: referencia de qué códigos son válidos para este convenio, sin
  // tener que adivinar o ir a buscarlos a otra pantalla.
  const wsConceptos = XLSX.utils.json_to_sheet(
    conceptosDelConvenio.map((c) => ({ codigo: c.codigo, nombre: c.nombre, tipo: c.tipo, unidad: c.unidad }))
  );
  wsConceptos["!cols"] = [{ wch: 20 }, { wch: 35 }, { wch: 16 }, { wch: 12 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsNovedades, "Novedades");
  XLSX.utils.book_append_sheet(wb, wsConceptos, "Conceptos válidos");

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  const nombreArchivo = `plantilla-novedades-${periodo.nombre.replace(/[^a-zA-Z0-9]/g, "_")}.xlsx`;

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nombreArchivo}"`,
    },
  });
}
