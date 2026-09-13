// FM RRHH — app/api/legajos/[id]/docente-liquidaciones/[periodo]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerSesionActual } from "@/lib/auth";

export async function GET(req: Request, { params }: { params: { id: string; periodo: string } }) {
  const sesion = await obtenerSesionActual();
  if (!sesion) return NextResponse.json({ error: "No hay sesión activa." }, { status: 401 });

  const docLiquidacion = await prisma.docLiquidacion.findFirst({
    where: { legajoId: params.id, periodo: params.periodo },
    include: {
      detalles: {
        include: { docDesignacion: { include: { docCargo: true } } },
        orderBy: [{ docDesignacionId: "asc" }, { createdAt: "asc" }],
      },
    },
  });
  if (!docLiquidacion) return NextResponse.json(null);

  // Agrupa por designación, como el "Detalle de cargos" del recibo de FEB.
  const porDesignacion = new Map<string, any>();
  for (const d of docLiquidacion.detalles) {
    const key = d.docDesignacionId;
    if (!porDesignacion.has(key)) {
      porDesignacion.set(key, {
        designacionId: key,
        cargo: d.docDesignacion.docCargo.nombre,
        modalidad: d.docDesignacion.docCargo.modalidad,
        nivel: d.docDesignacion.docCargo.nivel,
        detalle: [],
        bolsillo: 0,
      });
    }
    const grupo = porDesignacion.get(key);
    grupo.detalle.push({ codigo: d.conceptoCodigo, nombre: d.nombre, importe: Number(d.importe), tipo: d.tipo });
    grupo.bolsillo += Number(d.importe);
  }

  const designaciones = Array.from(porDesignacion.values()).map((g) => ({ ...g, bolsillo: Math.round(g.bolsillo * 100) / 100 }));
  const totalBolsillo = Math.round(designaciones.reduce((acc, d) => acc + d.bolsillo, 0) * 100) / 100;

  return NextResponse.json({ periodo: docLiquidacion.periodo, estado: docLiquidacion.estado, designaciones, totalBolsillo });
}
