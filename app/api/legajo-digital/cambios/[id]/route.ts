// RR.HH. aprueba o rechaza un cambio de datos pedido por el empleado.
// Aprobar aplica los campos al Legajo en la misma transacción. Como la
// ficha y la DD.JJ. firmadas llevan la huella de los datos viejos, quedan
// "desactualizadas" solas y el portal le pide al empleado que las firme
// de nuevo — no hay que acordarse de nada.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerSesionActual } from "@/lib/auth";
import { obtenerEmpresaActual } from "@/lib/empresa-actual";
import { CAMPOS_EDITABLES, type Cambios, type CampoEditable } from "@/lib/legajo-digital";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const empresa = await obtenerEmpresaActual();
    const sesion = await obtenerSesionActual();
    if (!empresa || !sesion) return NextResponse.json({ error: "No hay una empresa seleccionada." }, { status: 400 });
    const { accion, respuesta } = await req.json().catch(() => ({}));
    const texto = String(respuesta ?? "").trim().slice(0, 300);
    if (accion !== "aprobar" && accion !== "rechazar") return NextResponse.json({ error: "Acción inválida." }, { status: 400 });
    if (accion === "rechazar" && texto.length < 5) return NextResponse.json({ error: "Al rechazar, escribí el motivo: es lo que va a leer el empleado." }, { status: 400 });

    const solicitud = await prisma.solicitudCambioDatos.findFirst({ where: { id: params.id, legajo: { empresaId: empresa.id } } });
    if (!solicitud) return NextResponse.json({ error: "No se encontró ese pedido en la empresa actual." }, { status: 404 });

    // Solo campos de la lista permitida, aunque el JSON guardado dijera otra cosa.
    const cambios = solicitud.cambios as Cambios;
    const datos: Record<string, string | null> = {};
    for (const campo of Object.keys(CAMPOS_EDITABLES) as CampoEditable[]) {
      if (cambios[campo]) datos[campo] = cambios[campo]!.despues || null;
    }

    await prisma.$transaction(async (tx) => {
      const { count } = await tx.solicitudCambioDatos.updateMany({
        where: { id: solicitud.id, estado: "pendiente" },
        data: { estado: accion === "aprobar" ? "aprobada" : "rechazada", respuesta: texto || null, resueltoPor: sesion.email, resueltoEn: new Date() },
      });
      if (count === 0) throw new Error("YA_RESPONDIDA");
      if (accion === "aprobar") await tx.legajo.update({ where: { id: solicitud.legajoId }, data: datos });
    });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e.message === "YA_RESPONDIDA") return NextResponse.json({ error: "Ese pedido ya fue respondido." }, { status: 409 });
    console.error("Error en POST /api/legajo-digital/cambios/[id]:", e);
    return NextResponse.json({ error: e.message ?? "No se pudo responder el pedido." }, { status: 500 });
  }
}
