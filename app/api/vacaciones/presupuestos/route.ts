// FM RRHH — app/api/vacaciones/presupuestos/route.ts
// Presupuestos de costo laboral por rango de fechas (y opcionalmente por
// centro de costo), y el % de contribuciones a estimar cuando las
// liquidaciones no las calculan. Son importes: todo esto es solo para quien
// puede ver Liquidaciones.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerSesionActual } from "@/lib/auth";
import { obtenerEmpresaActual } from "@/lib/empresa-actual";
import { puedeVerCostos } from "@/lib/permisos-servidor";
import { fechaDesdeTexto } from "@/lib/ausencias-reglas";

export const dynamic = "force-dynamic";

async function contexto() {
  const empresa = await obtenerEmpresaActual();
  if (!empresa) return { error: NextResponse.json({ error: "No hay una empresa seleccionada." }, { status: 400 }) };
  if (!(await puedeVerCostos())) return { error: NextResponse.json({ error: "Los presupuestos los maneja quien tiene acceso a Liquidaciones." }, { status: 403 }) };
  return { empresa };
}

export async function GET() {
  try {
    const c = await contexto();
    if (c.error) return c.error;
    const [presupuestos, empresa] = await Promise.all([
      prisma.presupuestoSalarial.findMany({ where: { empresaId: c.empresa.id }, include: { centroCosto: { select: { nombre: true } } }, orderBy: [{ fechaDesde: "desc" }] }),
      prisma.empresa.findUnique({ where: { id: c.empresa.id }, select: { pctContribucionesEstimado: true } }),
    ]);
    return NextResponse.json({
      presupuestos: presupuestos.map((p) => ({ ...p, importe: Number(p.importe) })),
      pctContribucionesEstimado: empresa?.pctContribucionesEstimado != null ? Number(empresa.pctContribucionesEstimado) : null,
    });
  } catch (e: any) {
    console.error("Error en GET /api/vacaciones/presupuestos:", e);
    return NextResponse.json({ error: "No se pudieron cargar los presupuestos. Si acabás de actualizar el sistema, falta aplicar la migración (npx prisma migrate deploy)." }, { status: 500 });
  }
}

// Guarda el presupuesto de un rango (uno solo por rango + centro de costo:
// si ya existe, lo reemplaza), o el % de contribuciones estimado.
export async function POST(req: Request) {
  try {
    const c = await contexto();
    if (c.error) return c.error;
    const sesion = await obtenerSesionActual();
    const body = await req.json().catch(() => ({}));

    if (body.pctContribucionesEstimado !== undefined) {
      const vacio = body.pctContribucionesEstimado === null || body.pctContribucionesEstimado === "";
      const pct = Number(body.pctContribucionesEstimado);
      if (!vacio && (!Number.isFinite(pct) || pct < 0 || pct > 100)) return NextResponse.json({ error: "El porcentaje tiene que estar entre 0 y 100." }, { status: 400 });
      await prisma.empresa.update({ where: { id: c.empresa.id }, data: { pctContribucionesEstimado: vacio || pct === 0 ? null : pct } });
      return NextResponse.json({ ok: true });
    }

    const desde = fechaDesdeTexto(body.desde);
    const hasta = fechaDesdeTexto(body.hasta);
    const importe = Number(body.importe);
    if (!desde || !hasta || hasta < desde) return NextResponse.json({ error: "Revisá las fechas del presupuesto." }, { status: 400 });
    if (!Number.isFinite(importe) || importe <= 0 || importe > 1e13) return NextResponse.json({ error: "Escribí el importe del presupuesto." }, { status: 400 });
    const centroCostoId = body.centroCostoId ? String(body.centroCostoId) : null;
    if (centroCostoId && !(await prisma.centroCosto.findFirst({ where: { id: centroCostoId, empresaId: c.empresa.id }, select: { id: true } }))) {
      return NextResponse.json({ error: "Ese centro de costo no es de esta empresa." }, { status: 400 });
    }

    const datos = { importe, nota: String(body.nota ?? "").trim().slice(0, 300) || null, cargadoPor: sesion?.email ?? null };
    const existente = await prisma.presupuestoSalarial.findFirst({ where: { empresaId: c.empresa.id, centroCostoId, fechaDesde: desde, fechaHasta: hasta } });
    const guardado = existente
      ? await prisma.presupuestoSalarial.update({ where: { id: existente.id }, data: datos })
      : await prisma.presupuestoSalarial.create({ data: { empresaId: c.empresa.id, centroCostoId, fechaDesde: desde, fechaHasta: hasta, ...datos } });
    return NextResponse.json({ ok: true, id: guardado.id });
  } catch (e: any) {
    console.error("Error en POST /api/vacaciones/presupuestos:", e);
    return NextResponse.json({ error: "No se pudo guardar. Probá de nuevo en un momento." }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const c = await contexto();
    if (c.error) return c.error;
    const id = new URL(req.url).searchParams.get("id") ?? "";
    const { count } = await prisma.presupuestoSalarial.deleteMany({ where: { id, empresaId: c.empresa.id } });
    if (count === 0) return NextResponse.json({ error: "Ese presupuesto ya no existe." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("Error en DELETE /api/vacaciones/presupuestos:", e);
    return NextResponse.json({ error: "No se pudo borrar. Probá de nuevo en un momento." }, { status: 500 });
  }
}
