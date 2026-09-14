// FM RRHH — app/api/legajos/[id]/docente-liquidar/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerSesionActual } from "@/lib/auth";
import { obtenerEmpresaActual } from "@/lib/empresa-actual";
import { liquidarDesignacion } from "@/lib/motor/motor-docentes-pba.mjs";

// Devuelve el valor vigente para una fecha — el de mayor vigenciaDesde
// que sea <= la fecha del período. Mismo patrón que las escalas de
// Comercio/Madera.
async function valorIndiceVigente(fecha: Date) {
  return prisma.docValorIndice.findFirst({ where: { vigenciaDesde: { lte: fecha } }, orderBy: { vigenciaDesde: "desc" } });
}
async function conceptosVigentes(fecha: Date) {
  const conceptos = await prisma.docConcepto.findMany({ where: { activo: true } });
  const resultado = [];
  for (const c of conceptos) {
    const valor = await prisma.docValorConcepto.findFirst({
      where: { docConceptoId: c.id, vigenciaDesde: { lte: fecha } },
      orderBy: { vigenciaDesde: "desc" },
    });
    if (valor) resultado.push({ codigo: c.codigo, nombre: c.nombre, modoCalculo: c.modoCalculo, aplicaANivel: c.aplicaANivel, aplicaACargoNombre: c.aplicaACargoNombre, aportaAportes: c.aportaAportes, valor: Number(valor.valor) });
  }
  return resultado;
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const sesion = await obtenerSesionActual();
    if (!sesion) return NextResponse.json({ error: "No hay sesión activa." }, { status: 401 });

    const empresa = await obtenerEmpresaActual();
    if (!empresa) return NextResponse.json({ error: "No hay ninguna empresa cargada." }, { status: 400 });

    const legajo = await prisma.legajo.findFirst({ where: { id: params.id, empresaId: empresa.id } });
    if (!legajo) return NextResponse.json({ error: "Legajo no encontrado en esta empresa." }, { status: 404 });

    const { periodo } = await req.json(); // "2026-08"
    if (!periodo || !/^\d{4}-\d{2}$/.test(periodo)) {
      return NextResponse.json({ error: "Falta el período, formato AAAA-MM." }, { status: 400 });
    }
    const fechaPeriodo = new Date(`${periodo}-01T00:00:00Z`);

    const perfil = await prisma.docPerfilDocente.findUnique({
      where: { legajoId: params.id },
      include: { designaciones: { where: { activa: true }, include: { docCargo: true } } },
    });
    if (!perfil) return NextResponse.json({ error: "Este legajo todavía no tiene perfil docente ni designaciones cargadas." }, { status: 400 });
    if (perfil.designaciones.length === 0) {
      return NextResponse.json({ error: "Este legajo no tiene ninguna designación activa para liquidar." }, { status: 400 });
    }

    const valorIndice = await valorIndiceVigente(fechaPeriodo);
    if (!valorIndice) return NextResponse.json({ error: `No hay ningún valor de índice cargado con vigencia antes de ${periodo} — cargalo desde el script semilla o directo en la base.` }, { status: 400 });

    const conceptos = await conceptosVigentes(fechaPeriodo);

    // Volver a liquidar reemplaza los detalles anteriores de este mismo
    // período — mismo criterio que la liquidación masiva del resto del
    // sistema (no se acumulan versiones viejas).
    const docLiquidacion = await prisma.docLiquidacion.upsert({
      where: { legajoId_periodo: { legajoId: params.id, periodo } },
      update: {},
      create: { legajoId: params.id, periodo },
    });

    await prisma.docLiquidacionDetalle.deleteMany({ where: { docLiquidacionId: docLiquidacion.id } });

    const resultadosPorDesignacion = [];
    for (const designacion of perfil.designaciones) {
      const cargo = {
        nombre: designacion.docCargo.nombre,
        nivel: designacion.docCargo.nivel,
        modalidad: designacion.docCargo.modalidad,
        indice: Number(designacion.docCargo.indice),
        unidades: Number(designacion.docCargo.unidades),
        tipo: designacion.docCargo.tipo,
        divisorHoraCatedra: designacion.docCargo.divisorHoraCatedra,
      };
      const resultado = liquidarDesignacion({
        cargo,
        valorPorIndice: Number(valorIndice.valorPorIndice),
        aniosAntiguedad: perfil.antiguedadAnios,
        tramosAntiguedad: await prisma.docTramoAntiguedad.findMany(),
        conceptos,
        zonaDesfavorabilidad: designacion.zonaDesfavorabilidad,
        tramosZona: await prisma.docTramoZona.findMany(),
        cantidadModulos: designacion.cantidadModulos,
      });

      for (const linea of resultado.detalle) {
        await prisma.docLiquidacionDetalle.create({
          data: {
            docLiquidacionId: docLiquidacion.id,
            docDesignacionId: designacion.id,
            conceptoCodigo: linea.codigo,
            nombre: linea.nombre,
            importe: linea.importe,
            tipo: linea.tipo,
          },
        });
      }
      resultadosPorDesignacion.push({ designacionId: designacion.id, cargo: cargo.nombre, modalidad: cargo.modalidad, ...resultado });
    }

    const totalNeto = resultadosPorDesignacion.reduce((acc, r) => acc + r.neto, 0);

    return NextResponse.json({ ok: true, docLiquidacionId: docLiquidacion.id, periodo, designaciones: resultadosPorDesignacion, totalNeto: Math.round(totalNeto * 100) / 100 });
  } catch (e: any) {
    console.error("Error en POST /api/legajos/[id]/docente-liquidar:", e);
    return NextResponse.json({ error: e.message ?? "Error inesperado al liquidar." }, { status: 500 });
  }
}
