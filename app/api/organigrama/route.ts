// FM RRHH — app/api/organigrama/route.ts
// El organigrama, solo para consultar: los puestos con quién ocupa cada
// uno, y quién reporta a quién. Se arma con lo que ya está cargado en
// Puestos y en el jefe de cada legajo.
//   POST { cambios: [{ id, jefeId?, puestoId?, centroCostoId? }] } → acomoda
//        la estructura de varias personas de una vez (sin entrar legajo por
//        legajo). Solo toca sector, puesto y jefe.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerEmpresaActual } from "@/lib/empresa-actual";
import { organigrama } from "@/lib/reclutamiento-reglas";
import { arbolPersonas, enCirculo } from "@/lib/organigrama-reglas";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const empresa = await obtenerEmpresaActual();
    if (!empresa) return NextResponse.json({ error: "No hay una empresa seleccionada." }, { status: 400 });
    const [gente, puestos] = await Promise.all([
      // Aparte y no anidados: quien está limitado a un sector ve solo a su gente.
      prisma.legajo.findMany({ where: { empresaId: empresa.id, condicion: "activo" }, select: { id: true, nombre: true, apellido: true, jefeId: true, puestoId: true, centroCostoId: true, centroCosto: { select: { nombre: true } } }, orderBy: [{ apellido: "asc" }, { nombre: "asc" }] }),
      prisma.puesto.findMany({ where: { empresaId: empresa.id }, select: { id: true, nombre: true, reportaAId: true, dotacion: true, mision: true, centroCosto: { select: { nombre: true } } } }),
    ]);
    const persona = (l: (typeof gente)[number]) => ({ id: l.id, nombre: `${l.nombre} ${l.apellido}`, sector: l.centroCosto?.nombre ?? null });
    const filas = organigrama(puestos.map((p) => ({ ...p, ocupantes: gente.filter((l) => l.puestoId === p.id).length })));
    const { arbol, sueltos } = arbolPersonas(gente.map((l) => ({ id: l.id, nombre: `${l.apellido}, ${l.nombre}`, jefeId: l.jefeId })));
    const porId = new Map(gente.map((l) => [l.id, l]));
    const sectores = await prisma.centroCosto.findMany({ where: { empresaId: empresa.id }, select: { id: true, nombre: true }, orderBy: { nombre: "asc" } });
    return NextResponse.json({
      // Para el árbol dibujado y para el editor de estructura.
      gente: gente.map((l) => ({ id: l.id, nombre: l.nombre, apellido: l.apellido, sector: l.centroCosto?.nombre ?? null, puesto: puestos.find((p) => p.id === l.puestoId)?.nombre ?? null, jefeId: l.jefeId, puestoId: l.puestoId, centroCostoId: l.centroCostoId })),
      sectores, listaPuestos: puestos.map((p) => ({ id: p.id, nombre: p.nombre })).sort((a, b) => a.nombre.localeCompare(b.nombre)),
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

export async function POST(req: Request) {
  try {
    const empresa = await obtenerEmpresaActual();
    if (!empresa) return NextResponse.json({ error: "No hay una empresa seleccionada." }, { status: 400 });
    const body = await req.json().catch(() => ({}));
    const cambios: any[] = Array.isArray(body.cambios) ? body.cambios.slice(0, 1000) : [];
    if (cambios.length === 0) return NextResponse.json({ error: "No hay cambios para guardar." }, { status: 400 });
    // prisma.legajo ya filtra por alcance: quien está limitado a sectores solo mueve a su gente.
    const [gente, todos, sectores, puestos] = await Promise.all([
      prisma.legajo.findMany({ where: { empresaId: empresa.id, condicion: "activo" }, select: { id: true, jefeId: true } }),
      prisma.legajo.findMany({ where: { empresaId: empresa.id, condicion: "activo" }, select: { id: true } }),
      prisma.centroCosto.findMany({ where: { empresaId: empresa.id }, select: { id: true } }),
      prisma.puesto.findMany({ where: { empresaId: empresa.id }, select: { id: true } }),
    ]);
    const ids = new Set(gente.map((l) => l.id)), jefes = new Set(todos.map((l) => l.id));
    const sec = new Set(sectores.map((s) => s.id)), pue = new Set(puestos.map((p) => p.id));
    const jefeDe = new Map(gente.map((l) => [l.id, l.jefeId]));
    const limpios: { id: string; data: Record<string, string | null> }[] = [];
    for (const c of cambios) {
      const id = String(c?.id ?? "");
      if (!ids.has(id)) return NextResponse.json({ error: "Alguna de las personas ya no figura (o no está entre las que podés modificar). Recargá la página." }, { status: 400 });
      const data: Record<string, string | null> = {};
      if (c.jefeId !== undefined) { const j = c.jefeId ? String(c.jefeId) : null; if (j && !jefes.has(j)) return NextResponse.json({ error: "Alguno de los jefes elegidos ya no figura como activo. Recargá la página." }, { status: 400 }); if (j === id) return NextResponse.json({ error: "Una persona no puede reportarse a sí misma." }, { status: 400 }); data.jefeId = j; jefeDe.set(id, j); }
      if (c.puestoId !== undefined) { const v = c.puestoId ? String(c.puestoId) : null; if (v && !pue.has(v)) return NextResponse.json({ error: "Alguno de los puestos ya no existe. Recargá la página." }, { status: 400 }); data.puestoId = v; }
      if (c.centroCostoId !== undefined) { const v = c.centroCostoId ? String(c.centroCostoId) : null; if (v && !sec.has(v)) return NextResponse.json({ error: "Alguno de los sectores ya no existe. Recargá la página." }, { status: 400 }); data.centroCostoId = v; }
      if (Object.keys(data).length) limpios.push({ id, data });
    }
    // Con TODOS los cambios aplicados, ¿queda algún círculo?
    const mal = enCirculo(jefeDe);
    if (mal.size > 0) {
      const nombres = await prisma.legajo.findMany({ where: { id: { in: [...mal].slice(0, 5) } }, select: { apellido: true, nombre: true } });
      return NextResponse.json({ error: `Con esos cambios queda un círculo (alguien termina reportándose a sí mismo): ${nombres.map((n) => `${n.nombre} ${n.apellido}`).join(", ")}. No se guardó nada.` }, { status: 400 });
    }
    for (const c of limpios) await prisma.legajo.update({ where: { id: c.id }, data: c.data });
    return NextResponse.json({ ok: true, guardados: limpios.length });
  } catch (e: any) {
    console.error("Error en POST /api/organigrama:", e);
    return NextResponse.json({ error: e?.name === "FueraDeAlcance" ? e.message : "No se pudo guardar. Probá de nuevo en un momento." }, { status: e?.name === "FueraDeAlcance" ? 403 : 500 });
  }
}
