// FM RRHH — app/api/turnos/feriados/route.ts
// Feriados de la empresa actual. Se cargan por fecha; "sugerir" agrega de
// una vez los nacionales que no se mueven de fecha en un año.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerEmpresaActual } from "@/lib/empresa-actual";
import { fechaDesdeTexto } from "@/lib/ausencias-reglas";
import { feriadosInamovibles } from "@/lib/turnos";

export const dynamic = "force-dynamic";
const fallo = (e: any) => (e?.name === "FueraDeAlcance" ? NextResponse.json({ error: "Los feriados de la empresa los carga RR.HH." }, { status: 403 }) : NextResponse.json({ error: "No se pudo guardar. Probá de nuevo en un momento." }, { status: 500 }));

export async function GET(req: Request) {
  try {
    const empresa = await obtenerEmpresaActual();
    if (!empresa) return NextResponse.json({ error: "No hay una empresa seleccionada." }, { status: 400 });
    const anio = Number(new URL(req.url).searchParams.get("anio")) || new Date().getUTCFullYear();
    const feriados = await prisma.feriado.findMany({ where: { empresaId: empresa.id, fecha: { gte: new Date(Date.UTC(anio, 0, 1)), lte: new Date(Date.UTC(anio, 11, 31)) } }, orderBy: { fecha: "asc" } });
    return NextResponse.json({ anio, feriados });
  } catch (e) {
    console.error("Error en GET /api/turnos/feriados:", e);
    return NextResponse.json({ error: "No se pudieron cargar los feriados." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const empresa = await obtenerEmpresaActual();
    if (!empresa) return NextResponse.json({ error: "No hay una empresa seleccionada." }, { status: 400 });
    const body = await req.json().catch(() => ({}));

    if (body.sugerir) {
      const anio = Number(body.sugerir);
      if (!Number.isInteger(anio) || anio < 2020 || anio > 2100) return NextResponse.json({ error: "Año inválido." }, { status: 400 });
      const { count } = await prisma.feriado.createMany({ data: feriadosInamovibles(anio).map((f) => ({ empresaId: empresa.id, ...f })), skipDuplicates: true });
      return NextResponse.json({ ok: true, agregados: count });
    }

    const fecha = fechaDesdeTexto(body.fecha);
    const nombre = String(body.nombre ?? "").trim().slice(0, 80);
    if (!fecha) return NextResponse.json({ error: "Elegí la fecha del feriado." }, { status: 400 });
    if (nombre.length < 3) return NextResponse.json({ error: "Escribí qué feriado es." }, { status: 400 });
    await prisma.feriado.upsert({ where: { empresaId_fecha: { empresaId: empresa.id, fecha } }, create: { empresaId: empresa.id, fecha, nombre }, update: { nombre } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Error en POST /api/turnos/feriados:", e);
    return fallo(e);
  }
}

export async function DELETE(req: Request) {
  try {
    const empresa = await obtenerEmpresaActual();
    if (!empresa) return NextResponse.json({ error: "No hay una empresa seleccionada." }, { status: 400 });
    const { count } = await prisma.feriado.deleteMany({ where: { id: new URL(req.url).searchParams.get("id") ?? "", empresaId: empresa.id } });
    if (count === 0) return NextResponse.json({ error: "Ese feriado ya no existe." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Error en DELETE /api/turnos/feriados:", e);
    return fallo(e);
  }
}
