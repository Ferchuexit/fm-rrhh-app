// FM RRHH — prisma/importar-fichadas.ts
//
// Importa el archivo que exporta el reloj biométrico. Se armó mirando la
// estructura real de tu hoja "Fichadas" (Indicador_Ausentismo_2026.xlsx):
//
//   Leg. | Apellido y Nombre | Fecha | Hora | DIA
//
// Una fila = una marca de reloj (no distingue ingreso/egreso — eso lo
// resuelve después el motor de clasificación, por orden y cantidad).
//
// Uso:
//   npx tsx prisma/importar-fichadas.ts <ruta-al-archivo.xlsx>
//
// No destructivo: si una fichada con el mismo legajo+fecha+hora ya existe,
// se salta (no duplica). Podés correr esto cada vez que el reloj te dé un
// export nuevo, aunque se solape con el anterior.
import { PrismaClient } from "@prisma/client";
import * as XLSX from "xlsx";

const prisma = new PrismaClient();

function normalizarHora(valor: unknown): string | null {
  // El reloj puede exportar la hora como texto "06:39:18" o como fracción
  // de día (formato interno de Excel para celdas de tipo Hora). Cubrimos
  // los dos casos.
  if (valor instanceof Date) {
    return valor.toISOString().substring(11, 19); // "HH:mm:ss"
  }
  if (typeof valor === "number") {
    const totalSegundos = Math.round(valor * 86400);
    const h = Math.floor(totalSegundos / 3600) % 24;
    const m = Math.floor((totalSegundos % 3600) / 60);
    const s = totalSegundos % 60;
    return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
  }
  if (typeof valor === "string") {
    const m = valor.match(/^(\d{1,2}):(\d{2})(:(\d{2}))?/);
    if (!m) return null;
    const h = m[1].padStart(2, "0");
    const min = m[2];
    const s = m[4] ?? "00";
    return `${h}:${min}:${s}`;
  }
  return null;
}

// A DIFERENCIA de la hora, la fecha NO acepta cualquier texto — a propósito.
// "1/7/2026" es AMBIGUO: puede ser 1 de julio o 7 de enero según quién lo
// lea, y adivinar mal en silencio ya causó un problema real (fichadas de
// julio que terminaron guardadas como enero). Mejor rechazar la fila y
// avisar, que es lo que pediste — no inventar una interpretación.
//
// Formatos ACEPTADOS:
//   - Date real de Excel (celda con formato Fecha) — sin ambigüedad posible.
//   - Texto en formato ISO "YYYY-MM-DD" (ej. "2026-07-01") — tampoco ambiguo.
// Formatos RECHAZADOS (con motivo en el error):
//   - Texto tipo "1/7/2026" o "01/07/2026" — DD/MM vs MM/DD, ambiguo.
function normalizarFecha(valor: unknown): { fecha: Date | null; error: string | null } {
  if (valor instanceof Date) {
    return { fecha: new Date(Date.UTC(valor.getFullYear(), valor.getMonth(), valor.getDate())), error: null };
  }
  if (typeof valor === "string") {
    const iso = valor.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (iso) {
      const [, y, mo, d] = iso;
      return { fecha: new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d))), error: null };
    }
    const ambigua = valor.trim().match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (ambigua) {
      return {
        fecha: null,
        error: `Fecha ambigua "${valor}" — no sé si es día/mes o mes/día. Formateá la columna Fecha como Fecha real en Excel, o escribila como texto "YYYY-MM-DD" (ej. 2026-07-01).`,
      };
    }
    return { fecha: null, error: `Formato de fecha no reconocido: "${valor}".` };
  }
  return { fecha: null, error: "Celda de fecha vacía o de un tipo no reconocido." };
}

async function main() {
  const ruta = process.argv[2];
  if (!ruta) {
    console.error("Uso: npx tsx prisma/importar-fichadas.ts <ruta-al-archivo.xlsx>");
    process.exit(1);
  }

  const wb = XLSX.readFile(ruta, { cellDates: true });
  // Toma la primera hoja por defecto — si tu archivo tiene varias, avisame
  // y le agregamos un parámetro para elegir cuál.
  const hoja = wb.Sheets[wb.SheetNames[0]];
  const filas: any[] = XLSX.utils.sheet_to_json(hoja, { defval: null });

  console.log(`Hoja "${wb.SheetNames[0]}": ${filas.length} filas encontradas.`);

  // Cachear legajos por número, para no consultar la base fila por fila.
  const legajos = await prisma.legajo.findMany({ select: { id: true, numeroLegajo: true } });
  const legajoPorNumero = new Map(legajos.map((l) => [l.numeroLegajo, l.id]));

  let creadas = 0, saltadas = 0, sinLegajo = 0;
  const legajosNoEncontrados = new Set<number>();
  const erroresFecha: { fila: number; numeroLegajo: unknown; error: string }[] = [];
  const erroresOtros: number[] = [];
  let fechaMin: Date | null = null;
  let fechaMax: Date | null = null;

  for (let i = 0; i < filas.length; i++) {
    const fila = filas[i];
    // Nombres de columna flexibles — algunos exports del reloj podrían variar mayúsculas/acentos.
    const numeroLegajo = Number(fila["Leg."] ?? fila["Legajo"] ?? fila["LEG"] ?? fila["leg"]);
    const { fecha, error: errorFecha } = normalizarFecha(fila["Fecha"] ?? fila["FECHA"]);
    const hora = normalizarHora(fila["Hora"] ?? fila["HORA"]);

    if (errorFecha) {
      erroresFecha.push({ fila: i + 2, numeroLegajo: fila["Leg."] ?? fila["Legajo"] ?? "?", error: errorFecha });
      continue;
    }
    if (!numeroLegajo || !fecha || !hora) {
      erroresOtros.push(i + 2);
      continue;
    }

    if (!fechaMin || fecha < fechaMin) fechaMin = fecha;
    if (!fechaMax || fecha > fechaMax) fechaMax = fecha;

    const legajoId = legajoPorNumero.get(numeroLegajo);
    if (!legajoId) {
      legajosNoEncontrados.add(numeroLegajo);
      sinLegajo++;
      continue;
    }

    const yaExiste = await prisma.fichada.findFirst({ where: { legajoId, fecha, hora } });
    if (yaExiste) { saltadas++; continue; }

    await prisma.fichada.create({ data: { legajoId, fecha, hora, origen: "reloj" } });
    creadas++;
  }

  console.log(`\nListo. Fichadas creadas: ${creadas}. Ya existían (saltadas): ${saltadas}.`);

  // Este resumen es la parte más importante para detectar un problema de
  // formato SIN tener que ir a mirar la base — si esperabas julio y acá
  // dice enero, algo se interpretó mal en el archivo, no en el import.
  if (fechaMin && fechaMax) {
    console.log(`\n📅 Rango de fechas detectado en el archivo: ${fechaMin.toISOString().substring(0, 10)} a ${fechaMax.toISOString().substring(0, 10)}.`);
    console.log(`   Si esperabas otro mes, revisá el formato de la columna Fecha en el Excel antes de seguir.`);
  }

  if (erroresFecha.length > 0) {
    console.log(`\n⚠ ${erroresFecha.length} fila(s) con fecha rechazada por ambigua o inválida — NO se importaron:`);
    for (const e of erroresFecha.slice(0, 15)) {
      console.log(`   Fila ${e.fila} (legajo ${e.numeroLegajo}): ${e.error}`);
    }
    if (erroresFecha.length > 15) console.log(`   ...y ${erroresFecha.length - 15} más.`);
  }
  if (erroresOtros.length > 0) {
    console.log(`⚠ Filas con legajo/hora incompletos (más allá de la fecha): ${erroresOtros.length} — filas ${erroresOtros.slice(0, 20).join(", ")}${erroresOtros.length > 20 ? "..." : ""}.`);
  }
  if (sinLegajo > 0) {
    console.log(`⚠ Fichadas sin legajo correspondiente en la base: ${sinLegajo}.`);
    console.log(`  Números de legajo no encontrados: ${[...legajosNoEncontrados].sort((a, b) => a - b).join(", ")}`);
  }
}

main()
  .catch((e) => { console.error("Error:", e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
