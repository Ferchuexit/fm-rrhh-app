// FM RRHH — app/portal/organigrama/page.tsx
// El organigrama visto por el empleado: dónde está parado (a quién
// reporta, quiénes dependen de él) y cómo está armada la empresa. Solo
// nombres, puestos y sectores: nada del legajo.
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerSesionPortal } from "@/lib/portal";
import { organigrama } from "@/lib/reclutamiento-reglas";
import { arbolPersonas } from "@/lib/organigrama-reglas";

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

  // Si la empresa cargó puestos, el árbol es de puestos (con quién ocupa
  // cada uno). Si no, de personas: quién reporta a quién.
  const filasPuestos = organigrama(puestos.map((p) => ({ ...p, ocupantes: gente.filter((l) => l.puestoId === p.id).length })));
  const conPuestos = puestos.length > 0 && gente.some((l) => l.puestoId);
  const { arbol, sueltos } = arbolPersonas(gente.map((l) => ({ ...l, nombre: `${l.apellido}, ${l.nombre}` })));
  const sangria = (nivel: number) => ({ marginLeft: `${Math.min(nivel, 6) * 1.1}rem`, borderLeft: nivel > 0 ? "2px solid #c3d0da" : undefined, paddingLeft: nivel > 0 ? "0.6rem" : 0 });

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
      {conPuestos ? (
        <div className="p-card">
          {filasPuestos.map(({ puesto: p, nivel }) => {
            const ocupan = gente.filter((l) => l.puestoId === p.id);
            return (
              <div key={p.id} style={{ ...sangria(nivel), padding: "0.35rem 0 0.35rem", marginBottom: 2 }}>
                <div style={{ fontWeight: 700, color: "var(--azul-oscuro)", background: p.id === miPuesto?.id ? "#e3f1ec" : undefined, display: "inline-block", padding: p.id === miPuesto?.id ? "0 0.3rem" : 0, borderRadius: 4 }}>{p.nombre}{p.centroCosto && <span style={{ fontWeight: 400, color: "#6b727b", fontSize: "0.8rem" }}> · {p.centroCosto.nombre}</span>}</div>
                <div style={{ fontSize: "0.88rem" }}>{ocupan.length ? lista(ocupan) : <span style={{ color: "#8a5413" }}>Vacante</span>}</div>
              </div>
            );
          })}
          {gente.some((l) => !l.puestoId) && <div style={{ marginTop: "0.6rem", fontSize: "0.85rem", color: "#6b727b" }}>Sin puesto asignado: {lista(gente.filter((l) => !l.puestoId))}</div>}
        </div>
      ) : arbol.length > 0 ? (
        <div className="p-card">
          {arbol.map(({ persona: p, nivel, aCargo: n }) => (
            <div key={p.id} style={{ ...sangria(nivel), padding: "0.25rem 0" }}>
              <span style={p.id === sesion.legajoId ? { background: "#e3f1ec", padding: "0 0.3rem", borderRadius: 4 } : undefined}>{persona(gente.find((l) => l.id === p.id)!)}</span>
              <span style={{ color: "#6b727b", fontSize: "0.8rem" }}>{p.centroCosto && ` · ${p.centroCosto.nombre}`}{n > 0 && ` · ${n} a cargo`}</span>
            </div>
          ))}
          {sueltos.length > 0 && <div style={{ marginTop: "0.6rem", fontSize: "0.85rem", color: "#6b727b" }}>Sin jefe cargado: {lista(sueltos.map((s) => gente.find((l) => l.id === s.id)!))}</div>}
        </div>
      ) : <p className="p-sub">La empresa todavía no cargó quién reporta a quién.</p>}
    </>
  );
}
