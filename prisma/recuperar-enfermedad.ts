// FM RRHH — prisma/recuperar-enfermedad.ts
// Recupera del estado roto: "ENFERMEDADES" se borró, pero Antigüedad,
// Presentismo, S.N.R. y Ajuste SAC todavía la referencian por nombre en
// su fórmula. Mientras tanto se creó "ENFERMEDAD" (con código ARCA 16 ya
// confirmado) pero sin conectar a ninguna fórmula, y con un signo negativo
// de más (copiado por error de Hs. Ausencias).
//
// La solución: renombrar "ENFERMEDAD" -> "ENFERMEDADES" (recupera el
// nombre que las fórmulas ya esperan, sin tener que tocar 4 fórmulas a
// mano), corregir su signo (tiene que sumar, no restar), y asignarle el
// código ARCA 16.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const enfermedad = await prisma.concepto.findUnique({ where: { codigo: "ENFERMEDAD" } });
  if (!enfermedad) { console.log('No se encontró "ENFERMEDAD" — nada para recuperar.'); return; }

  const yaExisteEnfermedades = await prisma.concepto.findUnique({ where: { codigo: "ENFERMEDADES" } });
  if (yaExisteEnfermedades) { console.log('"ENFERMEDADES" ya existe de nuevo — revisá a mano, esto no debería pasar.'); return; }

  await prisma.concepto.update({
    where: { id: enfermedad.id },
    data: { codigo: "ENFERMEDADES", codigoArca: "16" },
  });
  console.log('✔ "ENFERMEDAD" renombrado a "ENFERMEDADES" (recupera lo que las fórmulas esperaban) — código ARCA 16 asignado.');

  // Corregir el signo — Enfermedad se PAGA (suma), no se resta como Ausencias
  const regla = await prisma.reglaConcepto.findFirst({ where: { conceptoId: enfermedad.id, vigenciaHasta: null } });
  if (regla && regla.formula.trim().startsWith("-")) {
    const formulaCorregida = regla.formula.replace(/^-\s*/, "");
    await prisma.reglaConcepto.update({ where: { id: regla.id }, data: { formula: formulaCorregida } });
    console.log(`✔ Fórmula corregida (tenía un signo negativo de más, copiado de Ausencias): "${regla.formula}" → "${formulaCorregida}"`);
  }

  // HS_ACCIDENTE — no se renombró todavía a HS_ART (vuelta 69 nunca se
  // corrió), pero para desbloquear el LSD alcanza con el código ARCA —
  // el nombre en sí no le importa a nadie más que a vos.
  const hsAccidente = await prisma.concepto.findUnique({ where: { codigo: "HS_ACCIDENTE" } });
  if (hsAccidente) {
    await prisma.concepto.update({ where: { id: hsAccidente.id }, data: { codigoArca: "110008" } });
    console.log('✔ "HS_ACCIDENTE" — código ARCA 110008 asignado (Prestación Dineraria Ley 24.557, provisorio — confirmalo).');
  }

  console.log("\n⚠️ Volvé a liquidar la 1ra. Quincena de Julio (Madera) para confirmar que el motor ya no tira error.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
