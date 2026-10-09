// PDF de una constancia que el empleado ya firmó (solo las propias).
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerSesionPortal } from "@/lib/portal";
import { generarConstanciaPDF } from "@/lib/constancia-pdf";
import type { Contenido } from "@/lib/legajo-digital";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const sesion = await obtenerSesionPortal();
  if (!sesion) return NextResponse.json({ error: "Tu sesión venció. Volvé a ingresar." }, { status: 401 });
  const c = await prisma.constanciaFirmada.findFirst({ where: { id: params.id, legajoId: sesion.legajoId }, include: { legajo: { select: { apellido: true, nombre: true } } } });
  if (!c) return NextResponse.json({ error: "No se encontró esa constancia." }, { status: 404 });
  const pdf = await generarConstanciaPDF(c.contenido as unknown as Contenido, { firmante: `${c.legajo.apellido}, ${c.legajo.nombre}`, firmadoEn: c.firmadoEn, ip: c.ipFirma, hash: c.hashContenido });
  return new NextResponse(Buffer.from(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${c.tipo}.pdf"`, "Cache-Control": "private, no-store" } });
}
