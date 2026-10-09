// El empleado retira un pedido propio — solo mientras siga pendiente. Una
// vez aprobado, para dar marcha atrás tiene que hablar con RR.HH. (ya hay
// una vacación registrada y posiblemente notificada).
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerSesionPortal } from "@/lib/portal";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    const sesion = await obtenerSesionPortal();
    if (!sesion) return NextResponse.json({ error: "Tu sesión venció. Volvé a ingresar." }, { status: 401 });

    const { count } = await prisma.solicitudAusencia.updateMany({
      where: { id: params.id, legajoId: sesion.legajoId, estado: "pendiente" },
      data: { estado: "cancelada", resueltoEn: new Date() },
    });
    if (count === 0) return NextResponse.json({ error: "Ese pedido ya fue respondido o no existe." }, { status: 409 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("Error en POST /api/portal/solicitudes/[id]/cancelar:", e);
    return NextResponse.json({ error: "No se pudo cancelar. Probá de nuevo en un momento." }, { status: 500 });
  }
}
