// FM RRHH — prisma/asignar-rubro-deducciones.ts
// Le pone un "rubro" a las deducciones del empleado que ya existían —
// necesario para que la torta del recibo las agrupe junto con la
// contribución PATRONAL equivalente (Jubilación que se le retiene al
// empleado + Jubilación que aporta la empresa = misma porción "Seguridad
// Social", no dos cosas separadas). Sin esto, la torta no suma el costo
// laboral total completo — queda un espacio en blanco sin dibujar (ver
// 58-torta-completa.md).
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const RUBRO_POR_CODIGO: Record<string, string> = {
  JUBILACION: "seguridad_social",
  LEY_19032: "seguridad_social",
  OBRA_SOCIAL: "obra_social",
  SINDICATO: "sindical",
  SEGURO_SEPELIO: "otros",
};

async function main() {
  for (const [codigo, rubro] of Object.entries(RUBRO_POR_CODIGO)) {
    const concepto = await prisma.concepto.findUnique({ where: { codigo } });
    if (!concepto) { console.log(`⚠ "${codigo}" no existe — se salta.`); continue; }
    if ((concepto as any).rubro === rubro) { console.log(`"${codigo}" ya tenía el rubro "${rubro}" — sin cambios.`); continue; }
    await prisma.concepto.update({ where: { id: concepto.id }, data: { rubro } });
    console.log(`✔ "${codigo}" → rubro "${rubro}"`);
  }
  console.log("\nListo. Volvé a liquidar y descargá un recibo — la torta ya debería sumar el 100% del costo laboral total.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
