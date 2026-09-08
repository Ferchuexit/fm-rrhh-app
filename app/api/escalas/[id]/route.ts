import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerSesionActual } from "@/lib/auth";

// OJO — esto es para CORREGIR UN ERROR DE TIPEO en una escala ya cargada
// (ej. cargaste $850.000 y era $580.000), NO para registrar un aumento
// real de paritaria. Un aumento real sigue yendo por POST /api/escalas
// (crea una vigencia nueva, preserva el valor histórico). Editar acá
// pisa el valor de esa fila para siempre — si esa escala ya se usó para
// liquidar a alguien, esas liquidaciones YA CERRADAS no cambian (el
// importe ya quedó grabado en LiquidacionDetalle en su momento), pero
// cualquier liquidación pendiente que la lea de ahora en más sí va a usar
// el valor corregido.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const sesion = await obtenerSesionActual();
    if (sesion?.rol !== "admin") {
      return NextResponse.json({ error: "Solo un administrador puede corregir una escala." }, { status: 403 });
    }

    const { basico, valorHora } = await req.json();
    const data: Record<string, number> = {};
    if (basico !== undefined) data.basico = Number(basico);
    if (valorHora !== undefined) data.valorHora = Number(valorHora);
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No mandaste ni básico ni valorHora para corregir." }, { status: 400 });
    }

    const escala = await prisma.escala.update({ where: { id: params.id }, data });
    return NextResponse.json(escala);
  } catch (e: any) {
    console.error("Error en PATCH /api/escalas/[id]:", e);
    return NextResponse.json({ error: e.message ?? "No se pudo corregir la escala." }, { status: 500 });
  }
}
