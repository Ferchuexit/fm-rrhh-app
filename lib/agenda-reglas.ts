// FM RRHH — lib/agenda-reglas.ts
// La agenda junta en un calendario lo que ya está cargado en otros
// módulos: eventos, capacitaciones, feriados, vacaciones, permisos,
// festejos y fechas límite. No guarda nada propio. Funciones puras
// (tests/agenda-reglas.test.mjs). Las fechas son días (medianoche UTC).
import { fechaEnAnio, HITOS, type PersonaFechas } from "./cultura-reglas";

const DIA = 86400000;
export type TipoAgenda = "evento" | "capacitacion" | "feriado" | "vacaciones" | "permiso" | "cumple" | "aniversario" | "limite";
export const TIPOS_AGENDA: Record<TipoAgenda, { nombre: string; emoji: string; color: string }> = {
  evento: { nombre: "Eventos", emoji: "📅", color: "#163A5C" },
  capacitacion: { nombre: "Capacitaciones", emoji: "🎓", color: "#6B4E9B" },
  feriado: { nombre: "Feriados", emoji: "🏳️", color: "#B23A3A" },
  vacaciones: { nombre: "Vacaciones", emoji: "🏖️", color: "#2F6F5E" },
  permiso: { nombre: "Permisos", emoji: "📝", color: "#4A7A8C" },
  cumple: { nombre: "Cumpleaños", emoji: "🎂", color: "#B8752B" },
  aniversario: { nombre: "Aniversarios", emoji: "🏅", color: "#8a5413" },
  limite: { nombre: "Fechas límite", emoji: "⏰", color: "#6b727b" },
};
export const CLAVES_TIPO = Object.keys(TIPOS_AGENDA) as TipoAgenda[];

export interface ItemAgenda { clave: string; tipo: TipoAgenda; fecha: Date; hasta: Date | null; hora: string | null; titulo: string; detalle: string | null; url: string | null }

export const isoDia = (d: Date) => d.toISOString().slice(0, 10);
const utc = (a: number, m: number, d: number) => new Date(Date.UTC(a, m, d));

// "2026-10" → primer y último día de ese mes. Si viene mal, el mes de `hoy`.
export function rangoDelMes(mes: unknown, hoy: Date): { desde: Date; hasta: Date; mes: string } {
  const m = typeof mes === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(mes) ? mes : isoDia(hoy).slice(0, 7);
  const [a, n] = m.split("-").map(Number);
  return { desde: utc(a, n - 1, 1), hasta: utc(a, n, 0), mes: m };
}
export function mesVecino(mes: string, salto: number): string {
  const [a, n] = mes.split("-").map(Number);
  return isoDia(utc(a, n - 1 + salto, 1)).slice(0, 7);
}

// Las semanas del mes para dibujar el calendario, de lunes a domingo. Los
// días de otros meses que completan la primera y la última semana van igual.
export function grillaDelMes(desde: Date, hasta: Date): Date[][] {
  const lunes = new Date(desde.getTime() - ((desde.getUTCDay() + 6) % 7) * DIA);
  const semanas: Date[][] = [];
  for (let d = lunes; d <= hasta; d = new Date(d.getTime() + 7 * DIA)) semanas.push(Array.from({ length: 7 }, (_, i) => new Date(d.getTime() + i * DIA)));
  return semanas;
}

// ¿Toca algún día del rango? (Lo de varios días cuenta si se pisa.)
export const tocaElRango = (i: Pick<ItemAgenda, "fecha" | "hasta">, desde: Date, hasta: Date) => i.fecha <= hasta && (i.hasta ?? i.fecha) >= desde;

// Orden dentro de un día: primero lo de todo el día, después por hora.
const orden = (a: ItemAgenda, b: ItemAgenda) => (a.hora ?? "").localeCompare(b.hora ?? "") || CLAVES_TIPO.indexOf(a.tipo) - CLAVES_TIPO.indexOf(b.tipo) || a.titulo.localeCompare(b.titulo);

// Qué hay cada día del rango. Unas vacaciones de 14 días aparecen en los 14.
export function porDia(items: ItemAgenda[], desde: Date, hasta: Date): Map<string, ItemAgenda[]> {
  const dias = new Map<string, ItemAgenda[]>();
  for (const i of items) {
    const ini = i.fecha < desde ? desde : i.fecha;
    const fin = (i.hasta ?? i.fecha) > hasta ? hasta : i.hasta ?? i.fecha;
    for (let d = ini; d <= fin; d = new Date(d.getTime() + DIA)) dias.set(isoDia(d), [...(dias.get(isoDia(d)) ?? []), i]);
  }
  for (const lista of dias.values()) lista.sort(orden);
  return new Map([...dias].sort(([a], [b]) => a.localeCompare(b)));
}

// Cumpleaños y aniversarios que caen en el rango (que puede cruzar de año).
// `paraTodos`: lo que ven los compañeros → respeta "no mostrar mi cumpleaños".
// Nunca se dice la edad.
export function festejosEnRango(personas: PersonaFechas[], desde: Date, hasta: Date, paraTodos: boolean): ItemAgenda[] {
  const lista: ItemAgenda[] = [];
  for (let anio = desde.getUTCFullYear(); anio <= hasta.getUTCFullYear(); anio++) {
    for (const p of personas) {
      const nombre = `${p.nombre} ${p.apellido}`;
      if (p.fechaNacimiento && !(paraTodos && p.ocultarCumple)) {
        const f = fechaEnAnio(p.fechaNacimiento, anio);
        if (f >= desde && f <= hasta) lista.push({ clave: `cumple-${p.id}-${anio}`, tipo: "cumple", fecha: f, hasta: null, hora: null, titulo: `Cumpleaños de ${nombre}`, detalle: p.sector, url: null });
      }
      const f = fechaEnAnio(p.fechaIngreso, anio);
      const anios = anio - p.fechaIngreso.getUTCFullYear();
      if (anios >= 1 && f >= desde && f <= hasta) lista.push({ clave: `aniv-${p.id}-${anio}`, tipo: "aniversario", fecha: f, hasta: null, hora: null, titulo: `${nombre}: ${anios === 1 ? "1 año" : `${anios} años`} en la empresa`, detalle: HITOS.includes(anios) ? "Aniversario redondo" : p.sector, url: null });
    }
  }
  return lista;
}

// Cuánta gente está afuera cada día (vacaciones + permisos): para ver de un
// vistazo las semanas flojas de dotación.
export function ausentesPorDia(items: ItemAgenda[], desde: Date, hasta: Date): Map<string, number> {
  const dias = porDia(items.filter((i) => i.tipo === "vacaciones" || i.tipo === "permiso"), desde, hasta);
  return new Map([...dias].map(([d, l]) => [d, l.length]));
}
