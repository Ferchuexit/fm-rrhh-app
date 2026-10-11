// FM RRHH — app/api/organigrama/route.ts
// El organigrama, solo para consultar: los puestos con quién ocupa cada
// uno, y quién reporta a quién. Se arma con lo que ya está cargado en
// Puestos y en el jefe de cada legajo; acá no se modifica nada.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerEmpresaActual } from "@/lib/empresa-actual";
import { organigrama } from "@/lib/reclutamiento-reglas";
import { arbolPersonas } from "@/lib/organigrama-reglas";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const empresa = await obtenerEmpresaActual();
    if (!empresa) return NextResponse.json({ error: "No hay una empresa seleccionada." }, { status: 400 });
    const [gente, puestos] = await Promise.all([
      // Aparte y no anidados: quien está limitado a un sector ve solo a su gente.
      prisma.legajo.findMany({ where: { empresaId: empresa.id, condicion: "activo" }, select: { id: true, nombre: true, apellido: true, jefeId: true, puestoId: true, centroCosto: { select: { nombre: true } } }, orderBy: [{ apellido: "asc" }, { nombre: "asc" }] }),
      prisma.puesto.findMany({ where: { empresaId: empresa.id }, select: { id: true, nombre: true, reportaAId: true, dotacion: true, mision: true, centroCosto: { select: { nombre: true } } } }),
    ]);
    const persona = (l: (typeof gente)[number]) => ({ id: l.id, nombre: `${l.nombre} ${l.apellido}`, sector: l.centroCosto?.nombre ?? null });
    const filas = organigrama(puestos.map((p) => ({ ...p, ocupantes: gente.filter((l) => l.puestoId === p.id).length })));
    const { arbol, sueltos } = arbolPersonas(gente.map((l) => ({ id: l.id, nombre: `${l.apellido}, ${l.nombre}`, jefeId: l.jefeId })));
    const porId = new Map(gente.map((l) => [l.id, l]));
    return NextResponse.json({
      dotacion: gente.length,
      puestos: filas.map((f) => ({ id: f.puesto.id, nombre: f.puesto.nombre, sector: f.puesto.centroCosto?.nombre ?? null, mision: f.puesto.mision, nivel: f.nivel, dotacion: f.puesto.dotacion, vacantes: f.vacantes, aCargo: f.aCargo, ocupantes: gente.filter((l) => l.puestoId === f.puesto.id).map(persona) })),
      sinPuesto: gente.filter((l) => !l.puestoId).map(persona),
      personas: arbol.map((f) => ({ ...persona(porId.get(f.persona.id)!), nivel: f.nivel, aCargo: f.aCargo })),
      sinJefe: sueltos.map((s) => persona(porId.get(s.id)!)),
    });
  } catch (e) {
    console.error("Error en GET /api/organigrama:", e);
    return NextResponse.json({ error: "No se pudo cargar el organigrama. Probá de nuevo en un momento." }, { status: 500 });
  }
}
