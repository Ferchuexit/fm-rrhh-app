// FM RRHH — lib/epp-reglas.ts
// Elementos de protección personal y ropa de trabajo: a quién le
// corresponde cada cosa, en qué estado está la de cada persona y cuándo
// vence. Funciones puras (tests/epp-reglas.test.mjs).

const DIA = 86400000;
export const DIAS_POR_VENCER = 30;

export const MOTIVOS_ENTREGA: Record<string, string> = { ingreso: "Ingreso", reposicion: "Reposición por vencimiento", rotura: "Rotura o desgaste", extravio: "Extravío", talle: "Cambio de talle", otro: "Otro" };

// Con qué arrancar: lo que casi toda planta entrega. La vida útil es una
// sugerencia: la define el responsable de higiene y seguridad de cada
// empresa según la tarea y el fabricante.
export const ELEMENTOS_SUGERIDOS: { nombre: string; tipoModelo: string; vidaUtilDias: number | null; talle: "ropa" | "calzado" | null }[] = [
  { nombre: "Calzado de seguridad", tipoModelo: "Botín con puntera", vidaUtilDias: 365, talle: "calzado" },
  { nombre: "Ropa de trabajo", tipoModelo: "Camisa y pantalón", vidaUtilDias: 180, talle: "ropa" },
  { nombre: "Protección ocular", tipoModelo: "Anteojos de seguridad", vidaUtilDias: 180, talle: null },
  { nombre: "Protección auditiva", tipoModelo: "Protector de copa o endoaural", vidaUtilDias: 180, talle: null },
  { nombre: "Guantes", tipoModelo: "Según la tarea", vidaUtilDias: 60, talle: null },
  { nombre: "Casco de seguridad", tipoModelo: "Con arnés regulable", vidaUtilDias: 730, talle: null },
  { nombre: "Protección respiratoria", tipoModelo: "Barbijo o semimáscara con filtro", vidaUtilDias: 30, talle: null },
  { nombre: "Faja lumbar", tipoModelo: "", vidaUtilDias: null, talle: null },
];

export interface DatosElemento { nombre: string; tipoModelo: string | null; marca: string | null; certificado: boolean; vidaUtilDias: number | null; talle: "ropa" | "calzado" | null; paraTodos: boolean; centroCostoIds: string[]; puestoIds: string[] }
const texto = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max) || null;
const lista = (v: unknown) => [...new Set<string>((Array.isArray(v) ? v : []).map(String).filter(Boolean))];

export function validarElemento(entrada: any): { datos: DatosElemento | null; error: string | null } {
  const mal = (error: string) => ({ datos: null, error });
  const nombre = String(entrada?.nombre ?? "").trim().slice(0, 80);
  if (nombre.length < 3) return mal("Ponele un nombre al elemento (por ejemplo: Calzado de seguridad).");
  let vidaUtilDias: number | null = null;
  if (entrada?.vidaUtilDias !== null && entrada?.vidaUtilDias !== undefined && entrada?.vidaUtilDias !== "") {
    vidaUtilDias = Number(entrada.vidaUtilDias);
    if (!Number.isInteger(vidaUtilDias) || vidaUtilDias < 1 || vidaUtilDias > 3650) return mal("La vida útil va en días, de 1 a 3650 (o vacía si no vence).");
  }
  const paraTodos = entrada?.paraTodos === true;
  return { datos: { nombre, tipoModelo: texto(entrada?.tipoModelo, 80), marca: texto(entrada?.marca, 60), certificado: entrada?.certificado !== false, vidaUtilDias, talle: entrada?.talle === "ropa" || entrada?.talle === "calzado" ? entrada.talle : null, paraTodos, centroCostoIds: paraTodos ? [] : lista(entrada?.centroCostoIds), puestoIds: paraTodos ? [] : lista(entrada?.puestoIds) }, error: null };
}

type Regla = { activo: boolean; paraTodos: boolean; centroCostoIds: string[]; puestoIds: string[] };
type Persona = { centroCostoId: string | null; puestoId: string | null };
// ¿Le corresponde? A todos, o por su sector, o por su puesto. Un elemento
// sin nadie asignado no le corresponde a nadie (se entrega solo a demanda).
export const leCorresponde = (e: Regla, p: Persona) => e.activo && (e.paraTodos || (p.centroCostoId !== null && e.centroCostoIds.includes(p.centroCostoId)) || (p.puestoId !== null && e.puestoIds.includes(p.puestoId)));

export const vencimiento = (fechaEntrega: Date, vidaUtilDias: number | null): Date | null => (vidaUtilDias ? new Date(fechaEntrega.getTime() + vidaUtilDias * DIA) : null);

export interface DatosEntrega { elementoId: string; cantidad: number; fechaEntrega: Date; motivo: string; talle: string | null; observacion: string | null }
// `fecha`: ya convertida a día. No se entrega a futuro, ni se cargan entregas
// de hace más de 5 años (un error de tipeo en el año).
export function validarEntrega(entrada: any, fecha: Date | null, hoy: Date): { datos: DatosEntrega | null; error: string | null } {
  const mal = (error: string) => ({ datos: null, error });
  if (!entrada?.elementoId) return mal("Elegí qué se entrega.");
  const cantidad = Number(entrada?.cantidad ?? 1);
  if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > 100) return mal("La cantidad va de 1 a 100.");
  if (!fecha) return mal("Poné la fecha de entrega.");
  if (fecha > hoy) return mal("La fecha de entrega no puede ser a futuro.");
  if (fecha.getTime() < hoy.getTime() - 5 * 365 * DIA) return mal("Revisá la fecha de entrega: es de hace más de 5 años.");
  return { datos: { elementoId: String(entrada.elementoId), cantidad, fechaEntrega: fecha, motivo: typeof entrada?.motivo === "string" && entrada.motivo in MOTIVOS_ENTREGA ? entrada.motivo : "reposicion", talle: texto(entrada?.talle, 10), observacion: texto(entrada?.observacion, 200) }, error: null };
}

// ── El estado del EPP de una persona ─────────────────────────────────
export type EstadoEpp = "falta" | "vencido" | "por_vencer" | "sin_firmar" | "vigente";
export const ESTADOS_EPP: Record<EstadoEpp, string> = { falta: "Nunca se entregó", vencido: "Vencido", por_vencer: "Por vencer", sin_firmar: "Falta la firma", vigente: "Al día" };
export interface EntregaMin { elementoId: string | null; fechaEntrega: Date; vence: Date | null; firmada: boolean }

// Para un elemento: manda la ÚLTIMA entrega. Lo más grave primero: sin
// entregar > vencido > por vencer > entregado sin firma > al día.
export function estadoElemento(entregas: EntregaMin[], hoy: Date): { estado: EstadoEpp; ultima: EntregaMin | null } {
  const ultima = [...entregas].sort((a, b) => b.fechaEntrega.getTime() - a.fechaEntrega.getTime())[0] ?? null;
  if (!ultima) return { estado: "falta", ultima };
  if (ultima.vence && ultima.vence < hoy) return { estado: "vencido", ultima };
  if (ultima.vence && ultima.vence.getTime() <= hoy.getTime() + DIAS_POR_VENCER * DIA) return { estado: "por_vencer", ultima };
  return { estado: ultima.firmada ? "vigente" : "sin_firmar", ultima };
}

export interface FilaEpp { elementoId: string; estado: EstadoEpp; ultima: EntregaMin | null }
// Lo que le corresponde a una persona, con el estado de cada cosa.
export function eppDe<E extends Regla & { id: string }>(persona: Persona, elementos: E[], entregas: EntregaMin[], hoy: Date): FilaEpp[] {
  return elementos.filter((e) => leCorresponde(e, persona)).map((e) => ({ elementoId: e.id, ...estadoElemento(entregas.filter((x) => x.elementoId === e.id), hoy) }));
}
// "Protegido" = tiene todo lo que le corresponde, entregado y sin vencer
// (por vencer y sin firma todavía protegen: son avisos, no faltas).
export const estaProtegido = (filas: FilaEpp[]) => filas.every((f) => f.estado !== "falta" && f.estado !== "vencido");
export const estaCompleto = (filas: FilaEpp[]) => filas.every((f) => f.estado === "vigente");

export function resumenEpp(personas: { id: string; filas: FilaEpp[] }[]) {
  const conEpp = personas.filter((p) => p.filas.length > 0);
  const filas = conEpp.flatMap((p) => p.filas);
  const cuenta = (e: EstadoEpp) => filas.filter((f) => f.estado === e).length;
  const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 1000) / 10 : null);
  return {
    personas: conEpp.length, sinAsignar: personas.length - conEpp.length,
    protegidas: conEpp.filter((p) => estaProtegido(p.filas)).length, pctProtegidas: pct(conEpp.filter((p) => estaProtegido(p.filas)).length, conEpp.length),
    completas: conEpp.filter((p) => estaCompleto(p.filas)).length,
    elementos: filas.length, falta: cuenta("falta"), vencido: cuenta("vencido"), porVencer: cuenta("por_vencer"), sinFirmar: cuenta("sin_firmar"), vigente: cuenta("vigente"),
    pctEntregado: pct(filas.length - cuenta("falta") - cuenta("vencido"), filas.length),
  };
}
