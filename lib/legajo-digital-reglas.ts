// FM RRHH — lib/legajo-digital-reglas.ts
// Qué lleva el legajo digital y cómo se decide el estado de cada ítem.
// Funciones puras, sin base de datos (tests/legajo-digital-reglas.test.mjs).
//
// El checklist replica la carpeta física de siempre: ficha, DD.JJ. de
// domicilio, talles, alta temprana, DNI, CUIL, notificación de vacaciones,
// certificados de estudios, certificados médicos y otros.
import { createHash } from "crypto";

// ── Documentos que se SUBEN (foto o PDF) ─────────────────────────────
// categoria: en cuál de las 4 carpetas que ya tenía la ficha del legajo cae.
// quien: quién lo puede subir desde su lado ('empleado' incluye a RR.HH.,
//        que siempre puede subir cualquier cosa).
export const TIPOS_DOCUMENTO = {
  dni: { nombre: "DNI (frente y dorso)", categoria: "personal", quien: "empleado", requerido: true },
  cuil: { nombre: "Constancia de CUIL", categoria: "personal", quien: "empleado", requerido: true },
  alta_temprana: { nombre: "Alta temprana de ARCA", categoria: "laboral", quien: "rrhh", requerido: true },
  cert_estudios: { nombre: "Certificados de estudios", categoria: "laboral", quien: "empleado", requerido: false },
  cert_medico: { nombre: "Certificados médicos", categoria: "novedades", quien: "empleado", requerido: false },
  otro: { nombre: "Otros", categoria: "personal", quien: "empleado", requerido: false },
} as const;
export type TipoDocumento = keyof typeof TIPOS_DOCUMENTO;
// hasOwnProperty y no `in`: "constructor" o "toString" están `in` cualquier objeto.
export const esTipoDocumento = (t: unknown): t is TipoDocumento => typeof t === "string" && Object.prototype.hasOwnProperty.call(TIPOS_DOCUMENTO, t);

// Lo que el empleado NUNCA ve de su propio legajo: sanciones, cartas
// documento, notificaciones legales.
export const CATEGORIA_RESERVADA = "disciplinario_legal";

export const TAMANIO_MAXIMO_BYTES = 3 * 1024 * 1024; // mismo tope que la subida de RR.HH. (límite de Vercel)
export const MIMES_PERMITIDOS = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

// ── Constancias que GENERA el sistema y el empleado firma ────────────
export const TIPOS_CONSTANCIA = ["ficha", "ddjj_domicilio", "notif_vacaciones"] as const;
export type TipoConstancia = (typeof TIPOS_CONSTANCIA)[number];

export interface Contenido {
  titulo: string;
  secciones: { titulo?: string; filas: [string, string][] }[];
  declaracion: string;
}

const fecha = (d: Date | null | undefined) => (d ? d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }) : "");
const txt = (v: unknown) => String(v ?? "").trim();

export interface DatosLegajo {
  numeroLegajo: number; apellido: string; nombre: string; cuil: string; fechaIngreso: Date;
  tipoDocumento: string | null; numeroDocumento: string | null; fechaNacimiento: Date | null; sexo: string | null; estadoCivil: string | null;
  nivelEducativo: string | null; tituloObtenido: string | null;
  domicilio: string | null; localidad: string | null; partido: string | null; provincia: string | null; telefono: string | null; email: string | null;
  talleRopa: string | null; talleCalzado: string | null;
}

// La ficha que se firma lleva SOLO datos personales. A propósito no
// incluye categoría, convenio ni talles: cambian seguido (un ascenso, una
// campera nueva) y cada cambio obligaría a volver a firmar la ficha.
export function contenidoFicha(l: DatosLegajo, empresa: string): Contenido {
  return {
    titulo: "FICHA DE DATOS PERSONALES",
    secciones: [
      { filas: [["Empresa", empresa], ["Legajo N°", String(l.numeroLegajo)], ["Fecha de ingreso", fecha(l.fechaIngreso)]] },
      {
        titulo: "Datos personales",
        filas: [
          ["Apellido y nombre", `${l.apellido}, ${l.nombre}`], ["CUIL", l.cuil],
          ["Documento", `${txt(l.tipoDocumento)} ${txt(l.numeroDocumento)}`.trim()], ["Fecha de nacimiento", fecha(l.fechaNacimiento)],
          ["Sexo", txt(l.sexo)], ["Estado civil", txt(l.estadoCivil)],
          ["Nivel educativo", txt(l.nivelEducativo)], ["Título", txt(l.tituloObtenido)],
        ],
      },
      {
        titulo: "Domicilio y contacto",
        filas: [["Domicilio", txt(l.domicilio)], ["Localidad", txt(l.localidad)], ["Partido", txt(l.partido)], ["Provincia", txt(l.provincia)], ["Teléfono", txt(l.telefono)], ["Email", txt(l.email)]],
      },
    ],
    declaracion: "Declaro que los datos consignados en esta ficha son correctos y completos, y me comprometo a informar a la empresa cualquier modificación.",
  };
}

export function contenidoDdjjDomicilio(l: DatosLegajo, empresa: string): Contenido {
  return {
    titulo: "DECLARACIÓN JURADA DE DOMICILIO",
    secciones: [
      { filas: [["Empresa", empresa], ["Apellido y nombre", `${l.apellido}, ${l.nombre}`], ["CUIL", l.cuil], ["Legajo N°", String(l.numeroLegajo)]] },
      { titulo: "Domicilio real", filas: [["Domicilio", txt(l.domicilio)], ["Localidad", txt(l.localidad)], ["Partido", txt(l.partido)], ["Provincia", txt(l.provincia)]] },
    ],
    declaracion:
      "Declaro bajo juramento que mi domicilio real es el indicado, donde serán válidas todas las notificaciones que me curse el empleador. Me comprometo a informar cualquier cambio de domicilio dentro de las 48 horas de producido.",
  };
}

export function contenidoNotifVacaciones(l: DatosLegajo, empresa: string, v: { anioCorresponde: number; diasCorresponden: number; fechaDesde: Date; fechaHasta: Date }): Contenido {
  return {
    titulo: "NOTIFICACIÓN DE OTORGAMIENTO DE VACACIONES",
    secciones: [
      { filas: [["Empresa", empresa], ["Apellido y nombre", `${l.apellido}, ${l.nombre}`], ["CUIL", l.cuil], ["Legajo N°", String(l.numeroLegajo)]] },
      {
        titulo: "Período otorgado",
        filas: [["Año que corresponde", String(v.anioCorresponde)], ["Días", `${v.diasCorresponden} días corridos`], ["Fecha de inicio", fecha(v.fechaDesde)], ["Fecha de finalización", fecha(v.fechaHasta)]],
      },
    ],
    declaracion: "De conformidad con el art. 154 de la Ley de Contrato de Trabajo, me notifico del otorgamiento del período vacacional indicado.",
  };
}

// Huella de lo firmado. JSON.stringify alcanza como forma canónica porque
// el Contenido siempre se arma con las claves en el mismo orden.
export const hashContenido = (c: Contenido) => createHash("sha256").update(JSON.stringify(c)).digest("hex");

// Para firmar la DD.JJ. tiene que haber un domicilio que declarar.
export const domicilioCompleto = (l: Pick<DatosLegajo, "domicilio" | "localidad" | "provincia">) => !!txt(l.domicilio) && !!txt(l.localidad) && !!txt(l.provincia);

// ── Cambio de datos pedido por el empleado ───────────────────────────
export const CAMPOS_EDITABLES = {
  domicilio: { nombre: "Domicilio (calle, número, piso)", max: 150 },
  localidad: { nombre: "Localidad", max: 80 },
  partido: { nombre: "Partido", max: 80 },
  provincia: { nombre: "Provincia", max: 60 },
  telefono: { nombre: "Teléfono", max: 30 },
  email: { nombre: "Email", max: 120 },
  estadoCivil: { nombre: "Estado civil", max: 20, opciones: ["Soltero/a", "Casado/a", "Divorciado/a", "Viudo/a"] },
} as const;
export type CampoEditable = keyof typeof CAMPOS_EDITABLES;

export type Cambios = Partial<Record<CampoEditable, { antes: string; despues: string }>>;

// Compara lo propuesto contra la ficha y se queda solo con lo que cambia de
// verdad. Ignora cualquier campo que no esté en CAMPOS_EDITABLES: aunque
// alguien mande "categoriaId" o "cbu" a mano, acá no pasa.
export function armarCambios(actual: Record<string, unknown>, propuesto: Record<string, unknown>): { cambios: Cambios; error: string | null } {
  const cambios: Cambios = {};
  for (const campo of Object.keys(CAMPOS_EDITABLES) as CampoEditable[]) {
    if (!Object.prototype.hasOwnProperty.call(propuesto ?? {}, campo)) continue;
    const def = CAMPOS_EDITABLES[campo];
    const despues = txt(propuesto[campo]);
    const antes = txt(actual[campo]);
    if (despues === antes) continue;
    if (despues.length > def.max) return { cambios: {}, error: `${def.nombre}: es demasiado largo.` };
    if ("opciones" in def && despues && !(def.opciones as readonly string[]).includes(despues)) return { cambios: {}, error: `${def.nombre}: elegí una de las opciones.` };
    if (campo === "email" && despues && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(despues)) return { cambios: {}, error: "El email no parece válido." };
    if (["domicilio", "localidad", "provincia"].includes(campo) && !despues) return { cambios: {}, error: `${def.nombre}: no puede quedar vacío.` };
    cambios[campo] = { antes, despues };
  }
  if (Object.keys(cambios).length === 0) return { cambios, error: "No cambiaste ningún dato." };
  return { cambios, error: null };
}

// ── Talles ───────────────────────────────────────────────────────────
export const TALLES_ROPA = ["XS", "S", "M", "L", "XL", "XXL"];
export function validarTalles(ropa: unknown, calzado: unknown): string | null {
  if (!TALLES_ROPA.includes(txt(ropa))) return "Elegí tu talle de ropa.";
  const n = Number(txt(calzado));
  if (!/^\d{2}(\.5)?$/.test(txt(calzado)) || n < 30 || n > 52) return "El talle de calzado tiene que ser un número entre 30 y 52.";
  return null;
}

// ── Estado del checklist ─────────────────────────────────────────────
// completo        ✓ está y vale
// para_firmar     hay que firmarlo (nunca se firmó)
// desactualizado  se firmó, pero los datos cambiaron después → firmar de nuevo
// en_revision     el empleado lo subió y RR.HH. todavía no lo miró
// rechazado       RR.HH. lo rechazó (foto ilegible, etc.) → subir de nuevo
// falta           no está
// opcional        no está, y no es obligatorio
export type EstadoItem = "completo" | "para_firmar" | "desactualizado" | "en_revision" | "rechazado" | "falta" | "opcional";

export interface ItemChecklist {
  clave: string;
  nombre: string;
  estado: EstadoItem;
  detalle?: string;
  // quién tiene que hacer algo para destrabarlo
  leToca: "empleado" | "rrhh" | null;
  requerido: boolean;
}

export function estadoDocumento(tipo: TipoDocumento, docs: { tipo: string | null; estado: string; motivoRechazo?: string | null }[]): Pick<ItemChecklist, "estado" | "detalle" | "leToca"> {
  const def = TIPOS_DOCUMENTO[tipo];
  const propios = docs.filter((d) => d.tipo === tipo);
  if (propios.some((d) => d.estado === "aceptado")) return { estado: "completo", leToca: null };
  if (propios.some((d) => d.estado === "pendiente")) return { estado: "en_revision", leToca: "rrhh" };
  const rechazado = propios.find((d) => d.estado === "rechazado");
  const quien = def.quien === "rrhh" ? "rrhh" : "empleado";
  if (rechazado) return { estado: "rechazado", detalle: rechazado.motivoRechazo ?? undefined, leToca: quien };
  return def.requerido ? { estado: "falta", leToca: quien } : { estado: "opcional", leToca: null };
}

export function estadoConstancia(hashActual: string, firmadas: { hashContenido: string }[]): EstadoItem {
  if (firmadas.length === 0) return "para_firmar";
  return firmadas.some((f) => f.hashContenido === hashActual) ? "completo" : "desactualizado";
}

// Un legajo está completo cuando todo lo REQUERIDO está en "completo".
export function resumenChecklist(items: ItemChecklist[]) {
  const requeridos = items.filter((i) => i.requerido);
  const completos = requeridos.filter((i) => i.estado === "completo").length;
  return {
    completos,
    total: requeridos.length,
    completo: completos === requeridos.length,
    pendientesEmpleado: items.filter((i) => i.leToca === "empleado").length,
    pendientesRrhh: items.filter((i) => i.leToca === "rrhh").length,
  };
}
