// FM RRHH — lib/alcance-reglas.ts
// Alcance por sector: un usuario del panel puede estar limitado, en una
// empresa, a ciertos centros de costo. Acá está QUÉ se filtra y cómo se
// arma el filtro — funciones puras, sin base de datos
// (tests/alcance-reglas.test.mjs). Quién lo aplica: lib/alcance.ts.

// Cómo se llega desde un modelo hasta el Legajo dueño del dato:
//   Vacacion      → ["legajo"]
//   CuotaEmbargo  → ["embargo", "legajo"]
//   Legajo        → []
export type Caminos = Map<string, string[]>;

type CampoDmmf = { name: string; kind: string; type: string; isList: boolean; relationFromFields?: readonly string[] };
type ModeloDmmf = { name: string; fields: readonly CampoDmmf[] };

// Se deduce del esquema, no de una lista escrita a mano: un modelo nuevo
// con `legajo Legajo` queda filtrado solo, sin que nadie se acuerde.
export function caminosAlLegajo(modelos: readonly ModeloDmmf[]): Caminos {
  const caminos: Caminos = new Map([["Legajo", []]]);
  for (const m of modelos) {
    if (m.fields.some((f) => f.name === "legajo" && f.type === "Legajo" && !f.isList)) caminos.set(m.name, ["legajo"]);
  }
  // Un salto más: modelos que cuelgan de uno que ya tiene legajo
  // (el detalle de una liquidación, la cuota de un embargo).
  const directos = new Map(caminos);
  for (const m of modelos) {
    if (caminos.has(m.name)) continue;
    const via = m.fields.find((f) => f.kind === "object" && !f.isList && (f.relationFromFields?.length ?? 0) > 0 && f.type !== "Legajo" && directos.has(f.type));
    if (via) caminos.set(m.name, [via.name, ...directos.get(via.type)!]);
  }
  return caminos;
}

const LECTURA = ["findMany", "findFirst", "findFirstOrThrow", "findUnique", "findUniqueOrThrow", "count", "aggregate", "groupBy"];
const MODIFICA_CON_WHERE = ["update", "updateMany", "delete", "deleteMany"];
const CREA = ["create", "createMany", "createManyAndReturn", "upsert"];

// Cosas de TODA la empresa que alguien limitado a un sector puede mirar
// pero no tocar: cerrar un período de asistencia o cambiar una terminal
// afecta también a los sectores que no son suyos.
const SOLO_MIRAR = ["PeriodoAsistencia", "DispositivoAsistencia"];

export const MENSAJE_FUERA_DE_ALCANCE = "Eso está fuera de los sectores que tenés asignados. Si lo necesitás, pedíselo al administrador.";

export type Decision =
  | { accion: "pasar" } // el alcance no tiene nada que decir
  | { accion: "filtrar"; where: Record<string, unknown> } // sumar esta condición al where
  | { accion: "revisar_alta"; camino: string[] } // hay que confirmar que el legajo del alta esté en alcance
  | { accion: "negar" };

export function decidir(modelo: string, operacion: string, sectores: string[], caminos: Caminos): Decision {
  const enSector = { centroCostoId: { in: sectores } };
  const esLectura = LECTURA.includes(operacion);
  const conWhere = esLectura || MODIFICA_CON_WHERE.includes(operacion);

  if (SOLO_MIRAR.includes(modelo)) return esLectura ? { accion: "pasar" } : { accion: "negar" };

  // Los desplegables de sector muestran solo los propios.
  if (modelo === "CentroCosto") return conWhere ? { accion: "filtrar", where: { id: { in: sectores } } } : { accion: "negar" };

  // Noticias: se leen las de toda la empresa y las de sus sectores; se
  // publican, archivan o borran solo las de sus sectores.
  if (modelo === "Noticia") {
    if (esLectura) return { accion: "filtrar", where: { OR: [{ centroCostoId: null }, enSector] } };
    if (conWhere) return { accion: "filtrar", where: enSector };
    return { accion: "revisar_alta", camino: ["__noticia"] };
  }

  const camino = caminos.get(modelo);
  if (!camino) return { accion: "pasar" };
  if (conWhere) return { accion: "filtrar", where: camino.reduceRight<Record<string, unknown>>((dentro, campo) => ({ [campo]: dentro }), enSector) };
  if (CREA.includes(operacion)) {
    // Dar de alta un legajo, o algo que no cuelga directo de un legajo, no
    // es tarea de alguien limitado a un sector.
    return camino.length === 1 ? { accion: "revisar_alta", camino } : { accion: "negar" };
  }
  return { accion: "negar" }; // operación desconocida sobre datos de personas: mejor no
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
