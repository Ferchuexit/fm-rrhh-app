import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerPreliquidacion } from "@/lib/preliquidacion-data";

// Separador ";" a propósito, no ",": en configuración regional argentina,
// Excel usa la coma como separador decimal — un CSV separado por comas
// abre mal (todo en una sola columna). Con ";" abre perfecto sin que el
// cliente tenga que hacer nada raro al abrirlo.
function celda(v: string | number): string {
  const texto = String(v);
  // Si el valor tiene el separador, comillas, o salto de línea, hay que
  // encerrarlo entre comillas (y duplicar las comillas internas) — la
  // regla estándar de CSV (RFC 4180).
  if (texto.includes(";") || texto.includes('"') || texto.includes("\n")) {
    return `"${texto.replace(/"/g, '""')}"`;
  }
  return texto;
}

function money(n: number): string {
  return n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const periodoId = searchParams.get("periodoId");
  if (!periodoId) return NextResponse.json({ error: "Falta periodoId" }, { status: 400 });

  const periodo = await prisma.periodo.findUniqueOrThrow({ where: { id: periodoId } });
  const { columnas, filas } = await obtenerPreliquidacion(periodoId);

  const encabezado = ["Legajo", "Apellido y Nombre", "Convenio", ...columnas.map((c) => c.nombre), "Bruto", "Neto"];
  const lineas = [encabezado.map(celda).join(";")];

  for (const f of filas) {
    const fila = [
      f.numeroLegajo,
      `${f.apellido}, ${f.nombre}`,
      f.convenio,
      ...columnas.map((c) => (f.porConcepto[c.codigo] !== undefined ? money(f.porConcepto[c.codigo]) : "")),
      money(f.bruto),
      money(f.neto),
    ];
    lineas.push(fila.map(celda).join(";"));
  }

  // BOM (Byte Order Mark) al principio — sin esto, Excel en Windows a veces
  // rompe los acentos y la "ñ" al abrir un CSV con UTF-8.
  const csv = "\uFEFF" + lineas.join("\r\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="preliquidacion_${periodo.nombre.replace(/[^a-zA-Z0-9]/g, "_")}.csv"`,
    },
  });
}
