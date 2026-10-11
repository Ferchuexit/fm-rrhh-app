// FM RRHH — lib/importar-legajos-reglas.ts
// Carga de legajos desde una planilla de Excel. Acá se analiza cada fila
// (sin tocar la base) para mostrar ANTES de guardar qué se va a crear, qué
// se va a actualizar y qué está mal. Funciones puras
// (tests/importar-legajos-reglas.test.mjs).
//
// Dos usos con la misma planilla:
//   - una fila con un CUIL que NO existe  → se crea el legajo;
//   - una fila con un CUIL que ya existe  → se actualiza SOLO su lugar en
//     la estructura (sector, puesto, jefe). Nunca pisa datos de liquidación.

export const MAX_FILAS = 500;

export interface Columna { clave: string; titulo: string; obligatoria: boolean; ejemplo: string; ayuda: string; alias: string[] }
export const COLUMNAS: Columna[] = [
  { clave: "numeroLegajo", titulo: "Legajo", obligatoria: false, ejemplo: "25", ayuda: "Número de legajo. Vacío = el siguiente libre.", alias: ["legajo", "nro", "nrolegajo", "numero", "numerolegajo", "numerodelegajo", "n"] },
  { clave: "apellido", titulo: "Apellido", obligatoria: true, ejemplo: "Gómez", ayuda: "", alias: ["apellido", "apellidos"] },
  { clave: "nombre", titulo: "Nombre", obligatoria: true, ejemplo: "María Laura", ayuda: "", alias: ["nombre", "nombres"] },
  { clave: "cuil", titulo: "CUIL", obligatoria: true, ejemplo: "27-30123456-4", ayuda: "Con o sin guiones. Es lo que identifica a la persona.", alias: ["cuil", "cuit", "cuilcuit"] },
  { clave: "fechaIngreso", titulo: "Fecha de ingreso", obligatoria: true, ejemplo: "15/03/2022", ayuda: "día/mes/año", alias: ["fechadeingreso", "fechaingreso", "ingreso", "fechaalta", "alta"] },
  { clave: "convenio", titulo: "Convenio", obligatoria: false, ejemplo: "", ayuda: "Código o nombre, como figura en la hoja Referencias. Vacío = el que ya usa la empresa (si es uno solo).", alias: ["convenio", "cct"] },
  { clave: "categoria", titulo: "Categoría", obligatoria: true, ejemplo: "Oficial", ayuda: "Como figura en la hoja Referencias.", alias: ["categoria", "categoriadeconvenio"] },
  { clave: "sector", titulo: "Sector", obligatoria: false, ejemplo: "Taller", ayuda: "Si no existe, se crea.", alias: ["sector", "area", "centrodecosto", "departamento"] },
  { clave: "puesto", titulo: "Puesto", obligatoria: false, ejemplo: "Operario de seccionadora", ayuda: "Si no existe, se crea.", alias: ["puesto", "cargo", "funcion", "posicion"] },
  { clave: "jefe", titulo: "Reporta a (legajo o CUIL)", obligatoria: false, ejemplo: "4", ayuda: "El número de legajo o el CUIL de su jefe: puede ser alguien de esta misma planilla.", alias: ["reportaa", "reportaalegajoocuil", "jefe", "jefedirecto", "superior", "legajojefe", "jefelegajo"] },
  { clave: "fechaNacimiento", titulo: "Fecha de nacimiento", obligatoria: false, ejemplo: "02/11/1990", ayuda: "día/mes/año. Para los cumpleaños.", alias: ["fechadenacimiento", "fechanacimiento", "nacimiento"] },
  { clave: "email", titulo: "Mail", obligatoria: false, ejemplo: "maria@correo.com", ayuda: "", alias: ["mail", "email", "correo", "correoelectronico"] },
  { clave: "telefono", titulo: "Teléfono", obligatoria: false, ejemplo: "11 5555-1234", ayuda: "", alias: ["telefono", "celular", "tel"] },
  { clave: "domicilio", titulo: "Domicilio", obligatoria: false, ejemplo: "San Martín 1200", ayuda: "", alias: ["domicilio", "direccion", "calle"] },
  { clave: "localidad", titulo: "Localidad", obligatoria: false, ejemplo: "Tigre", ayuda: "", alias: ["localidad", "ciudad"] },
  { clave: "provincia", titulo: "Provincia", obligatoria: false, ejemplo: "Buenos Aires", ayuda: "", alias: ["provincia"] },
];

// Sin tildes, sin mayúsculas, sin espacios ni signos: "N° Legajo" → "nlegajo".
export const plano = (v: unknown) => String(v ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
// De qué columna es un encabezado de la planilla (o null si no se reconoce).
export function columnaDe(encabezado: unknown): string | null {
  const p = plano(String(encabezado ?? "").replace(/\(.*?\)/g, "")) || plano(encabezado);
  return COLUMNAS.find((c) => plano(c.titulo.replace(/\(.*?\)/g, "")) === p || c.alias.includes(p))?.clave ?? null;
}

// CUIL válido: 11 dígitos y el dígito verificador correcto.
export function cuilLimpio(v: unknown): string | null {
  const d = String(v ?? "").replace(/\D/g, "");
  if (d.length !== 11) return null;
  const suma = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2].reduce((a, peso, i) => a + peso * Number(d[i]), 0);
  const resto = 11 - (suma % 11);
  const verificador = resto === 11 ? 0 : resto === 10 ? 9 : resto;
  return verificador === Number(d[10]) ? d : null;
}
export const cuilConGuiones = (d: string) => `${d.slice(0, 2)}-${d.slice(2, 10)}-${d.slice(10)}`;

// Una fecha de la planilla: texto día/mes/año (o año-mes-día), una fecha
// de Excel, o el número de serie de Excel. Devuelve el día en UTC, o null.
export function fechaDe(v: unknown): Date | null {
  if (v === null || v === undefined || v === "") return null;
  const valida = (a: number, m: number, d: number) => { const f = new Date(Date.UTC(a, m - 1, d)); return f.getUTCFullYear() === a && f.getUTCMonth() === m - 1 && f.getUTCDate() === d && a >= 1930 && a <= 2100 ? f : null; };
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : valida(v.getUTCFullYear(), v.getUTCMonth() + 1, v.getUTCDate());
  if (typeof v === "number") { const f = new Date(Math.round((v - 25569) * 86400000)); return valida(f.getUTCFullYear(), f.getUTCMonth() + 1, f.getUTCDate()); }
  const t = String(v).trim();
  let m = t.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (m) return valida(Number(m[3]), Number(m[2]), Number(m[1]));
  m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return valida(Number(m[1]), Number(m[2]), Number(m[3]));
  return null;
}

export interface Contexto {
  convenios: { id: string; codigo: string; nombre: string; categorias: { id: string; codigo: string; nombre: string }[] }[];
  convenioPorDefecto: string | null; // el id, si la empresa usa uno solo
  sectores: { id: string; nombre: string }[];
  puestos: { id: string; nombre: string }[];
  existentes: { id: string; numeroLegajo: number; cuil: string; jefeId: string | null; activo: boolean }[];
  hoy: Date;
}
export interface FilaAnalizada {
  fila: number; // el renglón de la planilla (2 = el primero con datos)
  accion: "crear" | "actualizar" | "error";
  errores: string[]; avisos: string[];
  ref: string; // cómo se nombra a esta persona dentro del análisis: "cuil:<cuil>"
  datos: { numeroLegajo: number | null; apellido: string; nombre: string; cuil: string; fechaIngreso: Date | null; convenioId: string | null; categoriaId: string | null; sector: string | null; puesto: string | null; fechaNacimiento: Date | null; email: string | null; telefono: string | null; domicilio: string | null; localidad: string | null; provincia: string | null };
  existenteId: string | null;
  jefeRef: string | null; // "id:<legajo existente>" o "cuil:<de esta planilla>"
  jefeTexto: string | null;
}
const txt = (v: unknown, max: number) => String(v ?? "").trim().replace(/\s+/g, " ").slice(0, max) || null;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/;

export function analizar(crudas: Record<string, unknown>[], c: Contexto) {
  const porCuil = new Map(c.existentes.map((e) => [e.cuil.replace(/\D/g, ""), e]));
  const porNumero = new Map(c.existentes.map((e) => [e.numeroLegajo, e]));
  const filas: FilaAnalizada[] = crudas.map((r, i) => {
    const errores: string[] = [], avisos: string[] = [];
    const cuil = cuilLimpio(r.cuil);
    if (!String(r.cuil ?? "").trim()) errores.push("Falta el CUIL."); else if (!cuil) errores.push("El CUIL no es válido (tiene que tener 11 dígitos y el verificador correcto).");
    const existente = cuil ? porCuil.get(cuil) ?? null : null;
    const apellido = txt(r.apellido, 60) ?? "", nombre = txt(r.nombre, 60) ?? "";
    const numeroTxt = String(r.numeroLegajo ?? "").trim();
    const numero = numeroTxt ? Number(numeroTxt) : null;
    if (numero !== null && (!Number.isInteger(numero) || numero < 1 || numero > 999999)) errores.push("El número de legajo tiene que ser un número entero.");
    let convenioId: string | null = null, categoriaId: string | null = null;
    let fechaIngreso: Date | null = null, fechaNacimiento: Date | null = null;

    if (existente) {
      // Ya está cargado: solo se le acomoda la estructura.
      if (!existente.activo) errores.push("Ese CUIL es de un legajo dado de baja: no se modifica desde acá.");
      if (numero !== null && Number.isInteger(numero) && numero !== existente.numeroLegajo) avisos.push(`Ya existe con el legajo ${existente.numeroLegajo}: el número de la planilla se ignora.`);
    } else {
      if (apellido.length < 2) errores.push("Falta el apellido.");
      if (nombre.length < 2) errores.push("Falta el nombre.");
      fechaIngreso = fechaDe(r.fechaIngreso);
      if (!String(r.fechaIngreso ?? "").trim()) errores.push("Falta la fecha de ingreso."); else if (!fechaIngreso) errores.push("No se entiende la fecha de ingreso (usá día/mes/año, por ejemplo 15/03/2022).");
      else if (fechaIngreso.getTime() > c.hoy.getTime() + 60 * 86400000) errores.push("La fecha de ingreso es de más de dos meses a futuro: revisá el año.");
      const conv = plano(r.convenio);
      const convenio = conv ? c.convenios.find((x) => plano(x.codigo) === conv || plano(x.nombre) === conv) ?? c.convenios.find((x) => plano(x.nombre).includes(conv)) : c.convenios.find((x) => x.id === c.convenioPorDefecto);
      if (!convenio) errores.push(conv ? `No se encontró el convenio "${String(r.convenio).trim()}" (mirá la hoja Referencias).` : "Falta el convenio (la empresa usa más de uno, o todavía ninguno).");
      else {
        convenioId = convenio.id;
        const cat = plano(r.categoria);
        const categoria = cat ? convenio.categorias.find((x) => plano(x.nombre) === cat || plano(x.codigo) === cat) : null;
        if (!cat) errores.push("Falta la categoría."); else if (!categoria) errores.push(`La categoría "${String(r.categoria).trim()}" no existe en ese convenio (mirá la hoja Referencias).`);
        else categoriaId = categoria.id;
      }
      if (numero !== null && porNumero.has(numero)) errores.push(`El legajo ${numero} ya lo tiene otra persona.`);
      if (String(r.fechaNacimiento ?? "").trim()) { fechaNacimiento = fechaDe(r.fechaNacimiento); if (!fechaNacimiento) errores.push("No se entiende la fecha de nacimiento (usá día/mes/año)."); else if (fechaNacimiento > c.hoy) errores.push("La fecha de nacimiento es a futuro."); }
    }
    const email = txt(r.email, 120)?.toLowerCase() ?? null;
    if (email && !EMAIL.test(email)) errores.push("El mail no parece una dirección válida.");
    return {
      fila: i + 2, accion: "crear" as const, errores, avisos, ref: cuil ? `cuil:${cuil}` : `fila:${i}`,
      datos: { numeroLegajo: existente ? existente.numeroLegajo : numero, apellido, nombre, cuil: cuil ?? "", fechaIngreso, convenioId, categoriaId, sector: txt(r.sector, 60), puesto: txt(r.puesto, 80), fechaNacimiento, email, telefono: txt(r.telefono, 40), domicilio: txt(r.domicilio, 120), localidad: txt(r.localidad, 80), provincia: txt(r.provincia, 60) },
      existenteId: existente?.id ?? null, jefeRef: null, jefeTexto: txt(r.jefe, 30),
    };
  });

  // Repetidos dentro de la planilla.
  const veces = <T,>(valores: T[]) => valores.reduce((m, v) => m.set(v, (m.get(v) ?? 0) + 1), new Map<T, number>());
  const cuils = veces(filas.map((f) => f.datos.cuil).filter(Boolean));
  const nuevas = filas.filter((f) => !f.existenteId);
  const numeros = veces(nuevas.map((f) => f.datos.numeroLegajo).filter((n): n is number => n !== null));
  for (const f of filas) {
    if (f.datos.cuil && cuils.get(f.datos.cuil)! > 1) f.errores.push("Ese CUIL está repetido en la planilla.");
    if (!f.existenteId && f.datos.numeroLegajo !== null && numeros.get(f.datos.numeroLegajo)! > 1) f.errores.push(`El legajo ${f.datos.numeroLegajo} está repetido en la planilla.`);
  }
  // Los que no traen número reciben el siguiente libre, en el orden de la planilla.
  let proximo = Math.max(0, ...c.existentes.map((e) => e.numeroLegajo), ...nuevas.map((f) => f.datos.numeroLegajo ?? 0)) + 1;
  for (const f of nuevas) if (f.datos.numeroLegajo === null) f.datos.numeroLegajo = proximo++;

  // El jefe: por número de legajo o por CUIL; de la base o de la planilla.
  const filaPorNumero = new Map(nuevas.map((f) => [f.datos.numeroLegajo!, f]));
  const filaPorCuil = new Map(filas.filter((f) => f.datos.cuil).map((f) => [f.datos.cuil, f]));
  for (const f of filas) {
    if (!f.jefeTexto) continue;
    const digitos = f.jefeTexto.replace(/\D/g, "");
    const comoCuil = digitos.length === 11 ? digitos : null;
    const enBase = comoCuil ? porCuil.get(comoCuil) : /^\d+$/.test(f.jefeTexto) ? porNumero.get(Number(f.jefeTexto)) : undefined;
    const enPlanilla = comoCuil ? filaPorCuil.get(comoCuil) : /^\d+$/.test(f.jefeTexto) ? filaPorNumero.get(Number(f.jefeTexto)) : undefined;
    if (enBase) { if (!enBase.activo) f.errores.push(`El jefe indicado (${f.jefeTexto}) está dado de baja.`); else f.jefeRef = `id:${enBase.id}`; }
    else if (enPlanilla) f.jefeRef = enPlanilla.ref;
    else f.errores.push(`No se encontró al jefe "${f.jefeTexto}": poné su número de legajo o su CUIL (puede ser alguien de esta planilla).`);
    if (f.jefeRef && (f.jefeRef === f.ref || (f.existenteId && f.jefeRef === `id:${f.existenteId}`))) { f.errores.push("Una persona no puede reportarse a sí misma."); f.jefeRef = null; }
  }

  // Círculos: con la estructura como quedaría (la de hoy + los cambios).
  const clave = (f: FilaAnalizada) => (f.existenteId ? `id:${f.existenteId}` : f.ref);
  const jefeDe = new Map<string, string | null>(c.existentes.map((e) => [`id:${e.id}`, e.jefeId ? `id:${e.jefeId}` : null]));
  const refAClave = new Map(filas.map((f) => [f.ref, clave(f)]));
  for (const f of filas) if (f.jefeRef) jefeDe.set(clave(f), refAClave.get(f.jefeRef) ?? f.jefeRef); else if (!f.existenteId) jefeDe.set(clave(f), null);
  for (const f of filas) {
    if (!f.jefeRef) continue;
    const vistos = new Set<string>([clave(f)]);
    for (let a = jefeDe.get(clave(f)) ?? null; a; a = jefeDe.get(a) ?? null) { if (vistos.has(a)) { f.errores.push("Con ese jefe queda un círculo: alguien terminaría reportándose a sí mismo."); break; } vistos.add(a); }
  }

  for (const f of filas) f.accion = f.errores.length ? "error" : f.existenteId ? "actualizar" : "crear";
  // Una fila de alguien que ya existe y no trae sector, puesto ni jefe no cambia nada.
  for (const f of filas) if (f.accion === "actualizar" && !f.datos.sector && !f.datos.puesto && !f.jefeRef) f.avisos.push("Ya existe y la fila no trae sector, puesto ni jefe: no cambia nada.");

  const buenas = filas.filter((f) => f.accion !== "error");
  const faltan = (nombres: (string | null)[], hay: { nombre: string }[]) => [...new Map(nombres.filter((n): n is string => !!n && !hay.some((h) => plano(h.nombre) === plano(n))).map((n) => [plano(n), n])).values()];
  return {
    filas,
    crearSectores: faltan(buenas.map((f) => f.datos.sector), c.sectores),
    crearPuestos: faltan(buenas.map((f) => f.datos.puesto), c.puestos),
    resumen: { total: filas.length, crear: filas.filter((f) => f.accion === "crear").length, actualizar: filas.filter((f) => f.accion === "actualizar").length, errores: filas.filter((f) => f.accion === "error").length },
  };
}
