// FM RRHH — lib/objetivos.ts
// Lado base de datos de objetivos y plan de carrera. Lo usan el panel
// (RR.HH.) y el portal (el jefe y el propio empleado) para que valgan las
// mismas reglas en los dos lados.
import { prisma } from "./prisma";
import { fechaDesdeTexto, hoyArgentina } from "./ausencias-reglas";
import { avisar, avisoObjetivoNuevo, avisoObjetivoCerrado } from "./avisos";
import { validarObjetivo, limpiarAvance, CIERRES } from "./objetivos-reglas";
export * from "./objetivos-reglas";

type Resultado = { error: string; status: number } | { ok: true; creados?: number };

// El mismo objetivo para una o varias personas (un objetivo de sector se
// carga una vez). Quien llama ya verificó que los legajos son suyos.
export async function crearObjetivos(legajoIds: string[], body: any, quien: string): Promise<Resultado> {
  const fechaLimite = fechaDesdeTexto(body?.fechaLimite);
  const { datos, error } = validarObjetivo(body, fechaLimite, hoyArgentina());
  if (error) return { error, status: 400 };
  if (legajoIds.length === 0) return { error: "Elegí para quién es el objetivo.", status: 400 };
  await prisma.objetivo.createMany({ data: legajoIds.map((legajoId) => ({ legajoId, ...datos, fechaLimite: fechaLimite!, creadoPor: quien })) });
  await avisar(legajoIds, avisoObjetivoNuevo(fechaLimite!));
  return { ok: true, creados: legajoIds.length };
}

// Informar cómo viene (cualquiera de los tres: empleado, jefe, RR.HH.).
export async function informarAvance(id: string, body: any, quien: string): Promise<Resultado> {
  const avance = limpiarAvance(body?.avance);
  if (avance === null) return { error: "El avance va de 0 a 100.", status: 400 };
  const { count } = await prisma.objetivo.updateMany({ where: { id, estado: "en_curso" }, data: { avance, nota: String(body?.nota ?? "").trim().slice(0, 500) || null, notaPor: quien, actualizadoEn: new Date() } });
  return count ? { ok: true } : { error: "Ese objetivo ya está cerrado.", status: 409 };
}

// Cerrarlo con resultado (jefe o RR.HH.; nunca el propio empleado).
export async function cerrarObjetivo(id: string, body: any, quien: string): Promise<Resultado> {
  const estado = CIERRES.find((c) => c === body?.estado);
  if (!estado) return { error: "Elegí cómo se cierra: cumplido, no cumplido o cancelado.", status: 400 };
  const comentario = String(body?.comentario ?? "").trim().slice(0, 500);
  if (estado === "no_cumplido" && comentario.length < 10) return { error: "Si no se cumplió, escribí por qué: es lo que va a leer la persona.", status: 400 };
  const o = await prisma.objetivo.findFirst({ where: { id, estado: "en_curso" }, select: { legajoId: true } });
  if (!o) return { error: "Ese objetivo ya está cerrado.", status: 409 };
  const { count } = await prisma.objetivo.updateMany({ where: { id, estado: "en_curso" }, data: { estado, comentarioCierre: comentario || null, cerradoPor: quien, cerradoEn: new Date(), ...(estado === "cumplido" ? { avance: 100 } : {}) } });
  if (!count) return { error: "Ese objetivo ya está cerrado.", status: 409 };
  if (estado !== "cancelado") await avisar([o.legajoId], avisoObjetivoCerrado(estado === "cumplido"));
  return { ok: true };
}
