// FM RRHH — prisma/toggle-fichada-obligatoria.ts
//
// Para los casos que NO son la lista fija de obra (marcar-legajos-obra.ts):
// operarios de planta que ocasionalmente van a una obra "con previo aviso"
// a RR.HH. Prende o apaga fichadaObligatoria para UN legajo puntual.
//
// Uso:
//   npx tsx prisma/toggle-fichada-obligatoria.ts <numeroLegajo> <true|false>
//
// Ejemplo — legajo 15 va a una obra esta semana, no va a fichar:
//   npx tsx prisma/toggle-fichada-obligatoria.ts 15 false
//
// Cuando vuelve a planta, acordarse de volver a poner true:
//   npx tsx prisma/toggle-fichada-obligatoria.ts 15 true
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const [numeroLegajoStr, valorStr] = process.argv.slice(2);
  if (!numeroLegajoStr || (valorStr !== "true" && valorStr !== "false")) {
    console.error("Uso: npx tsx prisma/toggle-fichada-obligatoria.ts <numeroLegajo> <true|false>");
    process.exit(1);
  }

  const numeroLegajo = parseInt(numeroLegajoStr, 10);
  const fichadaObligatoria = valorStr === "true";

  const legajo = await prisma.legajo.findFirst({ where: { numeroLegajo } });
  if (!legajo) {
    console.error(`No se encontró ningún legajo con numeroLegajo = ${numeroLegajo}.`);
    process.exit(1);
  }

  await prisma.legajo.update({ where: { id: legajo.id }, data: { fichadaObligatoria } });

  console.log(
    `Legajo ${numeroLegajo} (${legajo.apellido}, ${legajo.nombre}): fichadaObligatoria = ${fichadaObligatoria}.`
  );
  console.log(
    fichadaObligatoria
      ? "Vuelve a contar como planta — si no ficha, se va a marcar 'A' (ausente) de nuevo."
      : "Marcado como obra temporalmente — si no ficha, va a salir 'SIN_CONTROL', no 'A'. No te olvides de volver a poner esto en true cuando vuelva a planta."
  );
}

main()
  .catch((e) => { console.error("Error:", e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
