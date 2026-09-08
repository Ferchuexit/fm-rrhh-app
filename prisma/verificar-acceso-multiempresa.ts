// FM RRHH — prisma/verificar-acceso-multiempresa.ts
//
// Con el cambio de seguridad multiempresa, los usuarios 'admin' (como
// Fernando) siguen viendo TODAS las empresas automáticamente — no hace
// falta cargar nada para ellos. Este script es solo para CONFIRMAR ese
// estado, y para dejar un ejemplo de cómo asignarle una empresa puntual a
// un usuario NO admin (el día que exista uno).
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const usuarios = await prisma.usuario.findMany({ include: { empresas: { include: { empresa: true } } } });
  const empresas = await prisma.empresa.findMany();

  console.log(`Hay ${empresas.length} empresa(s) cargada(s): ${empresas.map((e) => e.nombreFantasia || e.razonSocial).join(", ")}\n`);

  for (const u of usuarios) {
    if (u.rol === "admin") {
      console.log(`✔ ${u.email} (admin) — ve TODAS las empresas automáticamente, no necesita nada en UsuarioEmpresa.`);
    } else {
      const nombres = u.empresas.map((ue) => ue.empresa.nombreFantasia || ue.empresa.razonSocial);
      console.log(`${u.email} (${u.rol}) — puede ver: ${nombres.length > 0 ? nombres.join(", ") : "NINGUNA todavía (asignale desde /usuarios)"}`);
    }
  }
}

main()
  .catch((e) => { console.error("Error:", e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
