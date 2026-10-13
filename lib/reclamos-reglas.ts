// FM RRHH — lib/reclamos-reglas.ts
// Reclamos de haberes: funciones puras, sin base de datos
// (tests/reclamos-reglas.test.mjs). Ver docs/103-reclamos-y-buscador.md.

export type Unidad = "horas" | "dias" | "monto" | "texto";
export const UNIDADES: Record<Unidad, string> = { horas: "Horas", dias: "Días", monto: "Importe ($)", texto: "Solo descripción" };

export interface Motivo { id: string; nombre: string; unidad: Unidad; concepto: string | null; activo: boolean }

// La lista que trae el sistema. `concepto`: el código que se sugiere al
// cargar la novedad si se aprueba (si existe en el catálogo).
export const MOTIVOS_ESTANDAR: Motivo[] = [
  { id: "horas-normales", nombre: "Horas normales", unidad: "horas", concepto: null, activo: true },
  { id: "hs-extra-50", nombre: "Horas extra al 50 %", unidad: "horas", concepto: "HS_EXTRA_50", activo: true },
  { id: "hs-extra-100", nombre: "Horas extra al 100 %", unidad: "horas", concepto: "HS_EXTRA_100", activo: true },
  { id: "hs-nocturnas", nombre: "Horas nocturnas", unidad: "horas", concepto: null, activo: true },
  { id: "feriado", nombre: "Feriado trabajado", unidad: "dias", concepto: null, activo: true },
  { id: "presentismo", nombre: "Presentismo / premio asistencia", unidad: "monto", concepto: "PRESENTISMO", activo: true },
  { id: "premio", nombre: "Premio producción", unidad: "monto", concepto: "PREMIO", activo: true },
  { id: "enfermedad", nombre: "Días de enfermedad", unidad: "dias", concepto: "ENFERMEDAD", activo: true },
  { id: "licencia", nombre: "Licencia especial (examen, donación de sangre, enfermedad familiar…)", unidad: "dias", concepto: null, activo: true },
  { id: "vacaciones", nombre: "Vacaciones", unidad: "dias", concepto: null, activo: true },
  { id: "antiguedad", nombre: "Antigüedad", unidad: "monto", concepto: "ANTIGUEDAD", activo: true },
  { id: "categoria", nombre: "Categoría o básico mal liquidado", unidad: "texto", concepto: null, activo: true },
  { id: "descuento", nombre: "Descuento que no corresponde", unidad: "monto", concepto: null, activo: true },
  { id: "otro", nombre: "Otro", unidad: "texto", concepto: null, activo: true },
];

const slug = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);

// La lista de la empresa (o la estándar), limpia.
export function motivosDe(guardado: unknown): Motivo[] {
  const r = limpiarMotivos(guardado);
  return r.motivos.length ? r.motivos : MOTIVOS_ESTANDAR;
}
export function limpiarMotivos(entrada: unknown): { motivos: Motivo[]; error: string | null } {
  if (!Array.isArray(entrada)) return { motivos: [], error: null };
  if (entrada.length > 40) return { motivos: [], error: "Son demasiados motivos (máximo 40)." };
  const out: Motivo[] = [];
  for (const m of entrada as any[]) {
    const nombre = String(m?.nombre ?? "").trim().slice(0, 90);
    if (nombre.length < 3) return { motivos: [], error: "Cada motivo necesita un nombre." };
    const unidad = (["horas", "dias", "monto", "texto"].includes(m?.unidad) ? m.unidad : "texto") as Unidad;
    const id = String(m?.id ?? "").trim().slice(0, 40) || slug(nombre);
    if (out.some((x) => x.id === id || x.nombre.toLowerCase() === nombre.toLowerCase())) return { motivos: [], error: `"${nombre}" está repetido.` };
    const concepto = String(m?.concepto ?? "").trim().toUpperCase().slice(0, 40) || null;
    out.push({ id, nombre, unidad, concepto, activo: m?.activo !== false });
  }
  if (out.length && !out.some((m) => m.activo)) return { motivos: [], error: "Dejá al menos un motivo activo." };
  return { motivos: out, error: null };
}

// ── El reclamo del empleado ─────────────────────────────────────────────

export interface ItemReclamo {
  motivoId: string; motivo: string; unidad: Unidad; cantidad: number | null; detalle: string | null;
  // Lo que decide RR.HH.
  aprobado?: boolean; cantidadAprobada?: number | null; conceptoCodigo?: string | null;
}

const LIMITE: Record<Exclude<Unidad, "texto">, { min: number; max: number; nombre: string }> = {
  horas: { min: 0.5, max: 300, nombre: "las horas" },
  dias: { min: 0.5, max: 62, nombre: "los días" },
  monto: { min: 1, max: 100_000_000, nombre: "el importe" },
};
// "4", "4,5", "1.250,50" (importe) → número; null si no se entiende.
export function numeroDesdeTexto(t: unknown): number | null {
  let s = String(t ?? "").trim().replace(/\s|\$/g, "");
  if (!s) return null;
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, "").replace(",", ".");
  else s = s.replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  return Number(s);
}

export function validarReclamo(b: any, motivos: Motivo[]): { datos: { items: ItemReclamo[]; comentario: string | null } | null; error: string | null } {
  const lista = Array.isArray(b?.items) ? b.items : [];
  if (lista.length === 0) return { datos: null, error: "Elegí al menos un motivo." };
  if (lista.length > 10) return { datos: null, error: "Son demasiados motivos en un solo reclamo (máximo 10)." };
  const items: ItemReclamo[] = [];
  for (const it of lista) {
    const m = motivos.find((x) => x.id === it?.motivoId && x.activo);
    if (!m) return { datos: null, error: "Uno de los motivos ya no está disponible. Recargá la página." };
    if (items.some((x) => x.motivoId === m.id)) return { datos: null, error: `"${m.nombre}" está dos veces.` };
    const detalle = String(it?.detalle ?? "").trim().slice(0, 300) || null;
    let cantidad: number | null = null;
    if (m.unidad !== "texto") {
      cantidad = numeroDesdeTexto(it?.cantidad);
      const l = LIMITE[m.unidad];
      if (cantidad === null) return { datos: null, error: `Poné ${l.nombre} que reclamás en "${m.nombre}".` };
      if (cantidad < l.min || cantidad > l.max) return { datos: null, error: `Revisá ${l.nombre} de "${m.nombre}".` };
      cantidad = Math.round(cantidad * 100) / 100;
    } else if (!detalle) return { datos: null, error: `Contá qué pasó con "${m.nombre}".` };
    items.push({ motivoId: m.id, motivo: m.nombre, unidad: m.unidad, cantidad, detalle });
  }
  const comentario = String(b?.comentario ?? "").trim().slice(0, 1000) || null;
  return { datos: { items, comentario }, error: null };
}

const fmt = (n: number) => n.toLocaleString("es-AR", { maximumFractionDigits: 2 });
export function textoCantidad(unidad: Unidad, n: number | null | undefined): string {
  if (n === null || n === undefined) return "";
  if (unidad === "monto") return `$ ${n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (unidad === "horas") return `${fmt(n)} h`;
  if (unidad === "dias") return `${fmt(n)} ${n === 1 ? "día" : "días"}`;
  return "";
}

// ── La respuesta de RR.HH. ──────────────────────────────────────────────

export const ESTADOS_RECLAMO: Record<string, string> = { pendiente: "Pendiente", aprobado: "Aprobado", parcial: "Aprobado en parte", rechazado: "No corresponde" };

// RR.HH. decide ítem por ítem: si corresponde, cuánto, y con qué concepto
// se carga la novedad (o ninguno: lo ajusta a mano).
export function validarResolucion(b: any, items: ItemReclamo[], codigosValidos: string[]): { datos: { items: ItemReclamo[]; estado: string; respuesta: string | null; conNovedad: boolean } | null; error: string | null } {
  const decisiones = Array.isArray(b?.items) ? b.items : [];
  if (decisiones.length !== items.length) return { datos: null, error: "El reclamo cambió. Recargá la página." };
  const salida: ItemReclamo[] = [];
  for (let i = 0; i < items.length; i++) {
    const it = items[i], d = decisiones[i] ?? {};
    const aprobado = d.aprobado === true;
    let cantidadAprobada: number | null = null, conceptoCodigo: string | null = null;
    if (aprobado) {
      if (it.unidad !== "texto" || d.cantidad) {
        cantidadAprobada = numeroDesdeTexto(d.cantidad);
        if (it.unidad !== "texto" && (cantidadAprobada === null || cantidadAprobada <= 0)) return { datos: null, error: `Poné cuánto se aprueba de "${it.motivo}".` };
      }
      conceptoCodigo = String(d.conceptoCodigo ?? "").trim() || null;
      if (conceptoCodigo && !codigosValidos.includes(conceptoCodigo)) return { datos: null, error: `El concepto de "${it.motivo}" no está en el catálogo.` };
      if (conceptoCodigo && cantidadAprobada === null) return { datos: null, error: `Para cargar la novedad de "${it.motivo}" hace falta la cantidad o el importe.` };
    }
    salida.push({ ...it, aprobado, cantidadAprobada, conceptoCodigo });
  }
  const aprobados = salida.filter((x) => x.aprobado).length;
  const estado = aprobados === 0 ? "rechazado" : aprobados === salida.length && salida.every((x) => x.cantidadAprobada === null || x.cantidad === null || x.cantidadAprobada >= x.cantidad) ? "aprobado" : "parcial";
  const respuesta = String(b?.respuesta ?? "").trim().slice(0, 1000) || null;
  if (estado !== "aprobado" && !respuesta) return { datos: null, error: "Explicale a la persona por qué no corresponde todo lo que reclamó: lo va a leer en el portal." };
  return { datos: { items: salida, estado, respuesta, conNovedad: salida.some((x) => x.aprobado && x.conceptoCodigo) }, error: null };
}
