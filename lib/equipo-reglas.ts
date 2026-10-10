// FM RRHH — lib/equipo-reglas.ts
// Reglas de la jerarquía "reporta a" — funciones puras, sin base de datos
// (tests/equipo-reglas.test.mjs).

// Motivo por el que `jefeId` no puede ser jefe de `legajoId`, o null si
// está bien. `jefeDe` = quién es hoy el jefe de cada legajo de la empresa.
// Un legajo nuevo (todavía sin id) no puede formar un círculo: pasar null.
export function motivoJefeInvalido(legajoId: string | null, jefeId: string, jefeDe: Map<string, string | null>): string | null {
  if (!jefeDe.has(jefeId)) return "El jefe elegido no es un legajo de esta empresa.";
  if (legajoId === null) return null;
  if (jefeId === legajoId) return "Una persona no puede reportarse a sí misma.";
  // Subir por la cadena del jefe propuesto: si aparece este legajo, quedaría
  // un círculo (A reporta a B y B reporta a A) y nadie sería jefe de nadie.
  const vistos = new Set<string>();
  let actual: string | null | undefined = jefeId;
  while (actual && !vistos.has(actual)) {
    if (actual === legajoId) return "No se puede: esa persona ya reporta (directa o indirectamente) a este legajo, y quedaría un círculo.";
    vistos.add(actual);
    actual = jefeDe.get(actual);
  }
  return null;
}

// Quién pide las vacaciones de un empleado: su jefe si tiene uno cargado;
// si no, él mismo (dirección, o empresas que no usan la jerarquía). Los
// permisos son un asunto personal: siempre los pide el propio empleado.
export function puedePedirParaSi(tipo: string, tieneJefe: boolean): boolean {
  return tipo !== "vacaciones" || !tieneJefe;
}
