// FM RRHH — app/portal/muro/page.tsx
// El muro: quién festeja hoy y en los próximos días, y los reconocimientos
// entre compañeros. Desde acá se reconoce a alguien.
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerSesionPortal } from "@/lib/portal";
import { hoyArgentina } from "@/lib/ausencias";
import { valoresDe, personasConFechas, celebraciones, textoCelebracion, inicioDelMes, MAX_RECONOCIMIENTOS_POR_MES } from "@/lib/cultura";
import { fechaPeriodo } from "../formato";
import Reconocer from "./Reconocer";
import Aplauso from "./Aplauso";
import PreferenciaCumple from "./PreferenciaCumple";

export const dynamic = "force-dynamic";
// Un reconocimiento tiene hora: el día se muestra en hora argentina (a las
// 22 hs ya es "mañana" en UTC).
const diaAR = (d: Date) => d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", timeZone: "America/Argentina/Buenos_Aires" });

export default async function PortalMuro() {
  const sesion = await obtenerSesionPortal();
  if (!sesion) redirect("/portal/login");
  const hoy = hoyArgentina();

  const [valores, personas, lista, mios, delMes] = await Promise.all([
    valoresDe(sesion.empresaId),
    personasConFechas(sesion.empresaId),
    prisma.reconocimiento.findMany({ where: { oculto: false, legajo: { empresaId: sesion.empresaId } }, include: { legajo: { select: { nombre: true, apellido: true } }, _count: { select: { aplausos: true } } }, orderBy: { createdAt: "desc" }, take: 40 }),
    prisma.aplausoReconocimiento.findMany({ where: { legajoId: sesion.legajoId }, select: { reconocimientoId: true } }),
    prisma.reconocimiento.count({ where: { emisorId: sesion.legajoId, createdAt: { gte: inicioDelMes(hoy) } } }),
  ]);
  const festejos = celebraciones(personas, hoy, 14, true);
  const deHoy = festejos.filter((c) => c.faltan === 0);
  const proximos = festejos.filter((c) => c.faltan > 0);
  const aplaudidos = new Set(mios.map((a) => a.reconocimientoId));
  const yo = personas.find((p) => p.id === sesion.legajoId);
  const quedan = Math.max(0, MAX_RECONOCIMIENTOS_POR_MES - delMes);

  return (
    <>
      <h1>Muro</h1>

      {deHoy.length > 0 && (
        <div className="p-aviso ok">
          <strong>🎉 Hoy festejamos</strong>
          {deHoy.map((c) => <div key={c.legajoId + c.tipo}>{c.tipo === "cumple" ? "🎂" : "🏅"} {c.legajoId === sesion.legajoId ? (c.tipo === "cumple" ? "¡Feliz cumpleaños!" : `¡Cumplís ${c.anios === 1 ? "tu primer año" : `${c.anios} años`} con nosotros!`) : textoCelebracion(c)}{c.sector && c.legajoId !== sesion.legajoId ? ` · ${c.sector}` : ""}</div>)}
        </div>
      )}

      <Reconocer valores={valores} quedan={quedan} companieros={personas.filter((p) => p.id !== sesion.legajoId).map((p) => ({ id: p.id, nombre: `${p.apellido}, ${p.nombre}`, sector: p.sector })).sort((a, b) => a.nombre.localeCompare(b.nombre))} />

      <h2>Reconocimientos</h2>
      {lista.length === 0 && <p className="p-sub">Todavía no hay reconocimientos. ¿Alguien te dio una mano esta semana? Sé el primero en decirlo.</p>}
      {lista.map((r) => (
        <div key={r.id} className="p-card" style={r.legajoId === sesion.legajoId ? { borderColor: "var(--verde)", borderWidth: 2 } : undefined}>
          <div style={{ display: "flex", gap: "0.7rem", alignItems: "flex-start" }}>
            <span style={{ fontSize: "1.9rem", lineHeight: 1 }} aria-hidden="true">{r.emoji}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="p-card-titulo">{r.legajo.nombre} {r.legajo.apellido}</div>
              <div className="p-card-dato"><span className="p-chip info">{r.valor}</span> <span style={{ color: "#6b727b" }}>de {r.emisorNombre} · {diaAR(r.createdAt)}</span></div>
              <div className="p-card-dato" style={{ whiteSpace: "pre-wrap", fontSize: "0.95rem", marginTop: "0.4rem" }}>{r.mensaje}</div>
              <Aplauso id={r.id} aplausos={r._count.aplausos} aplaudido={aplaudidos.has(r.id)} />
            </div>
          </div>
        </div>
      ))}

      {proximos.length > 0 && (
        <>
          <h2>Próximos festejos</h2>
          <div className="p-card" style={{ padding: 0 }}>
            {proximos.map((c) => (
              <div key={c.legajoId + c.tipo} style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", padding: "0.6rem 0.9rem", borderBottom: "1px solid var(--gris-claro)", fontSize: "0.92rem" }}>
                <span>{c.tipo === "cumple" ? "🎂" : "🏅"} {textoCelebracion(c)}</span>
                <span style={{ color: "#6b727b", whiteSpace: "nowrap" }}>{c.faltan === 1 ? "mañana" : fechaPeriodo(c.fecha).slice(0, 5)}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {yo?.fechaNacimiento && <PreferenciaCumple oculto={yo.ocultarCumple} />}
    </>
  );
}
