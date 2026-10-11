// FM RRHH — app/portal/chat/page.tsx
// El chat del empleado: sus grupos, su consulta con RR.HH. y (si la
// empresa lo permite) las charlas con compañeros.
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerSesionPortal } from "@/lib/portal";
import { conversacionesDe } from "@/lib/chat";
import Lista from "./Lista";

export const dynamic = "force-dynamic";

export default async function PortalChat() {
  const sesion = await obtenerSesionPortal();
  if (!sesion) redirect("/portal/login");
  const [conversaciones, empresa] = await Promise.all([
    conversacionesDe(sesion.legajoId),
    prisma.empresa.findUnique({ where: { id: sesion.empresaId }, select: { chatEntreEmpleados: true } }),
  ]);
  const directos = empresa?.chatEntreEmpleados ?? false;
  const companieros = directos ? await prisma.legajo.findMany({ where: { empresaId: sesion.empresaId, condicion: "activo", id: { not: sesion.legajoId } }, select: { id: true, nombre: true, apellido: true, centroCosto: { select: { nombre: true } } }, orderBy: [{ apellido: "asc" }, { nombre: "asc" }] }) : [];
  return (
    <>
      <h1>Chat</h1>
      <Lista inicial={JSON.parse(JSON.stringify(conversaciones))} companieros={companieros.map((c) => ({ id: c.id, nombre: `${c.apellido}, ${c.nombre}`, sector: c.centroCosto?.nombre ?? null }))} />
    </>
  );
}
