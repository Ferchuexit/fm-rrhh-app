// FM RRHH — lib/recordatorios-reglas.ts
// CUÁNDO se le recuerda algo a alguien y QUÉ dice. Funciones puras, sin
// base de datos (tests/recordatorios-reglas.test.mjs). Quién las corre
// todos los días: lib/recordatorios.ts.
//
// Criterio general: pocos recordatorios y espaciados. Un sistema que
// insiste todos los días termina con los avisos desactivados.
import type { TextoAviso } from "./avisos-reglas";

const DIA = 86400000;
export const diasEntre = (desde: Date, hasta: Date) => Math.round((hasta.getTime() - desde.getTime()) / DIA);
const dia = (d: Date) => `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;

// Algo con FECHA LÍMITE: se recuerda los días `antes` indicados (0 = el
// mismo día) y, si se venció, una vez por semana hasta que se resuelva.
export function tocaPorLimite(hoy: Date, limite: Date, antes: number[]): boolean {
  const faltan = diasEntre(hoy, limite);
  return faltan >= 0 ? antes.includes(faltan) : -faltan % 7 === 0;
}

// Algo que QUEDÓ ESPERANDO a la persona (firmar, confirmar): se insiste a
// los `primero` días y después una vez por semana, hasta `tope` días. Lo
// que lleva más que eso ya no se resuelve con otro aviso: lo ve RR.HH. en
// el resumen semanal.
export function tocaInsistir(hoy: Date, desde: Date, primero = 3, tope = 31): boolean {
  // `desde` es un momento con hora (cuándo se entregó); `hoy` es un día.
  // Se cuenta desde el DÍA argentino en que pasó, no por horas.
  const diaDesde = new Date(Math.floor((desde.getTime() - 3 * 3600000) / DIA) * DIA);
  const pasaron = diasEntre(diaDesde, hoy);
  return pasaron >= primero && pasaron <= tope && (pasaron - primero) % 7 === 0;
}

export const esLunes = (hoy: Date) => hoy.getUTCDay() === 1;

// ── Textos. Misma regla de privacidad que el resto de los avisos: se leen
// con el celular bloqueado, así que dicen QUÉ hay que hacer, sin detalle.
const plazo = (hoy: Date, limite: Date) => {
  const faltan = diasEntre(hoy, limite);
  return faltan < 0 ? `El plazo venció el ${dia(limite)}.` : faltan === 0 ? "El plazo vence hoy." : faltan === 1 ? "El plazo vence mañana." : `Tenés hasta el ${dia(limite)}.`;
};

export function recordatorioEvaluaciones(cantidad: number, hoy: Date, limite: Date): TextoAviso {
  return { tipo: "recordatorio", titulo: cantidad === 1 ? "Te falta completar 1 evaluación" : `Te faltan completar ${cantidad} evaluaciones`, cuerpo: `De tu equipo. ${plazo(hoy, limite)}`, url: "/portal/evaluaciones" };
}
export function recordatorioAutoevaluacion(hoy: Date, limite: Date): TextoAviso {
  return { tipo: "recordatorio", titulo: "Te falta tu autoevaluación", cuerpo: plazo(hoy, limite), url: "/portal/evaluaciones" };
}
export function recordatorioFirmarEvaluacion(): TextoAviso {
  return { tipo: "recordatorio", titulo: "Tenés tu evaluación para leer y firmar", cuerpo: "Entrá a Evaluaciones para verla.", url: "/portal/evaluaciones" };
}
export function recordatorioObjetivos(cantidad: number, hoy: Date, limite: Date): TextoAviso {
  const faltan = diasEntre(hoy, limite);
  return { tipo: "recordatorio", titulo: cantidad === 1 ? (faltan === 0 ? "Hoy vence uno de tus objetivos" : `Uno de tus objetivos vence el ${dia(limite)}`) : (faltan === 0 ? `Hoy vencen ${cantidad} de tus objetivos` : `${cantidad} de tus objetivos vencen el ${dia(limite)}`), cuerpo: "Entrá a Objetivos e informá cómo venís.", url: "/portal/objetivos" };
}
export function recordatorioCapacitacionManiana(titulo: string): TextoAviso {
  return { tipo: "recordatorio", titulo: "Mañana tenés una capacitación", cuerpo: titulo.slice(0, 120), url: "/portal/capacitaciones" };
}
export function recordatorioConfirmarCapacitacion(cantidad: number): TextoAviso {
  return { tipo: "recordatorio", titulo: cantidad === 1 ? "Te falta confirmar una capacitación" : `Te falta confirmar ${cantidad} capacitaciones`, cuerpo: "Entrá a Capacitaciones y confirmá que la recibiste.", url: "/portal/capacitaciones" };
}
export function recordatorioRecibos(cantidad: number): TextoAviso {
  return { tipo: "recordatorio", titulo: cantidad === 1 ? "Tenés 1 recibo sin firmar" : `Tenés ${cantidad} recibos sin firmar`, cuerpo: "Entrá a Recibos para verlos y firmarlos.", url: "/portal/recibos" };
}
export function recordatorioEncuesta(hoy: Date, limite: Date): TextoAviso {
  return { tipo: "recordatorio", titulo: diasEntre(hoy, limite) === 0 ? "Hoy cierra la encuesta" : "Todavía podés responder la encuesta", cuerpo: `Es anónima y lleva unos minutos. ${plazo(hoy, limite)}`, url: "/portal/encuestas" };
}
export function recordatorioHabilidadVence(hoy: Date, vence: Date): TextoAviso {
  return { tipo: "recordatorio", titulo: `Una habilitación tuya vence ${diasEntre(hoy, vence) <= 7 ? "esta semana" : `el ${dia(vence)}`}`, cuerpo: "Entrá a Capacitaciones para ver cuál, y avisale a tu jefe para renovarla.", url: "/portal/capacitaciones" };
}

// ── Resumen semanal para RR.HH. (mail, los lunes) ──
export interface PendientesRRHH { solicitudes: number; evaluacionesVencidas: number; evaluacionesSinEntregar: number; objetivosVencidos: number; habilidadesVencidas: number; habilidadesPorVencer: number; capacitacionesSinCerrar: number; recibosSinFirmar: number; candidatosSinRevisar: number }

export function lineasResumen(p: PendientesRRHH): { texto: string; url: string }[] {
  const n = (c: number, uno: string, varios: string) => (c === 1 ? `1 ${uno}` : `${c} ${varios}`);
  const lineas: [number, string, string][] = [
    [p.solicitudes, `${n(p.solicitudes, "pedido de vacaciones o permiso esperando", "pedidos de vacaciones o permisos esperando")} respuesta`, "/solicitudes"],
    [p.evaluacionesVencidas, `${n(p.evaluacionesVencidas, "evaluación sin completar", "evaluaciones sin completar")} con el plazo vencido`, "/evaluaciones"],
    [p.evaluacionesSinEntregar, `${n(p.evaluacionesSinEntregar, "evaluación completada", "evaluaciones completadas")} sin entregar al empleado`, "/evaluaciones"],
    [p.objetivosVencidos, `${n(p.objetivosVencidos, "objetivo vencido", "objetivos vencidos")} sin cerrar`, "/objetivos"],
    [p.habilidadesVencidas, n(p.habilidadesVencidas, "habilitación vencida", "habilitaciones vencidas"), "/habilidades"],
    [p.habilidadesPorVencer, `${n(p.habilidadesPorVencer, "habilitación vence", "habilitaciones vencen")} en los próximos 60 días`, "/habilidades"],
    [p.capacitacionesSinCerrar, `${n(p.capacitacionesSinCerrar, "capacitación ya pasó y falta", "capacitaciones ya pasaron y falta")} cerrarla${p.capacitacionesSinCerrar === 1 ? "" : "s"}`, "/capacitaciones"],
    [p.candidatosSinRevisar, `${n(p.candidatosSinRevisar, "candidato nuevo", "candidatos nuevos")} sin revisar en las búsquedas abiertas`, "/reclutamiento"],
    [p.recibosSinFirmar, `${n(p.recibosSinFirmar, "recibo", "recibos")} de los últimos 3 meses sin firmar`, "/firmas-recibos"],
  ];
  return lineas.filter(([c]) => c > 0).map(([, texto, url]) => ({ texto, url }));
}

const escapar = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
export function htmlResumen(empresa: string, lineas: { texto: string; url: string }[], urlBase: string): string {
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#2b2f36">
  <div style="background:#163A5C;color:#fff;padding:16px 20px;font-size:15px"><strong>${escapar(empresa)}</strong><br><span style="font-size:12px;opacity:.85">FM RRHH · Pendientes de la semana</span></div>
  <div style="padding:20px;border:1px solid #dfe4e8;border-top:0">
    <p style="margin:0 0 12px;font-size:14px">Esto es lo que está esperando a RR.HH.:</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px">${lineas.map((l) => `<tr><td style="padding:9px 0;border-top:1px solid #EEF1F4">${escapar(l.texto)}</td><td style="padding:9px 0;border-top:1px solid #EEF1F4;text-align:right;white-space:nowrap"><a href="${escapar(urlBase + l.url)}" style="color:#163A5C">Ver</a></td></tr>`).join("")}</table>
    <p style="font-size:11px;color:#6b727b;margin:22px 0 0">Llega los lunes, solo si hay algo pendiente. Este mail es un aviso: no respondas a esta dirección.</p>
  </div>
</div>`;
}
