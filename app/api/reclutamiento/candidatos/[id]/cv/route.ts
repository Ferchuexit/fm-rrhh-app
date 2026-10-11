// El CV de un candidato, para RR.HH. Está guardado en privado: solo sale
// por acá, con sesión y permiso sobre Reclutamiento.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerEmpresaActual } from "@/lib/empresa-actual";
import { leerArchivo } from "@/lib/almacen-documentos";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const empresa = await obtenerEmpresaActual();
    if (!empresa) return NextResponse.json({ error: "No hay una empresa seleccionada." }, { status: 400 });
    const c = await prisma.candidato.findFirst({ where: { id: params.id, busqueda: { empresaId: empresa.id } }, select: { apellido: true, cvKey: true, cvBase64: true } });
    const archivo = c && (c.cvKey || c.cvBase64) ? await leerArchivo({ storageKey: c.cvKey, contenidoBase64: c.cvBase64 }) : null;
    if (!c || !archivo) return NextResponse.json({ error: "Ese candidato no tiene CV cargado." }, { status: 404 });
    return new NextResponse(archivo, { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="CV_${c.apellido.replace(/[^\w]+/g, "_")}.pdf"`, "X-Content-Type-Options": "nosniff" } });
  } catch (e) {
    console.error("Error en GET /api/reclutamiento/candidatos/[id]/cv:", e);
    return NextResponse.json({ error: "No se pudo abrir el CV." }, { status: 500 });
  }
}
