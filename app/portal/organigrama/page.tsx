// FM RRHH — app/portal/organigrama/page.tsx
// El organigrama visto por el empleado: dónde está parado (a quién
// reporta, quiénes dependen de él) y cómo está armada la empresa. Solo
// nombres, puestos y sectores: nada del legajo.
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerSesionPortal } from "@/lib/portal";
import Arbol from "@/app/organigrama/Arbol";
import EnlacesChat from "./EnlacesChat";

export const dynamic = "force-dynamic";

export default async function PortalOrganigrama() {
  const sesion = await obtenerSesionPortal();
  if (!sesion) redirect("/portal/login");
  const [gente, puestos, empresa] = await Promise.all([
    prisma.legajo.findMany({ where: { empresaId: sesion.empresaId, condicion: "activo" }, select: { id: true, nombre: true, apellido: true, jefeId: true, puestoId: true, centroCosto: { select: { nombre: true } } }, orderBy: [{ apellido: "asc" }, { nombre: "asc" }] }),
    prisma.puesto.findMany({ where: { empresaId: sesion.empresaId }, select: { id: true, nombre: true, reportaAId: true, dotacion: true, centroCosto: { select: { nombre: true } } } }),
    prisma.empresa.findUnique({ where: { id: sesion.empresaId }, select: { chatEntreEmpleados: true } }),
  ]);
  const nombre = (l: { nombre: string; apellido: string }) => `${l.nombre} ${l.apellido}`;
  const yo = gente.find((l) => l.id === sesion.legajoId);
  const jefe = yo?.jefeId ? gente.find((l) => l.id === yo.jefeId) : null;
  const aCargo = gente.filter((l) => l.jefeId === sesion.legajoId);
  const miPuesto = yo?.puestoId ? puestos.find((p) => p.id === yo.puestoId) : null;
  const pares = jefe ? gente.filter((l) => l.jefeId === jefe.id && l.id !== sesion.legajoId) : [];
  const conChat = empresa?.chatEntreEmpleados ?? false;
  const persona = (l: { id: string; nombre: string; apellido: string }) => (l.id === sesion.legajoId ? <strong key={l.id}>{nombre(l)} (vos)</strong> : conChat ? <a key={l.id} href={`/portal/chat?con=${l.id}`} title="Escribirle">{nombre(l)}</a> : <span key={l.id}>{nombre(l)}</span>);
  const lista = (ls: typeof gente) => ls.map((l, i) => <span key={l.id}>{i > 0 && ", "}{persona(l)}</span>);

  const arbol = gente.map((l) => ({ id: l.id, nombre: l.nombre, apellido: l.apellido, sector: l.centroCosto?.nombre ?? null, puesto: puestos.find((p) => p.id === l.puestoId)?.nombre ?? null, jefeId: l.jefeId }));

  return (
    <>
      <h1>Organigrama</h1>
      <div className="p-card" style={{ borderColor: "var(--verde)", borderWidth: 2 }}>
        <div className="p-card-titulo">Tu lugar</div>
        {miPuesto && <div className="p-card-dato"><strong>Puesto:</strong> {miPuesto.nombre}</div>}
        {yo?.centroCosto && <div className="p-card-dato"><strong>Sector:</strong> {yo.centroCosto.nombre}</div>}
        <div className="p-card-dato"><strong>Reportás a:</strong> {jefe ? persona(jefe) : <span style={{ color: "#6b727b" }}>no tenés un jefe cargado</span>}</div>
        {pares.length > 0 && <div className="p-card-dato"><strong>Con vos reportan:</strong> {lista(pares)}</div>}
        {aCargo.length > 0 && <div className="p-card-dato"><strong>A tu cargo ({aCargo.length}):</strong> {lista(aCargo)}</div>}
        {conChat && <div className="p-card-dato" style={{ color: "#6b727b", fontSize: "0.8rem", marginTop: "0.3rem" }}>Tocá un nombre para escribirle.</div>}
      </div>

      <h2>La empresa</h2>
      {gente.some((l) => l.jefeId) ? <EnlacesChat personas={arbol} yoId={sesion.legajoId} conChat={conChat} /> : <p className="p-sub">La empresa todavía no cargó quién reporta a quién.</p>}
    </>
  );
}
