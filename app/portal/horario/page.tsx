// FM RRHH — app/portal/horario/page.tsx
// "Mi horario": qué le toca al empleado hoy y las próximas dos semanas.
import { redirect } from "next/navigation";
import { obtenerSesionPortal } from "@/lib/portal";
import { hoyArgentina } from "@/lib/ausencias";
import { jornadasDeLegajo, lunesDe, NOMBRE_DIA } from "@/lib/turnos";

export const dynamic = "force-dynamic";
const DIA_MS = 24 * 3600 * 1000;
const corta = (d: Date) => `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;

export default async function PortalHorario() {
  const sesion = await obtenerSesionPortal();
  if (!sesion) redirect("/portal/login");

  const hoy = hoyArgentina();
  const lunes = lunesDe(hoy);
  const jornadas = await jornadasDeLegajo(sesion.legajoId, sesion.empresaId, lunes, 14).catch((e) => { console.error("Portal: no se pudo cargar el horario:", e); return []; });
  const sinHorario = jornadas.every((j) => j.tipo === "sin_asignar");
  const deHoy = jornadas.find((j) => j.fecha.getTime() === hoy.getTime());

  return (
    <>
      <h1>Mi horario</h1>
      {sinHorario ? (
        <p className="p-sub">Todavía no tenés un horario cargado en el sistema. Ante cualquier duda, consultá con tu jefe o con RR.HH.</p>
      ) : (
        <>
          <div className="p-card">
            <strong style={{ color: "var(--azul-oscuro)" }}>Hoy, {NOMBRE_DIA[hoy.getUTCDay()].toLowerCase()} {corta(hoy)}</strong>
            <div style={{ fontSize: "1.35rem", fontWeight: 700, color: "var(--azul-oscuro)", marginTop: "0.3rem" }}>
              {deHoy?.tipo === "trabaja" ? `${deHoy.ingreso} a ${deHoy.salida}` : deHoy?.tipo === "franco" ? "Franco" : "Sin horario cargado"}
            </div>
            {deHoy?.tipo === "trabaja" && <div className="p-card-dato">Turno {deHoy.horario}{deHoy.nocturno ? " · salís al día siguiente" : ""}</div>}
          </div>

          {[0, 1].map((semana) => (
            <div key={semana}>
              <h2>{semana === 0 ? "Esta semana" : "La semana que viene"}</h2>
              <div className="p-card" style={{ padding: 0 }}>
                {jornadas.slice(semana * 7, semana * 7 + 7).map((j) => {
                  const esHoy = j.fecha.getTime() === hoy.getTime();
                  return (
                    <div key={j.fecha.toISOString()} style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", padding: "0.65rem 0.9rem", borderBottom: "1px solid var(--gris-claro)", background: esHoy ? "#e8f0f6" : undefined, opacity: j.fecha < hoy ? 0.55 : 1 }}>
                      <span style={{ fontWeight: esHoy ? 700 : 400 }}>{NOMBRE_DIA[j.fecha.getUTCDay()].slice(0, 3)} {corta(j.fecha)}</span>
                      {j.tipo === "trabaja" ? (
                        <span style={{ textAlign: "right" }}>
                          <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 3, background: j.color, marginRight: 6 }} aria-hidden="true" />
                          <strong>{j.ingreso}–{j.salida}</strong> <span style={{ color: "#6b727b" }}>{j.horario}</span>
                        </span>
                      ) : (
                        <span style={{ color: "#6b727b" }}>{j.tipo === "franco" ? "Franco" : "Sin horario"}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          <p className="p-pie">Si te cambian el horario, te llega un aviso. Los feriados y los cambios de último momento los confirma tu jefe.</p>
        </>
      )}
    </>
  );
}
