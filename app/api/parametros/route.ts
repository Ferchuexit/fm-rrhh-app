// FM RRHH — app/api/parametros/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";


// Sin esto, Next.js puede intentar generar esta ruta como página ESTÁTICA en
// el momento del build (congelada con lo que hubiera en la base ese día) en
// vez de ejecutarla fresca en cada visita — encontrado el 09/09/2026 al
// preparar el primer deploy a Vercel (/api/rangos rompía el build por esto).
export const dynamic = "force-dynamic";

export async function GET() {
  const parametros = await prisma.parametroVigente.findMany({ orderBy: { vigenciaDesde: "desc" } });
  return NextResponse.json(parametros);
}

// Mismo principio que actualizarParametro() en parametros-topes.mjs: nunca
// se pisa el valor anterior — se cierra su vigencia y se crea uno nuevo.
export async function POST(req: Request) {
  try {
    const { clave, valor, vigenciaDesde, fuente } = await req.json();
    if (!clave || !valor || !vigenciaDesde) {
      return NextResponse.json({ error: "Faltan datos (clave, valor o fecha de vigencia)." }, { status: 400 });
    }

    const vigenteActual = await prisma.parametroVigente.findFirst({ where: { clave, vigenciaHasta: null } });
    if (vigenteActual) {
      const cierre = new Date(vigenciaDesde);
      cierre.setDate(cierre.getDate() - 1);
      await prisma.parametroVigente.update({ where: { id: vigenteActual.id }, data: { vigenciaHasta: cierre } });
    }

    const nuevo = await prisma.parametroVigente.create({
      data: { clave, valor: Number(valor), vigenciaDesde: new Date(vigenciaDesde), fuente: fuente || null },
    });

    return NextResponse.json(nuevo);
  } catch (e: any) {
    console.error("Error en POST /api/parametros:", e);
    return NextResponse.json({ error: e.message?.includes("Can't reach database") ? "No se pudo conectar con la base de datos — probá de nuevo en unos segundos." : (e.message ?? "No se pudo guardar el parámetro.") }, { status: 500 });
  }
}
