// RR.HH. acepta o rechaza un documento que subió el empleado. Rechazar
// exige el motivo: es lo que el empleado lee para saber qué volver a subir.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerSesionActual } from "@/lib/auth";
import { obtenerEmpresaActual } from "@/lib/empresa-actual";
import { avisar, avisoDocumentoRechazado } from "@/lib/avisos";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const empresa = await obtenerEmpresaActual();
    const sesion = await obtenerSesionActual();
    if (!empresa || !sesion) return NextResponse.json({ error: "No hay una empresa seleccionada." }, { status: 400 });
    const { accion, motivo } = await req.json().catch(() => ({}));
    const texto = String(motivo ?? "").trim().slice(0, 300);
    if (accion !== "aceptar" && accion !== "rechazar") return NextResponse.json({ error: "Acción inválida." }, { status: 400 });
    if (accion === "rechazar" && texto.length < 5) return NextResponse.json({ error: "Escribí por qué lo rechazás (por ejemplo: «la foto está cortada»)." }, { status: 400 });

    const { count } = await prisma.documentoLegajo.updateMany({
      where: { id: params.id, estado: "pendiente", legajo: { empresaId: empresa.id } },
      data: { estado: accion === "aceptar" ? "aceptado" : "rechazado", motivoRechazo: accion === "rechazar" ? texto : null, revisadoPor: sesion.email, revisadoEn: new Date() },
    });
    if (count === 0) return NextResponse.json({ error: "Ese documento ya fue revisado o no es de la empresa actual." }, { status: 409 });
    // Solo el rechazo le pide algo al empleado: tiene que subirlo de nuevo.
    if (accion === "rechazar") {
      const doc = await prisma.documentoLegajo.findUnique({ where: { id: params.id }, select: { legajoId: true } });
      if (doc) await avisar([doc.legajoId], avisoDocumentoRechazado());
    }
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("Error en POST /api/legajo-digital/documentos/[id]:", e);
    return NextResponse.json({ error: e.message ?? "No se pudo guardar la revisión." }, { status: 500 });
  }
}
