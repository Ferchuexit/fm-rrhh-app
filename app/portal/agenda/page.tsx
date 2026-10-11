// FM RRHH — app/portal/agenda/page.tsx
// La agenda del empleado: lo que viene en los próximos dos meses, día por
// día. Lo suyo (vacaciones, capacitaciones, eventos), lo de su equipo si
// tiene gente a cargo, y lo de todos (feriados, cumpleaños).
import { redirect } from "next/navigation";
import { obtenerSesionPortal } from "@/lib/portal";
import { hoyArgentina } from "@/lib/ausencias";
import { agendaDe, porDia, TIPOS_AGENDA, isoDia } from "@/lib/agenda";

export const dynamic = "force-dynamic";
const DIA = 86400000;
const corto = (d: Date) => d.toLocaleDateString("es-AR", { day: "numeric", month: "numeric", timeZone: "UTC" });

export default async function PortalAgenda() {
  const sesion = await obtenerSesionPortal();
  if (!sesion) redirect("/portal/login");
  const hoy = hoyArgentina(), hasta = new Date(hoy.getTime() + 60 * DIA);
  // En la lista, lo que dura varios días (unas vacaciones) se muestra una
  // sola vez, el primer día, con su "del… al…".
  const vistos = new Set<string>();
  const dias = new Map([...porDia(await agendaDe(sesion.legajoId, hoy, hasta), hoy, hasta)].map(([iso, lista]) => [iso, lista.filter((i) => !vistos.has(i.clave) && !!vistos.add(i.clave))] as const).filter(([, lista]) => lista.length > 0));
  const rotulo = (iso: string) => {
    const d = new Date(iso + "T00:00:00Z"), faltan = Math.round((d.getTime() - hoy.getTime()) / DIA);
    const texto = d.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
    return faltan === 0 ? `Hoy · ${texto}` : faltan === 1 ? `Mañana · ${texto}` : texto.replace(/^./, (c) => c.toUpperCase());
  };

  return (
    <>
      <h1>Agenda</h1>
      <p className="p-sub">Lo que viene en los próximos dos meses.</p>
      {dias.size === 0 && <p className="p-sub">No hay nada agendado.</p>}
      {[...dias].map(([iso, lista]) => (
        <div key={iso} style={{ marginBottom: "0.9rem" }}>
          <div style={{ fontSize: "0.82rem", fontWeight: 700, color: iso === isoDia(hoy) ? "var(--verde)" : "var(--azul-oscuro)", margin: "0 0 0.3rem 0.2rem" }}>{rotulo(iso)}</div>
          <div className="p-card" style={{ padding: 0, marginBottom: 0 }}>
            {lista.map((i) => {
              const adentro = (
                <>
                  <span style={{ fontSize: "1.3rem" }} aria-hidden="true">{TIPOS_AGENDA[i.tipo].emoji}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontWeight: 600, color: "#12202e" }}>{i.titulo}</span>
                    {(i.hora || i.detalle || i.hasta) && <span style={{ display: "block", fontSize: "0.82rem", color: "#6b727b" }}>{[i.hora ? `${i.hora} hs` : null, i.hasta ? `del ${corto(i.fecha)} al ${corto(i.hasta)}` : null, i.detalle].filter(Boolean).join(" · ")}</span>}
                  </span>
                  {i.url && <span style={{ color: "#6b727b" }} aria-hidden="true">›</span>}
                </>
              );
              const estilo = { display: "flex", gap: "0.7rem", alignItems: "center", padding: "0.6rem 0.9rem", borderBottom: "1px solid var(--gris-claro)", borderLeft: `4px solid ${TIPOS_AGENDA[i.tipo].color}`, textDecoration: "none" } as const;
              return i.url ? <a key={i.clave} href={i.url} style={estilo}>{adentro}</a> : <div key={i.clave} style={estilo}>{adentro}</div>;
            })}
          </div>
        </div>
      ))}
    </>
  );
}
