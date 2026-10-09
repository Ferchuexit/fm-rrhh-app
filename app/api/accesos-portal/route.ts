// FM RRHH — app/api/accesos-portal/route.ts
// Lado RR.HH. del portal del empleado: quién tiene acceso, generar o
// resetear el PIN temporal, y activar/desactivar.
//
// Ojo con la ubicación: NO cuelga de /api/portal a propósito. /api/portal
// es lo que usa el EMPLEADO (cookie sesion_portal); esto lo usa quien
// opera el sistema (cookie sesion), y pasa por las reglas de siempre del
// middleware (rol lectura no puede escribir).
//
// Siempre trabaja sobre la empresa actual del usuario — un operador de un
// cliente no puede generarle un PIN a un legajo de otra empresa.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, obtenerSesionActual } from "@/lib/auth";
import { obtenerEmpresaActual } from "@/lib/empresa-actual";
import { generarPinTemporal } from "@/lib/portal-pin";

export const dynamic = "force-dynamic";

// bcrypt cuesta ~0,1 s por PIN. Generar para toda la dotación en un solo
// pedido se pasaría del tiempo máximo de una función en Vercel, así que el
// alta masiva va por tandas y la pantalla repite hasta terminar.
const TANDA = 25;

export async function GET() {
  const empresa = await obtenerEmpresaActual();
  if (!empresa) return NextResponse.json({ legajos: [] });

  const legajos = await prisma.legajo.findMany({
    where: { empresaId: empresa.id, OR: [{ condicion: "activo" }, { accesoPortal: { isNot: null } }] },
    select: {
      id: true, numeroLegajo: true, apellido: true, nombre: true, condicion: true,
      accesoPortal: { select: { activo: true, debeCambiarPin: true, ultimoIngreso: true, bloqueadoHasta: true, updatedAt: true } },
    },
    orderBy: { numeroLegajo: "asc" },
  });
  return NextResponse.json({ empresa: empresa.nombreFantasia || empresa.razonSocial, legajos });
}

export async function POST(req: Request) {
  try {
    const empresa = await obtenerEmpresaActual();
    const sesion = await obtenerSesionActual();
    if (!empresa || !sesion) return NextResponse.json({ error: "No hay una empresa seleccionada." }, { status: 400 });

    const { legajoId, todosSinAcceso } = await req.json();

    const legajos = todosSinAcceso
      ? await prisma.legajo.findMany({
          where: { empresaId: empresa.id, condicion: "activo", accesoPortal: null },
          orderBy: { numeroLegajo: "asc" },
          take: TANDA,
        })
      : await prisma.legajo.findMany({ where: { id: String(legajoId ?? ""), empresaId: empresa.id } });

    if (!todosSinAcceso && legajos.length === 0) {
      return NextResponse.json({ error: "No se encontró ese legajo en la empresa actual." }, { status: 404 });
    }

    // El PIN en texto plano existe solo en esta respuesta: en la base queda
    // el hash. Si se pierde antes de entregarlo, se genera otro.
    const generados = [];
    for (const l of legajos) {
      const pin = generarPinTemporal(l.cuil);
      const datos = { pinHash: await hashPassword(pin), debeCambiarPin: true, activo: true, intentosFallidos: 0, bloqueadoHasta: null, generadoPor: sesion.email };
      await prisma.accesoPortal.upsert({ where: { legajoId: l.id }, create: { legajoId: l.id, ...datos }, update: datos });
      generados.push({ legajoId: l.id, numeroLegajo: l.numeroLegajo, apellido: l.apellido, nombre: l.nombre, cuil: l.cuil, pinTemporal: pin });
    }

    const restantes = todosSinAcceso
      ? await prisma.legajo.count({ where: { empresaId: empresa.id, condicion: "activo", accesoPortal: null } })
      : 0;
    return NextResponse.json({ generados, restantes });
  } catch (e: any) {
    console.error("Error en POST /api/accesos-portal:", e);
    return NextResponse.json({ error: e.message ?? "No se pudo generar el acceso." }, { status: 500 });
  }
}

// Activar / desactivar. Desactivar corta el ingreso al instante en el
// login; no borra nada (las firmas ya hechas quedan).
export async function PATCH(req: Request) {
  try {
    const empresa = await obtenerEmpresaActual();
    if (!empresa) return NextResponse.json({ error: "No hay una empresa seleccionada." }, { status: 400 });
    const { legajoId, activo } = await req.json();

    const { count } = await prisma.accesoPortal.updateMany({
      where: { legajoId: String(legajoId ?? ""), legajo: { empresaId: empresa.id } },
      data: { activo: activo === true },
    });
    if (count === 0) return NextResponse.json({ error: "Ese legajo no tiene acceso al portal en la empresa actual." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("Error en PATCH /api/accesos-portal:", e);
    return NextResponse.json({ error: e.message ?? "No se pudo actualizar el acceso." }, { status: 500 });
  }
}
