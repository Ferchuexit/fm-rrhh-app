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
