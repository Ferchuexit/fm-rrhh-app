// FM RRHH — app/api/vacaciones/pendientes/route.ts
// Compara "días que corresponden por antigüedad" contra "días ya
// registrados" para el año pedido, por legajo. No mira si el empleado
// efectivamente salió de vacaciones — mira si HAY un registro de Vacacion
// cargado para ese año; la carga es lo que deja la constancia.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerEmpresaActual } from "@/lib/empresa-actual";
import { diasVacacionesPorAntiguedad, calcularAntiguedadAnios } from "@/lib/vacaciones";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const anio = Number(searchParams.get("anio")) || new Date().getFullYear();

  const empresa = await obtenerEmpresaActual();
  if (!empresa) return NextResponse.json([]);

  const legajos = await prisma.legajo.findMany({
    where: { empresaId: empresa.id, condicion: "activo" },
    include: { centroCosto: true },
  });

  const vacacionesDelAnio = await prisma.vacacion.findMany({
    where: { legajo: { empresaId: empresa.id }, anioCorresponde: anio },
  });

  // La antigüedad para el cálculo de días que corresponden se toma al 31/12
  // del año en cuestión — es el criterio habitual (LCT), a confirmar contra
  // el instructivo/convenio real.
  const fechaReferencia = new Date(anio, 11, 31);

  const pendientes = legajos.map((l) => {
    const antiguedadAnios = calcularAntiguedadAnios(l.fechaIngreso, l.antiguedadReconocida, fechaReferencia);
    const diasCorresponden = diasVacacionesPorAntiguedad(antiguedadAnios);
    const diasRegistrados = vacacionesDelAnio.filter((v) => v.legajoId === l.id).reduce((a, v) => a + v.diasCorresponden, 0);
    return {
      legajoId: l.id,
      numero: l.numeroLegajo,
      apellido: l.apellido,
      nombre: l.nombre,
      centroCosto: l.centroCosto?.nombre ?? null,
      diasCorresponden,
      diasRegistrados,
      diasPendientes: Math.max(0, diasCorresponden - diasRegistrados),
    };
  }).filter((p) => p.diasPendientes > 0);

  return NextResponse.json({ anio, pendientes });
}
