// FM RRHH — lib/biblioteca-reglas.ts
// Librería de conocimiento: validar un artículo, decidir quién lo ve, y el
// buscador. Funciones puras (tests/biblioteca-reglas.test.mjs).

export const ESTADOS_ARTICULO: Record<string, string> = { borrador: "Borrador", publicado: "Publicado", archivado: "Archivado" };
export const MAX_ARCHIVO_BYTES = 4 * 1024 * 1024; // el límite de subida de Vercel es 4,5 MB
export const ARCHIVOS_ACEPTADOS = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

// Con qué arrancar: las categorías que casi toda fábrica necesita, con qué
// va en cada una. Son sugerencias: la categoría es texto libre.
export const CATEGORIAS_SUGERIDAS: { nombre: string; emoji: string; ejemplos: string }[] = [
  { nombre: "Reglamento y normas", emoji: "📘", ejemplos: "Reglamento interno, código de conducta, política de uso del celular, régimen de sanciones" },
  { nombre: "Seguridad e higiene", emoji: "🦺", ejemplos: "Uso de EPP por puesto, plan de evacuación, qué hacer ante un accidente, hojas de seguridad de productos" },
  { nombre: "Procedimientos", emoji: "📋", ejemplos: "Cómo pedir vacaciones, cómo avisar una ausencia, cómo presentar un certificado, cómo pedir un adelanto" },
  { nombre: "Máquinas e instructivos", emoji: "⚙️", ejemplos: "Instructivo de cada máquina, puesta en marcha, limpieza, cambio de herramienta, mantenimiento de primer nivel" },
  { nombre: "Calidad", emoji: "✅", ejemplos: "Estándares del producto, controles por puesto, qué hacer con una pieza no conforme" },
  { nombre: "Preguntas frecuentes", emoji: "❓", ejemplos: "Cuándo se cobra, cómo leer el recibo, cómo se calculan las vacaciones, a quién le aviso si…" },
  { nombre: "Formularios", emoji: "🗂️", ejemplos: "Planillas y formularios para descargar e imprimir" },
];
export const emojiDeCategoria = (c: string) => CATEGORIAS_SUGERIDAS.find((s) => s.nombre.toLowerCase() === c.trim().toLowerCase())?.emoji ?? "📄";

export interface DatosArticulo { titulo: string; categoria: string; contenido: string | null; enlace: string | null; centroCostoIds: string[]; destacado: boolean }
const texto = (v: unknown, max: number) => String(v ?? "").replace(/\r/g, "").trim().slice(0, max) || null;

// `tieneArchivo`: si ya tiene uno guardado o viene uno en este envío.
export function validarArticulo(entrada: any, tieneArchivo: boolean): { datos: DatosArticulo | null; error: string | null } {
  const mal = (error: string) => ({ datos: null, error });
  const titulo = String(entrada?.titulo ?? "").trim().slice(0, 120);
  if (titulo.length < 3) return mal("Ponele un título: es por lo que la gente lo va a buscar.");
  const categoria = String(entrada?.categoria ?? "").trim().replace(/\s+/g, " ").slice(0, 50);
  if (categoria.length < 2) return mal("Elegí (o escribí) una categoría.");
  const contenido = texto(entrada?.contenido, 20000);
  let enlace = texto(entrada?.enlace, 500);
  if (enlace) {
    if (!/^https?:\/\//i.test(enlace)) enlace = `https://${enlace}`;
    try { if (!new URL(enlace).hostname.includes(".")) throw new Error(); } catch { return mal("Revisá el enlace: no parece una dirección válida."); }
  }
  if (!contenido && !enlace && !tieneArchivo) return mal("El artículo está vacío: escribí el texto, subí un archivo o pegá un enlace.");
  // Los sectores pueden llegar como lista o, desde un formulario, como texto con comas.
  const crudos = Array.isArray(entrada?.centroCostoIds) ? entrada.centroCostoIds : String(entrada?.centroCostoIds ?? "").split(",");
  return { datos: { titulo, categoria, contenido, enlace, centroCostoIds: [...new Set<string>(crudos.map((x: unknown) => String(x).trim()).filter(Boolean))], destacado: entrada?.destacado === true || entrada?.destacado === "true" }, error: null };
}

export function motivoArchivoInvalido(bytes: number, mimeReal: string | null): string | null {
  if (bytes > MAX_ARCHIVO_BYTES) return "El archivo pesa más de 4 MB. Si es un PDF escaneado, probá bajarle la calidad o partirlo en dos artículos.";
  if (!mimeReal || !ARCHIVOS_ACEPTADOS.includes(mimeReal)) return "El archivo tiene que ser un PDF o una imagen (JPG, PNG o WebP).";
  return null;
}

// ¿Lo ve esta persona en el portal?
export const loVe = (a: { estado: string; centroCostoIds: string[] }, centroCostoId: string | null) => a.estado === "publicado" && (a.centroCostoIds.length === 0 || (centroCostoId !== null && a.centroCostoIds.includes(centroCostoId)));

// ── Buscador ─────────────────────────────────────────────────────────
// Sin tildes ni mayúsculas: "evacuacion" encuentra "Evacuación".
export const normalizar = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const VACIAS = new Set(["de", "del", "la", "el", "los", "las", "un", "una", "y", "o", "en", "que", "como", "para", "por", "con", "se", "al", "a", "es", "mi", "me"]);
export const palabrasDe = (consulta: string) => [...new Set(normalizar(consulta).split(/[^a-z0-9ñ]+/).filter((p) => p.length >= 2 && !VACIAS.has(p)))];

export interface Buscable { id: string; titulo: string; categoria: string; contenido: string | null; archivoTexto: string | null }
export interface Resultado<T> { articulo: T; puntaje: number; fragmento: string | null }

// Busca en el título (lo que más pesa), la categoría, el texto y el
// contenido del PDF. Tienen que aparecer TODAS las palabras buscadas (en
// cualquier parte): así "vacaciones pedir" no devuelve todo lo que dice
// "pedir". Devuelve un fragmento de dónde lo encontró.
export function buscar<T extends Buscable>(articulos: T[], consulta: string): Resultado<T>[] {
  const palabras = palabrasDe(consulta);
  if (palabras.length === 0) return [];
  const resultados: Resultado<T>[] = [];
  for (const a of articulos) {
    const titulo = normalizar(a.titulo), categoria = normalizar(a.categoria);
    const cuerpo = [a.contenido, a.archivoTexto].filter(Boolean).join(" \n ");
    const cuerpoN = normalizar(cuerpo);
    let puntaje = 0, todas = true;
    for (const p of palabras) {
      const enTitulo = titulo.includes(p), enCat = categoria.includes(p), enCuerpo = cuerpoN.includes(p);
      if (!enTitulo && !enCat && !enCuerpo) { todas = false; break; }
      puntaje += (enTitulo ? 10 : 0) + (enCat ? 3 : 0) + (enCuerpo ? 1 + Math.min(4, cuerpoN.split(p).length - 2) : 0);
    }
    if (!todas) continue;
    // El fragmento: alrededor de la primera palabra que aparece en el cuerpo.
    // (normalizar no cambia el largo de las letras con tilde que usamos, así
    // que la posición sirve para cortar el texto original.)
    let fragmento: string | null = null;
    const pos = Math.min(...palabras.map((p) => cuerpoN.indexOf(p)).filter((i) => i >= 0), Infinity);
    if (Number.isFinite(pos) && cuerpoN.length === cuerpo.length) {
      const ini = Math.max(0, pos - 60);
      fragmento = `${ini > 0 ? "…" : ""}${cuerpo.slice(ini, pos + 120).replace(/\s+/g, " ").trim()}${pos + 120 < cuerpo.length ? "…" : ""}`;
    }
    resultados.push({ articulo: a, puntaje, fragmento });
  }
  return resultados.sort((x, y) => y.puntaje - x.puntaje || x.articulo.titulo.localeCompare(y.articulo.titulo));
}

// Agrupa por categoría: primero las sugeridas, en su orden; después el resto.
export function porCategoria<T extends { categoria: string; titulo: string }>(articulos: T[]): { categoria: string; emoji: string; articulos: T[] }[] {
  const grupos = new Map<string, T[]>();
  for (const a of articulos) grupos.set(a.categoria, [...(grupos.get(a.categoria) ?? []), a]);
  const orden = (c: string) => { const i = CATEGORIAS_SUGERIDAS.findIndex((s) => s.nombre.toLowerCase() === c.toLowerCase()); return i < 0 ? 999 : i; };
  return [...grupos].sort(([a], [b]) => orden(a) - orden(b) || a.localeCompare(b)).map(([categoria, lista]) => ({ categoria, emoji: emojiDeCategoria(categoria), articulos: lista.sort((x, y) => x.titulo.localeCompare(y.titulo)) }));
}
