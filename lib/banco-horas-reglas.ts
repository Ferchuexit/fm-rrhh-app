// FM RRHH — lib/banco-horas-reglas.ts
// Reglas del banco de horas: funciones puras, sin base de datos
// (tests/banco-horas-reglas.test.mjs). Ver docs/102-banco-de-horas.md.
//
// Marco legal (Ley 27.802, B.O. 06/03/2026):
//   - art. 197 bis LCT (art. 42 de la ley): empleador y trabajador pueden
//     acordar VOLUNTARIAMENTE y POR ESCRITO un régimen de compensación de
//     horas extra (banco de horas, francos compensatorios), también con la
//     representación sindical. El acuerdo tiene que fijar el carácter
//     voluntario, los límites y un método de control de las horas
//     trabajadas y disponibles, y respetar los descansos mínimos.
//   - art. 198 LCT (art. 43): se puede compensar la mayor jornada de un día
//     con la menor de otro, con 12 h de descanso entre jornadas, 35 h de
//     descanso semanal y sin pasar el máximo semanal.
//   - Siguen vigentes los recargos del art. 201 LCT (50 % / 100 %) y los
//     topes de horas extra: 3 diarias, 30 mensuales y 200 anuales
//     (Decretos 16.115/33 y 484/00).
// La ley NO dice qué pasa con el saldo al egreso ni cuánto dura cada hora:
// acá, por defecto, lo que no se compensa a tiempo o queda al egreso SE
// PAGA con su recargo (el criterio más seguro). Ver docs/102.

export const LIMITES = {
  extraDiariaMin: 3 * 60,
  extraMensualMin: 30 * 60,
  extraAnualMin: 200 * 60,
  semanalMin: 48 * 60,
  descansoEntreJornadasMin: 12 * 60,
  descansoSemanalMin: 35 * 60,
};
// Cómo se cuentan las horas extra que salen de las fichadas: menos de media
// hora no cuenta, y se toman de a media hora completa (hacia abajo).
export const MINIMO_EXTRA_MIN = 30;
export const FRACCION_MIN = 30;
export const AVISO_VENCE_DIAS = 30;

export const TIPOS_MOVIMIENTO: Record<string, string> = {
  acreditacion: "Horas extra al banco",
  compensacion: "Descanso tomado",
  pago: "Pagado del banco",
  ajuste: "Ajuste",
  pago_directo: "Horas extra pagadas (sin pasar por el banco)",
  descarte: "Descartado",
};
export const EQUIVALENCIAS: Record<string, string> = {
  recargo: "Con recargo: 1 h al 50 % da 1 h 30 min de descanso; 1 h al 100 %, 2 h",
  simple: "Hora por hora",
};
export const ORIGENES_ACUERDO: Record<string, string> = { individual: "Acuerdo individual", sindical: "Con la representación sindical" };

const DIA_MS = 24 * 3600 * 1000;
const aMin = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const sumarDias = (d: Date, n: number) => new Date(d.getTime() + n * DIA_MS);

// ── Horas ────────────────────────────────────────────────────────────────

// "1:30", "1,5", "1.5", "2" → minutos. null si no se entiende o es 0/negativo.
export function minutosDesdeTexto(texto: unknown): number | null {
  const t = String(texto ?? "").trim().replace(",", ".");
  let m: number;
  const hm = /^(\d{1,3}):([0-5]\d)$/.exec(t);
  if (hm) m = Number(hm[1]) * 60 + Number(hm[2]);
  else if (/^\d{1,3}(\.\d{1,2})?$/.test(t)) m = Math.round(Number(t) * 60);
  else return null;
  return m > 0 && m <= 1000 * 60 ? m : null;
}

// 90 → "1 h 30 min"; -45 → "-45 min"; 0 → "0 h".
export function textoHoras(minutos: number): string {
  const signo = minutos < 0 ? "-" : "";
  const m = Math.abs(Math.round(minutos));
  const h = Math.floor(m / 60), r = m % 60;
  if (h === 0 && r === 0) return "0 h";
  return signo + [h ? `${h} h` : "", r ? `${r} min` : ""].filter(Boolean).join(" ");
}
export const horasDecimales = (minutos: number) => Math.round((minutos / 60) * 100) / 100;

// Cuánto descanso da una hora extra según el acuerdo.
export function factor(equivalencia: string, recargo: number | null): number {
  if (equivalencia !== "recargo" || !recargo) return 1;
  return recargo === 100 ? 2 : 1.5;
}
export const descansoQueGenera = (minutosTrabajados: number, recargo: number, equivalencia: string) => Math.round(minutosTrabajados * factor(equivalencia, recargo));

// ── El acuerdo ───────────────────────────────────────────────────────────

export interface AcuerdoMin { id: string; desde: Date; hasta: Date | null; aceptadoEn: Date | null; enPapel: boolean; finalizadoEn: Date | null; topeHoras: number | null; plazoDias: number | null; equivalencia: string }
export type EstadoAcuerdo = "sin_firmar" | "vigente" | "futuro" | "terminado";
export const ESTADOS_ACUERDO: Record<EstadoAcuerdo, string> = { sin_firmar: "Falta la firma", vigente: "Vigente", futuro: "Empieza más adelante", terminado: "Terminado" };

export const firmado = (a: AcuerdoMin) => !!a.aceptadoEn || a.enPapel;
export function estadoAcuerdo(a: AcuerdoMin, hoy: Date): EstadoAcuerdo {
  if (a.finalizadoEn && a.finalizadoEn <= hoy) return "terminado";
  if (a.hasta && a.hasta < hoy) return "terminado";
  if (!firmado(a)) return "sin_firmar";
  return a.desde > hoy ? "futuro" : "vigente";
}
// El acuerdo que cubre un día: firmado, empezado y no terminado. Sin esto,
// las horas de ese día no pueden ir al banco: se pagan.
export function acuerdoDelDia<A extends AcuerdoMin>(acuerdos: A[], fecha: Date): A | null {
  return acuerdos.find((a) => firmado(a) && a.desde <= fecha && (!a.hasta || fecha <= a.hasta) && (!a.finalizadoEn || fecha < a.finalizadoEn)) ?? null;
}

export function validarAcuerdo(b: any, hoy: Date): { datos: { desde: Date; hasta: Date | null; origen: string; topeHoras: number | null; plazoDias: number | null; equivalencia: string; observaciones: string | null } | null; error: string | null } {
  const fecha = (t: unknown) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(t ?? "")); if (!m) return null; const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])); return d.getUTCDate() === +m[3] ? d : null; };
  const desde = b?.desde ? fecha(b.desde) : hoy;
  if (!desde) return { datos: null, error: "La fecha de inicio no es válida." };
  if (desde < sumarDias(hoy, -31)) return { datos: null, error: "El acuerdo no puede empezar hace más de un mes: las horas viejas no se pasan al banco retroactivamente." };
  const hasta = b?.hasta ? fecha(b.hasta) : null;
  if (b?.hasta && !hasta) return { datos: null, error: "La fecha de fin no es válida." };
  if (hasta && hasta <= desde) return { datos: null, error: "La fecha de fin tiene que ser posterior al inicio." };
  const entero = (v: unknown, min: number, max: number, nombre: string) => {
    if (v === null || v === undefined || v === "") return { v: null };
    const n = Number(v);
    if (!Number.isInteger(n) || n < min || n > max) return { e: `${nombre} tiene que ser un número entre ${min} y ${max}.` };
    return { v: n };
  };
  const tope = entero(b?.topeHoras, 1, 400, "El tope de horas");
  if (tope.e) return { datos: null, error: tope.e };
  const plazo = entero(b?.plazoDias, 7, 730, "El plazo para compensar");
  if (plazo.e) return { datos: null, error: plazo.e };
  const origen = b?.origen === "sindical" ? "sindical" : "individual";
  const equivalencia = b?.equivalencia === "simple" ? "simple" : "recargo";
  const observaciones = String(b?.observaciones ?? "").trim().slice(0, 1000) || null;
  return { datos: { desde, hasta, origen, topeHoras: tope.v ?? null, plazoDias: plazo.v ?? null, equivalencia, observaciones }, error: null };
}

// ── La cuenta corriente ──────────────────────────────────────────────────

export interface MovMin { id: string; tipo: string; fecha: Date; minutos: number; minutosTrabajados: number | null; recargo: number | null; estado: string; anulado: boolean; createdAt?: Date }
export interface Lote { id: string; fecha: Date; recargo: number | null; minutos: number; restante: number; factor: number; vence: Date | null; estado: "vigente" | "por_vencer" | "vencido" | "usado" }

const cuenta = (m: MovMin) => m.estado === "aprobado" && !m.anulado && m.minutos !== 0;

// Cada acreditación (o ajuste a favor) es un "lote" de horas; lo que se
// usa o se paga se descuenta del lote más viejo primero. Así se sabe qué
// horas están por vencer y con qué recargo hay que pagarlas.
export function lotes(movs: MovMin[], plazoDias: number | null, hoy: Date): { lotes: Lote[]; saldo: number; porVencer: number; vencido: number; deuda: number } {
  const ord = movs.filter(cuenta).sort((a, b) => a.fecha.getTime() - b.fecha.getTime() || (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0));
  const ls: Lote[] = [];
  let deuda = 0;
  for (const m of ord) {
    if (m.minutos > 0) {
      const f = m.minutosTrabajados ? m.minutos / m.minutosTrabajados : 1;
      ls.push({ id: m.id, fecha: m.fecha, recargo: m.recargo, minutos: m.minutos, restante: m.minutos, factor: f, vence: plazoDias ? sumarDias(m.fecha, plazoDias) : null, estado: "vigente" });
      // Lo que se había usado de más (no debería pasar) se cobra del lote nuevo.
      if (deuda > 0) { const usa = Math.min(deuda, m.minutos); ls[ls.length - 1].restante -= usa; deuda -= usa; }
    } else {
      let falta = -m.minutos;
      for (const l of ls) { if (falta === 0) break; const usa = Math.min(l.restante, falta); l.restante -= usa; falta -= usa; }
      deuda += falta;
    }
  }
  let porVencer = 0, vencido = 0;
  for (const l of ls) {
    if (l.restante === 0) l.estado = "usado";
    else if (l.vence && l.vence < hoy) { l.estado = "vencido"; vencido += l.restante; }
    else if (l.vence && l.vence < sumarDias(hoy, AVISO_VENCE_DIAS)) { l.estado = "por_vencer"; porVencer += l.restante; }
  }
  const saldo = ls.reduce((a, l) => a + l.restante, 0) - deuda;
  return { lotes: ls, saldo, porVencer, vencido, deuda };
}

// Lo pedido desde el portal que todavía no se resolvió: ya no está disponible.
export const minutosReservados = (movs: MovMin[]) => movs.filter((m) => m.estado === "pendiente" && !m.anulado && m.minutos < 0).reduce((a, m) => a - m.minutos, 0);

// Pagar `minutos` de descanso del banco: de los lotes más viejos, cada uno
// vuelve a horas extra reales con su recargo (1 h 30 min de descanso con
// recargo = 1 h al 50 %). Lo que no tiene recargo (un ajuste) va al 50 %.
export function horasAPagar(ls: Lote[], minutos: number): { m50: number; m100: number } {
  let falta = minutos, m50 = 0, m100 = 0;
  for (const l of ls) {
    if (falta <= 0) break;
    if (l.restante <= 0) continue;
    const usa = Math.min(l.restante, falta);
    falta -= usa;
    const trabajados = usa / l.factor;
    if (l.recargo === 100) m100 += trabajados; else m50 += trabajados;
  }
  return { m50: Math.round(m50), m100: Math.round(m100) };
}

// ── Horas extra de un día, desde las fichadas ────────────────────────────

export interface DiaTrabajado {
  fecha: Date; // medianoche UTC
  programado: { ingreso: string; salida: string; nocturno: boolean } | null; // null = franco / no le tocaba
  feriado: boolean;
  ingresoReal: string | null; // "HH:mm" o "HH:mm:ss"
  egresoReal: string | null;
}

// Minutos de cada recargo: 100 % el sábado desde las 13, el domingo y el
// feriado (art. 201 LCT); el resto, 50 %. Cuenta minuto a minuto, así un
// sábado que pasa de las 13 se reparte bien.
function repartir(desde: number, hasta: number, diaSemana: number, feriado: boolean) {
  let m50 = 0, m100 = 0;
  for (let m = desde; m < hasta; m++) {
    const dia = Math.floor(m / 1440), hora = m % 1440, ds = (diaSemana + dia) % 7;
    if ((feriado && dia === 0) || ds === 0 || (ds === 6 && hora >= 13 * 60)) m100++; else m50++;
  }
  return { m50, m100 };
}
const redondear = (m: number) => Math.floor(m / FRACCION_MIN) * FRACCION_MIN;

// Horas extra de un día. En un día que le tocaba trabajar, solo cuenta lo
// que se quedó después de la salida (entrar antes no suma: tiene que estar
// pedido, y se carga a mano). En un franco o feriado sin horario, todo lo
// trabajado. Las horas normales de un feriado trabajado no son extra: se
// pagan dobles en la liquidación (art. 166 LCT).
export function extraDelDia(d: DiaTrabajado): { m50: number; m100: number; trabajado: number } {
  if (!d.ingresoReal || !d.egresoReal) return { m50: 0, m100: 0, trabajado: 0 };
  const ini = aMin(d.ingresoReal);
  let fin = aMin(d.egresoReal);
  if (fin <= ini) fin += 1440;
  const trabajado = fin - ini;
  let desde = ini;
  if (d.programado) {
    let finProg = aMin(d.programado.salida);
    if (d.programado.nocturno || finProg <= aMin(d.programado.ingreso)) finProg += 1440;
    desde = Math.max(ini, finProg);
  }
  if (fin <= desde) return { m50: 0, m100: 0, trabajado };
  const r = repartir(desde, fin, d.fecha.getUTCDay(), d.feriado);
  if (r.m50 + r.m100 < MINIMO_EXTRA_MIN) return { m50: 0, m100: 0, trabajado };
  return { m50: redondear(r.m50), m100: redondear(r.m100), trabajado };
}

// Minutos entre que salió un día y entró el siguiente.
export function descansoEntre(fechaAnterior: Date, egresoAnterior: string, ingresoAnterior: string, fecha: Date, ingreso: string): number {
  let salida = aMin(egresoAnterior);
  if (salida <= aMin(ingresoAnterior)) salida += 1440; // salió pasada la medianoche
  const dias = Math.round((fecha.getTime() - fechaAnterior.getTime()) / DIA_MS);
  return dias * 1440 + aMin(ingreso) - salida;
}

// Las alertas de una lista de días con horas extra de UNA persona (ordenada
// por fecha): lo que pasa los topes o no respeta los descansos.
export interface DiaConExtra extends DiaTrabajado { m50: number; m100: number; trabajado: number }
export function alertasDePersona(dias: DiaConExtra[], extraPrevioDelMes = 0): Map<string, string[]> {
  const out = new Map<string, string[]>();
  const sumar = (f: Date, t: string) => { const k = f.toISOString().slice(0, 10); out.set(k, [...(out.get(k) ?? []), t]); };
  const conFichada = dias.filter((d) => d.ingresoReal && d.egresoReal).sort((a, b) => a.fecha.getTime() - b.fecha.getTime());
  let mesActual = "", acumMes = 0;
  const semanas = new Map<string, number>();
  for (let i = 0; i < conFichada.length; i++) {
    const d = conFichada[i];
    const extra = d.m50 + d.m100;
    if (extra > LIMITES.extraDiariaMin) sumar(d.fecha, `${textoHoras(extra)} extra en el día: pasa el tope de 3 h diarias`);
    const mes = d.fecha.toISOString().slice(0, 7);
    if (mes !== mesActual) { mesActual = mes; acumMes = i === 0 ? extraPrevioDelMes : 0; }
    const antes = acumMes;
    acumMes += extra;
    if (extra > 0 && antes <= LIMITES.extraMensualMin && acumMes > LIMITES.extraMensualMin) sumar(d.fecha, "Con este día pasa las 30 h extra del mes");
    const ant = conFichada[i - 1];
    if (ant && (d.fecha.getTime() - ant.fecha.getTime()) <= DIA_MS) {
      const descanso = descansoEntre(ant.fecha, ant.egresoReal!, ant.ingresoReal!, d.fecha, d.ingresoReal!);
      if (descanso < LIMITES.descansoEntreJornadasMin) sumar(d.fecha, `Descansó ${textoHoras(Math.max(0, descanso))} desde la jornada anterior: el mínimo es 12 h`);
    }
    // Semana de lunes a domingo.
    const lunes = sumarDias(d.fecha, -((d.fecha.getUTCDay() + 6) % 7)).toISOString().slice(0, 10);
    const total = (semanas.get(lunes) ?? 0) + d.trabajado;
    semanas.set(lunes, total);
    if (total > LIMITES.semanalMin && total - d.trabajado <= LIMITES.semanalMin) sumar(d.fecha, `Con este día la semana suma ${textoHoras(total)}: pasa las 48 h`);
  }
  return out;
}

// ── Movimientos a mano y pedidos del portal ──────────────────────────────

export function validarMovimiento(b: any, disponible: number, hoy: Date): { datos: { tipo: string; fecha: Date; minutos: number; minutosTrabajados: number | null; recargo: number | null; motivo: string | null } | null; error: string | null } {
  const tipo = String(b?.tipo ?? "");
  if (!["acreditacion", "compensacion", "ajuste"].includes(tipo)) return { datos: null, error: "Tipo de movimiento desconocido." };
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(b?.fecha ?? ""));
  const fecha = m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null;
  if (!fecha || fecha.getUTCDate() !== Number(m![3])) return { datos: null, error: "Poné la fecha." };
  if (fecha > sumarDias(hoy, 366)) return { datos: null, error: "La fecha está demasiado lejos." };
  const minutos = minutosDesdeTexto(b?.horas);
  if (!minutos) return { datos: null, error: "Poné las horas, por ejemplo 2 o 1:30." };
  const motivo = String(b?.motivo ?? "").trim().slice(0, 300) || null;
  if (tipo === "acreditacion") {
    if (fecha > hoy) return { datos: null, error: "No se pueden acreditar horas de un día que todavía no pasó." };
    if (minutos > 16 * 60) return { datos: null, error: "Son demasiadas horas extra para un solo día." };
    const recargo = Number(b?.recargo) === 100 ? 100 : 50;
    return { datos: { tipo, fecha, minutos, minutosTrabajados: minutos, recargo, motivo }, error: null };
  }
  if (tipo === "compensacion") {
    if (minutos > disponible) return { datos: null, error: `Tiene ${textoHoras(Math.max(0, disponible))} disponibles: no alcanza para ${textoHoras(minutos)}.` };
    return { datos: { tipo, fecha, minutos: -minutos, minutosTrabajados: null, recargo: null, motivo }, error: null };
  }
  // Ajuste: a favor o en contra, siempre con el porqué.
  if (!motivo) return { datos: null, error: "Un ajuste necesita el motivo: queda en el historial que ve el empleado." };
  const enContra = b?.signo === "-";
  if (enContra && minutos > disponible) return { datos: null, error: `Tiene ${textoHoras(Math.max(0, disponible))} disponibles: el ajuste no puede dejarlo en negativo.` };
  return { datos: { tipo, fecha, minutos: enContra ? -minutos : minutos, minutosTrabajados: null, recargo: null, motivo }, error: null };
}

// El empleado pide usar horas (un franco o salir antes) o cobrarlas.
export function validarPedido(b: any, disponible: number, hoy: Date): { datos: { tipo: "compensacion" | "pago"; fecha: Date; minutos: number; motivo: string | null } | null; error: string | null } {
  const tipo = b?.tipo === "cobrar" ? "pago" : b?.tipo === "usar" ? "compensacion" : null;
  if (!tipo) return { datos: null, error: "Elegí si querés usar las horas o cobrarlas." };
  const minutos = minutosDesdeTexto(b?.horas);
  if (!minutos) return { datos: null, error: "Poné cuántas horas, por ejemplo 4 o 1:30." };
  if (minutos > disponible) return { datos: null, error: `Tenés ${textoHoras(Math.max(0, disponible))} disponibles.` };
  let fecha = hoy;
  if (tipo === "compensacion") {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(b?.fecha ?? ""));
    const f = m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null;
    if (!f || f.getUTCDate() !== Number(m![3])) return { datos: null, error: "Elegí el día que querés usarlas." };
    if (f < hoy) return { datos: null, error: "El día tiene que ser hoy o más adelante." };
    if (f > sumarDias(hoy, 180)) return { datos: null, error: "Se puede pedir hasta con seis meses de anticipación." };
    fecha = f;
  }
  const motivo = String(b?.motivo ?? "").trim().slice(0, 300) || null;
  return { datos: { tipo, fecha, minutos, motivo }, error: null };
}
