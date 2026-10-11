// FM RRHH — lib/organigrama-reglas.ts
// El organigrama por PERSONAS (quién reporta a quién), para cuando la
// empresa todavía no cargó los puestos. El de puestos está en
// lib/reclutamiento-reglas.ts. Función pura (tests/organigrama-reglas.test.mjs).

export interface PersonaOrg { id: string; nombre: string; jefeId: string | null }
export interface FilaPersona<T> { persona: T; nivel: number; aCargo: number }

// La lista ordenada para dibujar el árbol: cada persona debajo de su jefe.
// Quien tiene un jefe que ya no está (o quedó en un círculo) va arriba de
// todo, para no perderlo. Los que no tienen jefe ni gente a cargo van al
// final, juntos.
export function arbolPersonas<T extends PersonaOrg>(personas: T[]): { arbol: FilaPersona<T>[]; sueltos: T[] } {
  const ids = new Set(personas.map((p) => p.id));
  const hijos = new Map<string | null, T[]>();
  for (const p of [...personas].sort((a, b) => a.nombre.localeCompare(b.nombre))) {
    const padre = p.jefeId && ids.has(p.jefeId) && p.jefeId !== p.id ? p.jefeId : null;
    hijos.set(padre, [...(hijos.get(padre) ?? []), p]);
  }
  const debajo = (id: string, camino = new Set<string>([id])): number => (hijos.get(id) ?? []).reduce((a, h) => (camino.has(h.id) ? a : a + 1 + debajo(h.id, new Set([...camino, h.id]))), 0);
  const arbol: FilaPersona<T>[] = [];
  const vistos = new Set<string>();
  const bajar = (padre: string | null, nivel: number) => {
    for (const p of hijos.get(padre) ?? []) {
      if (vistos.has(p.id)) continue;
      // Arriba de todo solo van los que tienen gente a cargo.
      if (padre === null && !(hijos.get(p.id)?.length)) continue;
      vistos.add(p.id);
      arbol.push({ persona: p, nivel, aCargo: debajo(p.id) });
      bajar(p.id, nivel + 1);
    }
  };
  bajar(null, 0);
  // Los que quedaron en un círculo (A jefe de B, B jefe de A).
  for (const p of personas) if (!vistos.has(p.id) && p.jefeId && ids.has(p.jefeId) && p.jefeId !== p.id) { vistos.add(p.id); arbol.push({ persona: p, nivel: 0, aCargo: 0 }); }
  return { arbol, sueltos: personas.filter((p) => !vistos.has(p.id)).sort((a, b) => a.nombre.localeCompare(b.nombre)) };
}

// ── El árbol para dibujar (tarjetas con líneas) ──────────────────────
export interface NodoOrg<T> { persona: T; hijos: NodoOrg<T>[]; total: number } // total = todos los que tiene por debajo
// Arma el árbol anidado. `raices`: quienes no reportan a nadie y tienen
// gente a cargo. `sueltos`: quienes no tienen jefe ni gente a cargo (lo
// que falta ubicar). Un círculo no cuelga: sus integrantes van a sueltos.
export function armarArbol<T extends PersonaOrg>(personas: T[]): { raices: NodoOrg<T>[]; sueltos: T[] } {
  const ids = new Set(personas.map((p) => p.id));
  const hijosDe = new Map<string | null, T[]>();
  for (const p of [...personas].sort((a, b) => a.nombre.localeCompare(b.nombre))) {
    const padre = p.jefeId && ids.has(p.jefeId) && p.jefeId !== p.id ? p.jefeId : null;
    hijosDe.set(padre, [...(hijosDe.get(padre) ?? []), p]);
  }
  const vistos = new Set<string>();
  const nodo = (p: T): NodoOrg<T> => {
    vistos.add(p.id);
    const hijos = (hijosDe.get(p.id) ?? []).filter((h) => !vistos.has(h.id)).map(nodo);
    // Primero los que tienen gente a cargo: así las ramas quedan juntas.
    hijos.sort((a, b) => Number(b.hijos.length > 0) - Number(a.hijos.length > 0) || a.persona.nombre.localeCompare(b.persona.nombre));
    return { persona: p, hijos, total: hijos.reduce((a, h) => a + 1 + h.total, 0) };
  };
  const raices = (hijosDe.get(null) ?? []).filter((p) => (hijosDe.get(p.id) ?? []).length > 0).map(nodo);
  return { raices, sueltos: personas.filter((p) => !vistos.has(p.id)).sort((a, b) => a.nombre.localeCompare(b.nombre)) };
}

// Quiénes quedarían dentro de un círculo con esta estructura (A reporta a
// B, B reporta a A). Vacío = está bien.
export function enCirculo(jefeDe: Map<string, string | null>): Set<string> {
  const mal = new Set<string>();
  for (const id of jefeDe.keys()) {
    const camino = new Set<string>([id]);
    for (let a = jefeDe.get(id) ?? null; a; a = jefeDe.get(a) ?? null) {
      if (a === id) { mal.add(id); break; }
      if (camino.has(a)) break; // un círculo más arriba: no es de este
      camino.add(a);
    }
  }
  return mal;
}

// La cadena de jefes de una persona, del más cercano al más alto.
export function cadenaDeMando(id: string, jefeDe: Map<string, string | null>): string[] {
  const cadena: string[] = [];
  for (let a = jefeDe.get(id) ?? null; a && !cadena.includes(a) && a !== id; a = jefeDe.get(a) ?? null) cadena.push(a);
  return cadena;
}

// Las iniciales para el avatar: "Retamar, Julián" o "Julián Retamar" → "JR".
export function iniciales(nombre: string, apellido: string): string {
  const letra = (s: string) => (s.trim()[0] ?? "").toUpperCase();
  return `${letra(nombre)}${letra(apellido)}` || "?";
}
