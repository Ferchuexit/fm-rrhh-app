import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Renombrar una categoría (corregir un typo, ajustar el nombre a como lo
// llama la paritaria, etc.) — es seguro editar en el lugar: el nombre es
// solo una etiqueta, ninguna Liquidacion ni LiquidacionDetalle guarda el
// texto del nombre, guardan importes ya calculados. No hace falta
// versionar esto como sí hace falta con Escala.basico.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const { nombre } = await req.json();
    if (!nombre?.trim()) {
      return NextResponse.json({ error: "Falta el nombre." }, { status: 400 });
    }
    const categoria = await prisma.categoria.update({
      where: { id: params.id },
      data: { nombre: nombre.trim() },
    });
    return NextResponse.json(categoria);
  } catch (e: any) {
    console.error("Error en PATCH /api/categorias/[id]:", e);
    return NextResponse.json({ error: e.message ?? "No se pudo renombrar la categoría." }, { status: 500 });
  }
}
