// FM RRHH — app/api/solicitudes/route.ts
// Bandeja de RR.HH.: pedidos de vacaciones/permisos de la empresa actual.
// (Fuera de /api/portal a propósito — esto lo usa quien opera el sistema.)
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerEmpresaActual } from "@/lib/empresa-actual";
import { saldoVacaciones } from "@/lib/ausencias";
import { ausenciasDelRango, ausentesPorDia, pico, impactoEnPresupuestos, type PlanCalculado } from "@/lib/planificacion";
import { puedeVerCostos } from "@/lib/permisos-servidor";

export const dynamic = "force-dynamic";

export async function GET() {
  const empresa = await obtenerEmpresaActual();
  if (!empresa) return NextResponse.json({ solicitudes: [] });

  const solicitudes = await prisma.solicitudAusencia.findMany({
    where: { legajo: { empresaId: empresa.id } },
    include: { legajo: { select: { centroCostoId: true, numeroLegajo: true, apellido: true, nombre: true, centroCosto: { select: { nombre: true } } } }, solicitadoPor: { select: { numeroLegajo: true, apellido: true, nombre: true } } },
    orderBy: [{ createdAt: "desc" }],
    take: 300,
  });

  // Para decidir una pendiente de vacaciones hacen falta dos datos: el
  // saldo de la persona y cuánta gente de su sector ya está afuera en esas
  // fechas (hoy, y si se aprueba este pedido).
  async function contexto(s: (typeof solicitudes)[number]) {
    const r = { desde: s.fechaDesde, hasta: s.fechaHasta };
    const sector = s.legajo.centroCostoId;
    const [dotacion, ausencias] = await Promise.all([
      prisma.legajo.count({ where: { empresaId: empresa!.id, condicion: "activo", ...(sector ? { centroCostoId: sector } : {}) } }),
      ausenciasDelRango(empresa!.id, r, sector),
    ]);
    const firmes = ausencias.filter((a) => !a.pendiente);
    return {
      dotacion,
      afuera: pico(ausentesPorDia(r, firmes), "firmes").cantidad,
      conEste: pico(ausentesPorDia(r, [...firmes, { legajoId: s.legajoId, ...r }]), "firmes").cantidad,
      otrosPendientes: new Set(ausencias.filter((a) => a.pendiente && a.legajoId !== s.legajoId).map((a) => a.legajoId)).size,
    };
  }
  // Presupuestos guardados que tocan cada pedido — solo para quien puede
  // ver importes.
  const conCostos = await puedeVerCostos();
  const cachePlanes = new Map<string, Promise<PlanCalculado>>();
  const presupuestosDe = (s: (typeof solicitudes)[number]) =>
    conCostos
      ? impactoEnPresupuestos(empresa!.id, { legajoId: s.legajoId, centroCostoId: s.legajo.centroCostoId, desde: s.fechaDesde, hasta: s.fechaHasta }, cachePlanes).catch((e) => { console.error("Solicitudes: no se pudo evaluar el presupuesto:", e); return []; })
      : [];
  const conSaldo = await Promise.all(
    solicitudes.map(async (s) => {
      const decide = s.estado === "pendiente" && s.tipo === "vacaciones";
      return { ...s, saldo: decide ? await saldoVacaciones(s.legajoId, s.fechaDesde.getUTCFullYear(), s.id) : null, contexto: decide ? await contexto(s) : null, presupuestos: decide ? await presupuestosDe(s) : [] };
    })
  );
  return NextResponse.json({ solicitudes: conSaldo });
}
