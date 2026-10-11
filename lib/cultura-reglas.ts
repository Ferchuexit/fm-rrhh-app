// FM RRHH — lib/cultura-reglas.ts
// Cumpleaños, aniversarios y reconocimientos. Funciones puras, sin base de
// datos (tests/cultura-reglas.test.mjs).
//
// PRIVACIDAD: de un cumpleaños se muestra el día y el mes, NUNCA el año ni
// la edad. Y quien pidió que no se muestre el suyo no aparece para nadie
// más (RR.HH. lo sigue viendo en el legajo, como siempre).

const DIA = 86400000;
const utc = (anio: number, mes: number, dia: number) => new Date(Date.UTC(anio, mes, dia));
const esBisiesto = (a: number) => (a % 4 === 0 && a % 100 !== 0) || a % 400 === 0;

// En qué fecha cae, en un año dado, el aniversario de `fecha`. Quien nació
// (o ingresó) un 29 de febrero festeja el 28 en los años no bisiestos.
export function fechaEnAnio(fecha: Date, anio: number): Date {
  const mes = fecha.getUTCMonth(), dia = fecha.getUTCDate();
  return mes === 1 && dia === 29 && !esBisiesto(anio) ? utc(anio, 1, 28) : utc(anio, mes, dia);
}

// La próxima vez que se festeja (hoy incluido).
export function proximaFecha(fecha: Date, hoy: Date): Date {
  const este = fechaEnAnio(fecha, hoy.getUTCFullYear());
  return este >= hoy ? este : fechaEnAnio(fecha, hoy.getUTCFullYear() + 1);
}

// Años que hacen ruido: los que conviene festejar distinto.
export const HITOS = [1, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50];

export interface PersonaFechas { id: string; nombre: string; apellido: string; sector: string | null; jefeId: string | null; fechaNacimiento: Date | null; fechaIngreso: Date; ocultarCumple: boolean }
export interface Celebracion { legajoId: string; nombre: string; sector: string | null; jefeId: string | null; tipo: "cumple" | "aniversario"; fecha: Date; anios: number | null; hito: boolean; faltan: number }

// Los festejos de los próximos `dias` (0 = solo hoy), en orden.
// `paraTodos`: lo que ven los compañeros → respeta "no mostrar mi
// cumpleaños". El panel de RR.HH. pasa false.
export function celebraciones(personas: PersonaFechas[], hoy: Date, dias: number, paraTodos: boolean): Celebracion[] {
  const hasta = new Date(hoy.getTime() + dias * DIA);
  const lista: Celebracion[] = [];
  for (const p of personas) {
    const base = { legajoId: p.id, nombre: `${p.nombre} ${p.apellido}`, sector: p.sector, jefeId: p.jefeId };
    if (p.fechaNacimiento && !(paraTodos && p.ocultarCumple)) {
      const f = proximaFecha(p.fechaNacimiento, hoy);
      if (f <= hasta) lista.push({ ...base, tipo: "cumple", fecha: f, anios: null, hito: false, faltan: Math.round((f.getTime() - hoy.getTime()) / DIA) });
    }
    const f = proximaFecha(p.fechaIngreso, hoy);
    const anios = f.getUTCFullYear() - p.fechaIngreso.getUTCFullYear();
    // El día que entra no es aniversario: recién al año.
    if (anios >= 1 && f <= hasta) lista.push({ ...base, tipo: "aniversario", fecha: f, anios, hito: HITOS.includes(anios), faltan: Math.round((f.getTime() - hoy.getTime()) / DIA) });
  }
  return lista.sort((a, b) => a.fecha.getTime() - b.fecha.getTime() || a.nombre.localeCompare(b.nombre));
}

export const textoCelebracion = (c: Pick<Celebracion, "tipo" | "nombre" | "anios">) => (c.tipo === "cumple" ? `${c.nombre} cumple años` : `${c.nombre} cumple ${c.anios === 1 ? "1 año" : `${c.anios} años`} en la empresa`);

// ── Reconocimientos ──────────────────────────────────────────────────
export interface Valor { nombre: string; emoji: string }
// Punto de partida para una planta; cada empresa pone los suyos.
export const VALORES_INICIALES: Valor[] = [
  { nombre: "Seguridad", emoji: "🦺" },
  { nombre: "Compañerismo", emoji: "🤝" },
  { nombre: "Calidad", emoji: "🎯" },
  { nombre: "Compromiso", emoji: "💪" },
  { nombre: "Mejora continua", emoji: "💡" },
  { nombre: "Buena onda", emoji: "😊" },
];
export const MAX_VALORES = 12;
// Tope por persona y por mes: si se reconoce todo el tiempo, deja de valer.
export const MAX_RECONOCIMIENTOS_POR_MES = 5;
export const MIN_MENSAJE = 15;

export function limpiarValores(entrada: unknown): { valores: Valor[]; error: string | null } {
  if (!Array.isArray(entrada) || entrada.length === 0) return { valores: [], error: "Tiene que quedar al menos un valor." };
  if (entrada.length > MAX_VALORES) return { valores: [], error: `Hasta ${MAX_VALORES} valores: con más, nadie los recuerda.` };
  const valores: Valor[] = [];
  for (const v of entrada) {
    const nombre = String(v?.nombre ?? "").trim().slice(0, 30);
    if (nombre.length < 3) return { valores: [], error: "A un valor le falta el nombre." };
    if (valores.some((x) => x.nombre.toLowerCase() === nombre.toLowerCase())) return { valores: [], error: `«${nombre}» está repetido.` };
    // Un solo emoji (o un par de caracteres): si pegan un texto largo, la estrella.
    const emoji = [...String(v?.emoji ?? "").trim()].slice(0, 4).join("") || "⭐";
    valores.push({ nombre, emoji: emoji.length > 8 ? "⭐" : emoji });
  }
  return { valores, error: null };
}

// ¿Se puede dar este reconocimiento? `delMes`: cuántos dio ya este mes
// (null = lo da RR.HH. desde el panel, sin tope).
export function validarReconocimiento(entrada: any, emisorId: string | null, valores: Valor[], delMes: number | null): { datos: { paraId: string; valor: Valor; mensaje: string }; error: string | null } {
  const paraId = String(entrada?.paraId ?? "");
  const valor = valores.find((v) => v.nombre === entrada?.valor) ?? { nombre: "", emoji: "⭐" };
  const mensaje = String(entrada?.mensaje ?? "").replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim().slice(0, 500);
  const datos = { paraId, valor, mensaje };
  if (!paraId) return { datos, error: "Elegí a quién querés reconocer." };
  if (emisorId && paraId === emisorId) return { datos, error: "No te podés reconocer a vos mismo." };
  if (!valor.nombre) return { datos, error: "Elegí por qué valor lo reconocés." };
  if (mensaje.length < MIN_MENSAJE) return { datos, error: "Contá qué hizo: un reconocimiento vale por el ejemplo concreto." };
  if (delMes !== null && delMes >= MAX_RECONOCIMIENTOS_POR_MES) return { datos, error: `Ya diste ${MAX_RECONOCIMIENTOS_POR_MES} reconocimientos este mes. El mes que viene podés seguir.` };
  return { datos, error: null };
}

export const inicioDelMes = (hoy: Date) => utc(hoy.getUTCFullYear(), hoy.getUTCMonth(), 1);

// Cómo se está usando: por valor, a quiénes más se reconoce, quiénes más
// reconocen, y cuánta gente participa. Los ocultos no cuentan.
export function resumenReconocimientos(lista: { legajoId: string; emisorId: string | null; valor: string; oculto: boolean }[], dotacion: number) {
  const visibles = lista.filter((r) => !r.oculto);
  const contar = (claves: (string | null)[]) => [...claves.reduce((m, k) => (k ? m.set(k, (m.get(k) ?? 0) + 1) : m), new Map<string, number>())].map(([clave, cantidad]) => ({ clave, cantidad })).sort((a, b) => b.cantidad - a.cantidad || a.clave.localeCompare(b.clave));
  const reconocidos = new Set(visibles.map((r) => r.legajoId));
  const emisores = new Set(visibles.map((r) => r.emisorId).filter(Boolean));
  return {
    total: visibles.length, porValor: contar(visibles.map((r) => r.valor)), masReconocidos: contar(visibles.map((r) => r.legajoId)).slice(0, 5), masReconocen: contar(visibles.map((r) => r.emisorId)).slice(0, 5),
    reconocidos: reconocidos.size, emisores: emisores.size,
    // De la dotación, qué parte recibió al menos uno: si son siempre los
    // mismos, el programa no está llegando.
    alcance: dotacion ? Math.round((reconocidos.size / dotacion) * 100) : null,
  };
}
