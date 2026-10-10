// FM RRHH — lib/alcance-reglas.ts
// Qué datos puede tocar cada usuario del panel. Dos límites, uno adentro
// del otro:
//   1. EMPRESAS: quien no es administrador solo llega a datos de las
//      empresas que tiene asignadas — aunque conozca el id de un legajo o
//      un período de otra.
//   2. SECTORES (opcional): dentro de una empresa, puede estar limitado a
//      ciertos centros de costo.
// Acá está QUÉ se filtra y cómo se arma el filtro — funciones puras, sin
// base de datos (tests/alcance-reglas.test.mjs). Quién lo aplica:
// lib/alcance.ts.

export interface Alcance {
  empresas: string[]; // ids de las empresas asignadas
  sectores: string[] | null; // null = sin límite de sector en la empresa actual
}

// Cómo se llega desde un modelo hasta el dueño del dato.
//   legajo:  Vacacion → ["legajo"] · CuotaEmbargo → ["embargo","legajo"] · Legajo → []
//   empresa: Periodo → [] (tiene empresaId) · Salvedad → ["periodo"]
export interface Caminos {
  legajo: Map<string, string[]>;
  empresa: Map<string, string[]>;
}

type CampoDmmf = { name: string; kind: string; type: string; isList: boolean; relationFromFields?: readonly string[] };
type ModeloDmmf = { name: string; fields: readonly CampoDmmf[] };

// Tablas de "quién entra y qué puede": las maneja solo el administrador y
// las lee el propio sistema para armar los permisos. No se filtran.
const DE_ACCESO = ["Usuario", "UsuarioEmpresa", "Rol"];

// Se deduce del esquema, no de una lista escrita a mano: una tabla nueva
// con `legajo Legajo` o con `empresaId` queda protegida sola, sin que
// nadie se acuerde.
export function caminos(modelos: readonly ModeloDmmf[]): Caminos {
  const aUnSalto = (base: Map<string, string[]>, m: ModeloDmmf) =>
    m.fields.find((f) => f.kind === "object" && !f.isList && (f.relationFromFields?.length ?? 0) > 0 && f.type !== m.name && base.has(f.type));

  const legajo = new Map<string, string[]>([["Legajo", []]]);
  for (const m of modelos) {
    if (m.fields.some((f) => f.name === "legajo" && f.type === "Legajo" && !f.isList)) legajo.set(m.name, ["legajo"]);
  }
  // Un salto más: lo que cuelga de algo que ya tiene legajo (el detalle de
  // una liquidación, la cuota de un embargo).
  const legajoDirectos = new Map(legajo);
  for (const m of modelos) {
    if (legajo.has(m.name)) continue;
    const via = aUnSalto(legajoDirectos, m);
    if (via) legajo.set(m.name, [via.name, ...legajoDirectos.get(via.type)!]);
  }

  // Lo que es de una empresa sin ser de una persona: períodos, sectores,
  // noticias, terminales… y lo que cuelga de eso a un salto.
  const empresa = new Map<string, string[]>();
  for (const m of modelos) {
    if (DE_ACCESO.includes(m.name) || legajo.has(m.name)) continue;
    if (m.fields.some((f) => f.name === "empresaId")) empresa.set(m.name, []);
  }
  const empresaDirectos = new Map(empresa);
  for (const m of modelos) {
    if (DE_ACCESO.includes(m.name) || legajo.has(m.name) || empresa.has(m.name) || m.name === "Empresa") continue;
    const via = aUnSalto(empresaDirectos, m);
    if (via) empresa.set(m.name, [via.name]);
  }
  return { legajo, empresa };
}

const LECTURA = ["findMany", "findFirst", "findFirstOrThrow", "findUnique", "findUniqueOrThrow", "count", "aggregate", "groupBy"];
const MODIFICA_CON_WHERE = ["update", "updateMany", "delete", "deleteMany"];
const CREA = ["create", "createMany", "createManyAndReturn", "upsert"];

// Cosas de TODA la empresa que alguien limitado a un sector puede mirar
// pero no tocar: cerrar un período de asistencia o cambiar una terminal
// afecta también a los sectores que no son suyos.
// Tampoco define los horarios de la empresa: asigna los que existen.
const SOLO_MIRAR_CON_SECTORES = ["PeriodoAsistencia", "DispositivoAsistencia", "HorarioTrabajo", "PlantillaIngreso", "Feriado", "Habilidad", "FormularioEvaluacion", "CicloEvaluacion"];

export const MENSAJE_FUERA_DE_ALCANCE = "Eso está fuera de las empresas o sectores que tenés asignados. Si lo necesitás, pedíselo al administrador.";

export type Decision =
  | { accion: "pasar" } // el alcance no tiene nada que decir
  | { accion: "filtrar"; where: Record<string, unknown> } // sumar esta condición al where
  | { accion: "revisar_alta"; de: "legajo" | "empresa" | "noticia" } // confirmar que el alta sea para alguien/algo en alcance
  | { accion: "negar" };

const anidar = (camino: string[], dentro: Record<string, unknown>) => camino.reduceRight<Record<string, unknown>>((d, campo) => ({ [campo]: d }), dentro);

export function decidir(modelo: string, operacion: string, alcance: Alcance, c: Caminos): Decision {
  const { empresas, sectores } = alcance;
  const enEmpresas = { empresaId: { in: empresas } };
  const enSector = sectores ? { centroCostoId: { in: sectores } } : null;
  const esLectura = LECTURA.includes(operacion);
  const conWhere = esLectura || MODIFICA_CON_WHERE.includes(operacion);
  const esAlta = CREA.includes(operacion);

  if (DE_ACCESO.includes(modelo)) return { accion: "pasar" };

  // La empresa misma: solo las asignadas; darlas de alta o borrarlas es
  // del administrador.
  if (modelo === "Empresa") {
    if (esLectura || operacion === "update" || operacion === "updateMany") return { accion: "filtrar", where: { id: { in: empresas } } };
    return { accion: "negar" };
  }

  // ── Datos de personas ──
  const alLegajo = c.legajo.get(modelo);
  if (alLegajo) {
    if (conWhere) return { accion: "filtrar", where: anidar(alLegajo, { ...enEmpresas, ...(enSector ?? {}) }) };
    if (esAlta) {
      if (alLegajo.length === 0) return enSector ? { accion: "negar" } : { accion: "revisar_alta", de: "empresa" }; // dar de alta un legajo
      if (alLegajo.length === 1) return { accion: "revisar_alta", de: "legajo" };
      // A dos saltos (detalle de una liquidación): a su padre solo se llega
      // por consultas ya filtradas. Con sectores, directamente no.
      return enSector ? { accion: "negar" } : { accion: "pasar" };
    }
    return { accion: "negar" }; // operación desconocida sobre datos de personas: mejor no
  }

  // ── Datos de la empresa ──
  const aLaEmpresa = c.empresa.get(modelo);
  if (!aLaEmpresa) return { accion: "pasar" }; // tablas generales: convenios, escalas, conceptos…

  if (enSector) {
    if (SOLO_MIRAR_CON_SECTORES.includes(modelo) && !esLectura) return { accion: "negar" };
    // Los desplegables de sector muestran solo los propios.
    if (modelo === "CentroCosto") return conWhere ? { accion: "filtrar", where: { ...enEmpresas, id: { in: sectores! } } } : { accion: "negar" };
    // Noticias: lee las generales y las de sus sectores; publica, archiva
    // o borra solo las de sus sectores.
    if (modelo === "Noticia") {
      if (esLectura) return { accion: "filtrar", where: { ...enEmpresas, OR: [{ centroCostoId: null }, enSector] } };
      if (conWhere) return { accion: "filtrar", where: { ...enEmpresas, ...enSector } };
      return { accion: "revisar_alta", de: "noticia" };
    }
  }

  if (conWhere) return { accion: "filtrar", where: anidar(aLaEmpresa, enEmpresas) };
  if (esAlta) return aLaEmpresa.length === 0 ? { accion: "revisar_alta", de: "empresa" } : { accion: "pasar" };
  return { accion: "negar" };
}

// El where original MÁS el del alcance. Sirve igual para findMany y para
// findUnique (Prisma acepta AND al lado de la clave única).
export function sumarFiltro(where: Record<string, any> | undefined, filtro: Record<string, unknown>) {
  const base = where ?? {};
  const previos = base.AND === undefined ? [] : Array.isArray(base.AND) ? base.AND : [base.AND];
  return { ...base, AND: [...previos, filtro] };
}

// De los datos de un alta, a quién corresponde: legajoId directo o
// legajo: { connect: { id } }. null = no se puede saber → se niega.
export function legajosDelAlta(operacion: string, args: any): string[] | null {
  const filas = operacion === "upsert" ? [args?.create] : Array.isArray(args?.data) ? args.data : [args?.data];
  const ids: string[] = [];
  for (const f of filas) {
    const id = f?.legajoId ?? f?.legajo?.connect?.id;
    if (typeof id !== "string" || !id) return null;
    ids.push(id);
  }
  return ids.length ? ids : null;
}

// De los datos de un alta, a qué empresa corresponde: empresaId directo o
// empresa: { connect: { id } }. null = no se puede saber → se niega.
export function empresasDelAlta(operacion: string, args: any): string[] | null {
  const filas = operacion === "upsert" ? [args?.create] : Array.isArray(args?.data) ? args.data : [args?.data];
  const ids: string[] = [];
  for (const f of filas) {
    const id = f?.empresaId ?? f?.empresa?.connect?.id;
    if (typeof id !== "string" || !id) return null;
    ids.push(id);
  }
  return ids.length ? ids : null;
}
