// FM RRHH — app/api/firmas-recibos/route.ts
// GET ?periodoId=... — estado de entrega y firma de cada recibo del
// período: quién lo vio, quién firmó (conforme / disconforme) y cuándo.
// Solo lectura: una firma no se edita ni se borra desde ninguna pantalla.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerEmpresasAutorizadas } from "@/lib/empresa-actual";
import { ESTADOS_PERIODO_PUBLICADOS } from "@/lib/portal";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const periodoId = new URL(req.url).searchParams.get("periodoId");
  if (!periodoId) return NextResponse.json({ error: "Falta periodoId." }, { status: 400 });

  const periodo = await prisma.periodo.findUnique({ where: { id: periodoId } });
  const autorizadas = await obtenerEmpresasAutorizadas();
  if (!periodo || !autorizadas.some((e) => e.id === periodo.empresaId)) {
    return NextResponse.json({ error: "No se encontró ese período." }, { status: 404 });
  }

  const liquidaciones = await prisma.liquidacion.findMany({
    where: { periodoId, vigente: true },
    select: {
      id: true, version: true, neto: true,
      legajo: { select: { numeroLegajo: true, apellido: true, nombre: true, accesoPortal: { select: { activo: true, debeCambiarPin: true } } } },
      reciboDigital: { select: { primeraVistaEn: true, firma: true, firmadoEn: true, observacion: true, ipFirma: true, hashContenido: true } },
    },
    orderBy: { legajo: { numeroLegajo: "asc" } },
  });

  return NextResponse.json({
    periodo: { nombre: periodo.nombre, estado: periodo.estado, publicado: ESTADOS_PERIODO_PUBLICADOS.includes(periodo.estado) },
    recibos: liquidaciones.map((l) => ({
      liquidacionId: l.id,
      version: l.version,
      neto: l.neto,
      numeroLegajo: l.legajo.numeroLegajo,
      apellido: l.legajo.apellido,
      nombre: l.legajo.nombre,
      // 'sin_acceso' | 'pin_temporal' (nunca entró) | 'activo' | 'desactivado'
      acceso: !l.legajo.accesoPortal ? "sin_acceso" : !l.legajo.accesoPortal.activo ? "desactivado" : l.legajo.accesoPortal.debeCambiarPin ? "pin_temporal" : "activo",
      vistoEn: l.reciboDigital?.primeraVistaEn ?? null,
      firma: l.reciboDigital?.firma ?? null,
      firmadoEn: l.reciboDigital?.firmadoEn ?? null,
      observacion: l.reciboDigital?.observacion ?? null,
      ipFirma: l.reciboDigital?.ipFirma ?? null,
      hashContenido: l.reciboDigital?.hashContenido ?? null,
    })),
  });
}
