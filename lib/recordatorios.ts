// FM RRHH — lib/recordatorios.ts
// La tarea diaria de recordatorios. La dispara Vercel una vez por día
// (vercel.json → /api/cron/recordatorios). Recorre TODAS las empresas, por
// eso usa prismaSistema: acá no hay un usuario logueado ni un alcance que
// aplicar.
//
// Qué recuerda y cuándo está en lib/recordatorios-reglas.ts. Dos destinos:
//   - al EMPLEADO o al JEFE, por los mismos canales que cualquier aviso
//     (notificación + mail), solo a quien tiene acceso al portal;
//   - a RR.HH., un mail los lunes con lo que quedó pendiente en la empresa.
import { prismaSistema as db } from "./prisma";
import { avisar, urlBaseDelPedido } from "./avisos";
import { enviarEmailsEnLote } from "./email";
import { limpiarPermisos, permisosHeredados } from "./permisos";
import { ESTADOS_PERIODO_PUBLICADOS } from "./portal";
import * as R from "./recordatorios-reglas";
import { cerrarVencidas, filtroDestinatarios } from "./encuestas";

const DIA = 86400000;
const masDias = (d: Date, n: number) => new Date(d.getTime() + n * DIA);
const activo = { condicion: "activo" };

// Cada bloque va en su try: si uno falla (una tabla que todavía no existe
// en esa base, por ejemplo), los demás recordatorios salen igual.
async function bloque(resumen: Record<string, number>, nombre: string, hacer: () => Promise<number>) {
  try {
    const n = await hacer();
    if (n > 0) resumen[nombre] = n;
  } catch (e) {
    console.error(`Recordatorios: falló "${nombre}":`, e);
    resumen[`${nombre}_error`] = 1;
  }
}

export async function correrRecordatorios(hoy: Date): Promise<Record<string, number>> {
  const resumen: Record<string, number> = {};

  // 1. Jefes con evaluaciones de su equipo sin completar.
  await bloque(resumen, "evaluaciones", async () => {
    const pendientes = await db.evaluacion.findMany({ where: { estado: "pendiente", evaluadorId: { not: null }, ciclo: { estado: "abierto" }, legajo: activo }, select: { evaluadorId: true, cicloId: true, ciclo: { select: { fechaLimite: true } } } });
    const grupos = new Map<string, { jefe: string; limite: Date; n: number }>();
    for (const e of pendientes) {
      const k = `${e.evaluadorId}|${e.cicloId}`;
      grupos.set(k, { jefe: e.evaluadorId!, limite: e.ciclo.fechaLimite, n: (grupos.get(k)?.n ?? 0) + 1 });
    }
    let n = 0;
    for (const g of grupos.values()) if (R.tocaPorLimite(hoy, g.limite, [3, 0])) n += (await avisar([g.jefe], R.recordatorioEvaluaciones(g.n, hoy, g.limite))).personas;
    return n;
  });

  // 2. Autoevaluaciones sin hacer.
  await bloque(resumen, "autoevaluaciones", async () => {
    const faltan = await db.evaluacion.findMany({ where: { autoCompletadaEn: null, estado: { in: ["pendiente", "completada"] }, ciclo: { estado: "abierto", conAutoevaluacion: true }, legajo: activo }, select: { legajoId: true, ciclo: { select: { fechaLimite: true } } } });
    let n = 0;
    for (const e of faltan) if (R.tocaPorLimite(hoy, e.ciclo.fechaLimite, [3, 0])) n += (await avisar([e.legajoId], R.recordatorioAutoevaluacion(hoy, e.ciclo.fechaLimite))).personas;
    return n;
  });

  // 3. Evaluación entregada que el empleado todavía no firmó.
  await bloque(resumen, "firmar_evaluacion", async () => {
    const sinFirmar = await db.evaluacion.findMany({ where: { estado: "entregada", entregadaEn: { not: null }, legajo: activo }, select: { legajoId: true, entregadaEn: true } });
    const ids = sinFirmar.filter((e) => R.tocaInsistir(hoy, e.entregadaEn!)).map((e) => e.legajoId);
    return (await avisar(ids, R.recordatorioFirmarEvaluacion())).personas;
  });

  // 4. Objetivos que vencen en una semana o vencen hoy (al empleado). Los
  //    ya vencidos no se le insisten a él: van al resumen de RR.HH.
  await bloque(resumen, "objetivos", async () => {
    let n = 0;
    for (const faltan of [7, 0]) {
      const limite = masDias(hoy, faltan);
      const porPersona = await db.objetivo.groupBy({ by: ["legajoId"], where: { estado: "en_curso", fechaLimite: limite, legajo: activo }, _count: true });
      for (const p of porPersona) n += (await avisar([p.legajoId], R.recordatorioObjetivos(p._count, hoy, limite))).personas;
    }
    return n;
  });

  // 5. Capacitación de mañana, a los convocados.
  await bloque(resumen, "capacitacion_maniana", async () => {
    const caps = await db.capacitacion.findMany({ where: { estado: "programada", fecha: masDias(hoy, 1) }, select: { titulo: true, asistentes: { where: { legajo: activo }, select: { legajoId: true } } } });
    let n = 0;
    for (const c of caps) n += (await avisar(c.asistentes.map((a) => a.legajoId), R.recordatorioCapacitacionManiana(c.titulo))).personas;
    return n;
  });

  // 6. Capacitación realizada que el presente todavía no confirmó.
  await bloque(resumen, "confirmar_capacitacion", async () => {
    const sin = await db.asistenteCapacitacion.findMany({ where: { asistio: true, firmadoEn: null, capacitacion: { estado: "realizada", cerradaEn: { not: null } }, legajo: activo }, select: { legajoId: true, capacitacion: { select: { cerradaEn: true } } } });
    // Se insiste si a ALGUNA le toca hoy, pero el aviso cuenta todas las
    // que debe: un solo aviso por persona.
    const tocan = new Set(sin.filter((a) => R.tocaInsistir(hoy, a.capacitacion.cerradaEn!)).map((a) => a.legajoId));
    const cuantas = (id: string) => sin.filter((a) => a.legajoId === id).length;
    return (await avisar([...tocan], (id) => R.recordatorioConfirmarCapacitacion(cuantas(id)))).personas;
  });

  // 7. Habilitaciones (autoelevador, altura…) que vencen en 30 o en 7 días.
  await bloque(resumen, "habilidad_vence", async () => {
    let n = 0;
    for (const faltan of [30, 7]) {
      const vence = masDias(hoy, faltan);
      const filas = await db.habilidadLegajo.findMany({ where: { vence, legajo: activo }, select: { legajoId: true } });
      n += (await avisar(filas.map((f) => f.legajoId), R.recordatorioHabilidadVence(hoy, vence))).personas;
    }
    return n;
  });

  // 8. Encuestas abiertas: a quien todavía no respondió, 2 días antes del
  //    cierre y el último día. Se sabe QUIÉN no respondió (para esto), nunca
  //    qué respondió cada uno. Antes, se cierran las que ya vencieron.
  await bloque(resumen, "encuestas", async () => {
    await cerrarVencidas(hoy);
    const abiertas = await db.encuesta.findMany({ where: { estado: "abierta", fechaCierre: { in: [masDias(hoy, 2), hoy] } } });
    let n = 0;
    for (const e of abiertas) {
      const faltan = await db.legajo.findMany({ where: { ...filtroDestinatarios(e), participacionesEncuesta: { none: { encuestaId: e.id } } }, select: { id: true } });
      n += (await avisar(faltan.map((l) => l.id), R.recordatorioEncuesta(hoy, e.fechaCierre))).personas;
    }
    return n;
  });

  if (R.esLunes(hoy)) {
    const hace3Meses = masDias(hoy, -92);
    const recibosSinFirmar = { vigente: true, periodo: { estado: { in: ESTADOS_PERIODO_PUBLICADOS }, fechaHasta: { gte: hace3Meses } }, OR: [{ reciboDigital: null }, { reciboDigital: { firma: null } }], legajo: activo };

    // 9. Recibos de los últimos 3 meses sin firmar (los lunes, al empleado).
    await bloque(resumen, "recibos", async () => {
      const porPersona = await db.liquidacion.groupBy({ by: ["legajoId"], where: recibosSinFirmar, _count: true });
      const cuantos = new Map(porPersona.map((p) => [p.legajoId, p._count]));
      return (await avisar([...cuantos.keys()], (id) => R.recordatorioRecibos(cuantos.get(id) ?? 1))).personas;
    });

    // 10. Resumen para RR.HH., empresa por empresa.
    await bloque(resumen, "resumen_rrhh", async () => {
      if (!process.env.RESEND_API_KEY) return 0;
      const urlBase = urlBaseDelPedido();
      const admins = (await db.usuario.findMany({ where: { rol: "admin" }, select: { email: true } })).map((u) => u.email);
      const empresas = await db.empresa.findMany({ select: { id: true, razonSocial: true, nombreFantasia: true } });
      let mails = 0;
      for (const emp of empresas) {
        const deLaEmpresa = { empresaId: emp.id, condicion: "activo" };
        const [solicitudes, evaluacionesVencidas, evaluacionesSinEntregar, objetivosVencidos, habilidadesVencidas, habilidadesPorVencer, capacitacionesSinCerrar, recibos, candidatosSinRevisar] = await Promise.all([
          db.solicitudAusencia.count({ where: { estado: "pendiente", legajo: deLaEmpresa } }),
          db.evaluacion.count({ where: { estado: "pendiente", ciclo: { estado: "abierto", fechaLimite: { lt: hoy } }, legajo: deLaEmpresa } }),
          db.evaluacion.count({ where: { estado: "completada", legajo: deLaEmpresa } }),
          db.objetivo.count({ where: { estado: "en_curso", fechaLimite: { lt: hoy }, legajo: deLaEmpresa } }),
          db.habilidadLegajo.count({ where: { vence: { lt: hoy }, legajo: deLaEmpresa } }),
          db.habilidadLegajo.count({ where: { vence: { gte: hoy, lte: masDias(hoy, 60) }, legajo: deLaEmpresa } }),
          db.capacitacion.count({ where: { empresaId: emp.id, estado: "programada", fecha: { lt: hoy } } }),
          db.liquidacion.count({ where: { ...recibosSinFirmar, legajo: deLaEmpresa } }),
          db.candidato.count({ where: { etapa: "postulado", busqueda: { empresaId: emp.id, estado: "abierta" } } }),
        ]);
        const lineas = R.lineasResumen({ solicitudes, evaluacionesVencidas, evaluacionesSinEntregar, objetivosVencidos, habilidadesVencidas, habilidadesPorVencer, capacitacionesSinCerrar, recibosSinFirmar: recibos, candidatosSinRevisar });
        if (lineas.length === 0) continue;

        // A quién: usuarios de esa empresa que gestionan algo de Gestión
        // Humana y NO están limitados a sectores (el resumen cuenta a toda
        // la empresa). Si no hay ninguno, a los administradores.
        const asignados = await db.usuarioEmpresa.findMany({ where: { empresaId: emp.id }, select: { sectores: true, usuario: { select: { email: true, rol: true } }, rol: { select: { permisos: true } } } });
        let para = asignados
          .filter((a) => a.usuario.rol !== "admin" && a.sectores.length === 0)
          .filter((a) => {
            const p = a.rol ? limpiarPermisos(a.rol.permisos) : permisosHeredados(a.usuario.rol);
            return ["vacaciones", "evaluaciones", "objetivos", "capacitaciones", "reclutamiento"].some((m) => p[m] === "gestionar");
          })
          .map((a) => a.usuario.email);
        if (para.length === 0) para = admins;
        const nombre = emp.nombreFantasia || emp.razonSocial;
        const { resultados } = await enviarEmailsEnLote([...new Set(para)].map((destinatario) => ({ destinatario, asunto: `${nombre}: pendientes de RR.HH. de la semana`, html: R.htmlResumen(nombre, lineas, urlBase) })));
        mails += resultados.filter((r) => r === null).length;
      }
      return mails;
    });
  }
  return resumen;
}

// Corre una sola vez por día: la fila del día se crea ANTES de mandar nada,
// así dos disparos casi simultáneos no duplican los avisos.
export async function correrRecordatoriosDelDia(hoy: Date, forzar = false): Promise<{ corrio: boolean; resumen: Record<string, number> | null }> {
  if (forzar) await db.ejecucionRecordatorios.deleteMany({ where: { fecha: hoy } });
  try {
    await db.ejecucionRecordatorios.create({ data: { fecha: hoy } });
  } catch (e: any) {
    if (e?.code === "P2002") return { corrio: false, resumen: null };
    throw e;
  }
  const resumen = await correrRecordatorios(hoy);
  await db.ejecucionRecordatorios.update({ where: { fecha: hoy }, data: { terminadaEn: new Date(), resumen } });
  return { corrio: true, resumen };
}
