// FM RRHH — lib/buscador-reglas.ts
// El buscador de la barra de arriba: funciones puras (tests en
// tests/reclamos-reglas.test.mjs). Ver docs/103.


// Para comparar sin mayúsculas ni tildes.
export const normalizar = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

// ¿Todas las palabras buscadas aparecen en el texto? Puntaje mayor si
// alguna arranca una palabra del texto (así "gar" encuentra a García antes
// que a Bogarín).
export function coincidencia(texto: string, consulta: string): number {
  const t = normalizar(texto), palabras = normalizar(consulta).split(/\s+/).filter(Boolean);
  if (!palabras.length) return 0;
  let puntos = 0;
  for (const p of palabras) {
    const i = t.indexOf(p);
    if (i < 0) return 0;
    puntos += i === 0 ? 3 : /[^a-z0-9]/.test(t[i - 1]) ? 2 : 1;
  }
  return puntos;
}
