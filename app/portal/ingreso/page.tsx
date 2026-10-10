// FM RRHH — app/portal/ingreso/page.tsx
// "Mi ingreso": los pasos de bienvenida de un empleado nuevo. Ve qué tiene
// que hacer él y, para que sepa qué esperar, qué va a hacer la empresa.
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerSesionPortal } from "@/lib/portal";
import { hoyArgentina } from "@/lib/ausencias";
import { ponerAlDia, progreso, RESPONSABLES, type Responsable } from "@/lib/ingresos";
import { fechaPeriodo } from "../formato";
import TildarTarea from "./TildarTarea";

export const dynamic = "force-dynamic";

// A dónde ir para resolver cada tarea que el sistema comprueba solo.
const DONDE: Record<string, { href: string; texto: string }> = {
  pin_propio: { href: "/portal/cambiar-pin", texto: "Elegir mi PIN" },
  legajo_empleado: { href: "/portal/legajo", texto: "Ir a mi legajo" },
};

export default async function PortalIngreso() {
  const sesion = await obtenerSesionPortal();
  if (!sesion) redirect("/portal/login");

  let ingreso = await prisma.ingreso.findFirst({ where: { legajoId: sesion.legajoId, estado: { in: ["en_curso", "completado"] } }, orderBy: { createdAt: "desc" }, select: { id: true } });
  if (!ingreso) {
    return (
      <>
        <h1>Mi ingreso</h1>
        <p className="p-sub">No tenés pasos de ingreso pendientes.</p>
      </>
    );
  }
  await ponerAlDia([ingreso.id]);
  const datos = await prisma.ingreso.findUniqueOrThrow({ where: { id: ingreso.id }, include: { tareas: { orderBy: [{ vence: "asc" }, { orden: "asc" }] }, legajo: { select: { jefe: { select: { nombre: true, apellido: true } } } } } });
  const hoy = hoyArgentina();
  const p = progreso(datos.tareas, hoy);
  const mias = datos.tareas.filter((t) => t.responsable === "empleado");
  const deLaEmpresa = datos.tareas.filter((t) => t.responsable !== "empleado");
  const meFaltan = mias.filter((t) => t.estado === "pendiente").length;

  return (
    <>
      <h1>Te damos la bienvenida, {sesion.nombre.split(" ")[0]}</h1>
      <p className="p-sub">
        Estos son los pasos de tu ingreso{datos.legajo.jefe ? <>. Tu jefe directo es <strong>{datos.legajo.jefe.nombre} {datos.legajo.jefe.apellido}</strong></> : ""}.
      </p>

      <div className="p-card">
        <strong style={{ color: "var(--azul-oscuro)" }}>{datos.estado === "completado" ? "Ingreso completo 🎉" : `Avance: ${p.resueltas} de ${p.total}`}</strong>
        <div style={{ background: "var(--gris-claro)", borderRadius: 999, height: 10, marginTop: "0.5rem", overflow: "hidden" }} role="progressbar" aria-valuenow={p.porcentaje} aria-valuemin={0} aria-valuemax={100}>
          <div style={{ width: `${p.porcentaje}%`, height: "100%", background: "#2F6F5E" }} />
        </div>
      </div>

      <h2>Lo que tenés que hacer vos{meFaltan > 0 ? ` (${meFaltan})` : ""}</h2>
      {mias.length === 0 && <p className="p-sub">Nada por ahora.</p>}
      {mias.map((t) => (
        <div key={t.id} className="p-card">
          <div className="p-card-titulo">{t.estado === "hecha" ? "✅ " : ""}{t.titulo}</div>
          {t.estado === "no_aplica" ? <div className="p-card-dato">RR.HH. indicó que en tu caso no hace falta.</div> : t.detalle && <div className="p-card-dato">{t.detalle}</div>}
          {t.estado === "pendiente" && <div className="p-card-dato">Para el {fechaPeriodo(t.vence)}{t.vence < hoy ? " — está vencida" : ""}</div>}
          {datos.estado === "en_curso" && (t.clave
            ? t.estado === "pendiente" && DONDE[t.clave] && <a href={DONDE[t.clave].href} className="p-btn chico" style={{ display: "inline-block", textDecoration: "none", marginTop: "0.4rem" }}>{DONDE[t.clave].texto} ›</a>
            : t.estado !== "no_aplica" && <div style={{ marginTop: "0.4rem" }}><TildarTarea id={t.id} hecha={t.estado === "hecha"} titulo={t.titulo} /></div>)}
        </div>
      ))}

      <h2>Lo que hace la empresa</h2>
      <div className="p-card" style={{ padding: 0 }}>
        {deLaEmpresa.map((t) => (
          <div key={t.id} style={{ display: "flex", gap: "0.6rem", padding: "0.6rem 0.9rem", borderBottom: "1px solid var(--gris-claro)", opacity: t.estado === "pendiente" ? 1 : 0.6 }}>
            <span aria-hidden="true">{t.estado === "pendiente" ? "⬜" : t.estado === "hecha" ? "✅" : "➖"}</span>
            <span>
              {t.titulo}
              <span style={{ display: "block", fontSize: "0.78rem", color: "#6b727b" }}>{RESPONSABLES[t.responsable as Responsable] ?? t.responsable}{t.estado === "no_aplica" ? " · no aplica" : ""}</span>
            </span>
          </div>
        ))}
      </div>
      <p className="p-pie">Si algo no te queda claro, preguntale a tu jefe o a RR.HH.</p>
    </>
  );
}
