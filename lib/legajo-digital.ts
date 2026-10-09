// FM RRHH — lib/legajo-digital.ts
// Lado base de datos del legajo digital. Lo usan el portal (un legajo) y el
// panel (toda la dotación) — el estado de cada ítem se calcula en un solo
// lugar, así las dos puntas nunca dicen cosas distintas.
import { prisma } from "./prisma";
import { hoyArgentina } from "./ausencias-reglas";
import {
  TIPOS_DOCUMENTO, type TipoDocumento, type ItemChecklist, type Contenido, type DatosLegajo,
  contenidoFicha, contenidoDdjjDomicilio, contenidoNotifVacaciones, hashContenido, domicilioCompleto,
  estadoDocumento, estadoConstancia, resumenChecklist,
} from "./legajo-digital-reglas";
export * from "./legajo-digital-reglas";

type Doc = { id: string; tipo: string | null; estado: string; motivoRechazo: string | null };
type Firma = { id: string; tipo: string; vacacionId: string | null; hashContenido: string; firmadoEn: Date };
type Vac = { id: string; anioCorresponde: number; diasCorresponden: number; fechaDesde: Date; fechaHasta: Date };

export interface ParaFirmar { clave: string; tipo: "ficha" | "ddjj_domicilio" | "notif_vacaciones"; vacacionId?: string; contenido: Contenido; hash: string }

// El corazón: de los datos crudos al checklist. `paraFirmar` trae lo que
// el empleado puede firmar AHORA, ya con el contenido exacto.
export function armarChecklist(l: DatosLegajo, empresa: string, docs: Doc[], firmas: Firma[], vacaciones: Vac[]) {
  const items: ItemChecklist[] = [];
  const paraFirmar: ParaFirmar[] = [];

  // 1. Ficha
  const ficha = contenidoFicha(l, empresa);
  const estFicha = estadoConstancia(hashContenido(ficha), firmas.filter((f) => f.tipo === "ficha"));
  items.push({ clave: "ficha", nombre: "Ficha de datos personales", estado: estFicha, leToca: estFicha === "completo" ? null : "empleado", requerido: true,
    detalle: estFicha === "desactualizado" ? "Tus datos cambiaron desde la última firma" : undefined });
  if (estFicha !== "completo") paraFirmar.push({ clave: "ficha", tipo: "ficha", contenido: ficha, hash: hashContenido(ficha) });

  // 2. DD.JJ. de domicilio — sin domicilio cargado no hay nada que declarar
  if (!domicilioCompleto(l)) {
    items.push({ clave: "ddjj_domicilio", nombre: "Declaración jurada de domicilio", estado: "falta", leToca: "empleado", requerido: true, detalle: "Primero hay que cargar el domicilio completo (pedí el cambio en Mis datos)" });
  } else {
    const ddjj = contenidoDdjjDomicilio(l, empresa);
    const est = estadoConstancia(hashContenido(ddjj), firmas.filter((f) => f.tipo === "ddjj_domicilio"));
    items.push({ clave: "ddjj_domicilio", nombre: "Declaración jurada de domicilio", estado: est, leToca: est === "completo" ? null : "empleado", requerido: true,
      detalle: est === "desactualizado" ? "Tu domicilio cambió desde la última firma" : undefined });
    if (est !== "completo") paraFirmar.push({ clave: "ddjj_domicilio", tipo: "ddjj_domicilio", contenido: ddjj, hash: hashContenido(ddjj) });
  }

  // 3. Talles
  const tieneTalles = !!l.talleRopa?.trim() && !!l.talleCalzado?.trim();
  items.push({ clave: "talles", nombre: "Talles de ropa y calzado", estado: tieneTalles ? "completo" : "falta", leToca: tieneTalles ? null : "empleado", requerido: true,
    detalle: tieneTalles ? `Ropa ${l.talleRopa} · Calzado ${l.talleCalzado}` : undefined });

  // 4. Documentos que se suben
  for (const tipo of Object.keys(TIPOS_DOCUMENTO) as TipoDocumento[]) {
    const def = TIPOS_DOCUMENTO[tipo];
    items.push({ clave: tipo, nombre: def.nombre, requerido: def.requerido, ...estadoDocumento(tipo, docs) });
  }

  // 5. Notificación de cada vacación que todavía no terminó
  for (const v of vacaciones) {
    const cont = contenidoNotifVacaciones(l, empresa, v);
    const firmada = firmas.some((f) => f.tipo === "notif_vacaciones" && f.vacacionId === v.id && f.hashContenido === hashContenido(cont));
    const desde = v.fechaDesde.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", timeZone: "UTC" });
    items.push({ clave: `notif_vacaciones:${v.id}`, nombre: `Notificación de vacaciones (desde el ${desde})`, estado: firmada ? "completo" : "para_firmar", leToca: firmada ? null : "empleado", requerido: true });
    if (!firmada) paraFirmar.push({ clave: `notif_vacaciones:${v.id}`, tipo: "notif_vacaciones", vacacionId: v.id, contenido: cont, hash: hashContenido(cont) });
  }

  return { items, paraFirmar, resumen: resumenChecklist(items) };
}

const SEL_DOC = { id: true, tipo: true, estado: true, motivoRechazo: true, legajoId: true } as const;
const SEL_FIRMA = { id: true, tipo: true, vacacionId: true, hashContenido: true, firmadoEn: true, legajoId: true } as const;
const SEL_VAC = { id: true, anioCorresponde: true, diasCorresponden: true, fechaDesde: true, fechaHasta: true, legajoId: true } as const;

// Un legajo, completo (portal y detalle del panel).
export async function cargarLegajoDigital(legajoId: string) {
  const legajo = await prisma.legajo.findUniqueOrThrow({ where: { id: legajoId }, include: { empresa: { select: { razonSocial: true } } } });
  const [docs, firmas, vacaciones] = await Promise.all([
    prisma.documentoLegajo.findMany({ where: { legajoId, tipo: { not: null } }, select: SEL_DOC }),
    prisma.constanciaFirmada.findMany({ where: { legajoId }, select: SEL_FIRMA, orderBy: { firmadoEn: "desc" } }),
    prisma.vacacion.findMany({ where: { legajoId, fechaHasta: { gte: hoyArgentina() } }, select: SEL_VAC, orderBy: { fechaDesde: "asc" } }),
  ]);
  return { legajo, firmas, ...armarChecklist(legajo, legajo.empresa.razonSocial, docs, firmas, vacaciones) };
}

// Toda la dotación activa de una empresa, en 4 consultas (no 4 por legajo).
export async function resumenEmpresa(empresaId: string) {
  const empresa = await prisma.empresa.findUniqueOrThrow({ where: { id: empresaId }, select: { razonSocial: true } });
  const legajos = await prisma.legajo.findMany({ where: { empresaId, condicion: "activo" }, include: { accesoPortal: { select: { activo: true } } }, orderBy: { numeroLegajo: "asc" } });
  const ids = legajos.map((l) => l.id);
  const [docs, firmas, vacaciones] = await Promise.all([
    prisma.documentoLegajo.findMany({ where: { legajoId: { in: ids }, tipo: { not: null } }, select: SEL_DOC }),
    prisma.constanciaFirmada.findMany({ where: { legajoId: { in: ids } }, select: SEL_FIRMA, orderBy: { firmadoEn: "desc" } }),
    prisma.vacacion.findMany({ where: { legajoId: { in: ids }, fechaHasta: { gte: hoyArgentina() } }, select: SEL_VAC }),
  ]);
  const por = <T extends { legajoId: string }>(filas: T[]) => {
    const m = new Map<string, T[]>();
    for (const f of filas) (m.get(f.legajoId) ?? m.set(f.legajoId, []).get(f.legajoId)!).push(f);
    return m;
  };
  const [dPor, fPor, vPor] = [por(docs), por(firmas), por(vacaciones)];
  return legajos.map((l) => {
    const { items, resumen } = armarChecklist(l, empresa.razonSocial, dPor.get(l.id) ?? [], fPor.get(l.id) ?? [], vPor.get(l.id) ?? []);
    return {
      legajoId: l.id, numeroLegajo: l.numeroLegajo, apellido: l.apellido, nombre: l.nombre,
      tieneAcceso: l.accesoPortal?.activo === true, items, resumen,
      firmas: (fPor.get(l.id) ?? []).map((f) => ({ id: f.id, tipo: f.tipo, vacacionId: f.vacacionId, firmadoEn: f.firmadoEn })),
    };
  });
}
