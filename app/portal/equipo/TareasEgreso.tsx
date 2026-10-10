// Tareas del jefe en el egreso de alguien de su equipo (traspaso, recibir
// herramientas). Se busca por "me reporta", esté activo o ya dado de baja:
// las tareas siguen después del último día. Si falla (falta la migración),
// no muestra nada y la pantalla sigue.
import { prisma } from "@/lib/prisma";
import { ponerAlDiaEgresos } from "@/lib/egresos";
import { fechaPeriodo } from "../formato";
import TildarTarea from "../ingreso/TildarTarea";

export default async function TareasEgreso({ jefeId, hoy }: { jefeId: string; hoy: Date }) {
  const egresos = await (async () => {
    const deMiGente = { legajo: { jefeId }, estado: "en_curso" };
    await ponerAlDiaEgresos((await prisma.egreso.findMany({ where: deMiGente, select: { id: true } })).map((e) => e.id));
    return prisma.egreso.findMany({ where: deMiGente, include: { legajo: { select: { nombre: true, apellido: true } }, tareas: { where: { responsable: "jefe" }, orderBy: [{ vence: "asc" }, { orden: "asc" }] } }, orderBy: { fechaEgreso: "asc" } });
  })().catch((e) => { console.error("Portal equipo: no se pudieron cargar los egresos:", e); return []; });

  return (
    <>
      {egresos.filter((e) => e.tareas.length > 0).map((eg) => (
        <div key={eg.id}>
          <h2>🚪 Salida de {eg.legajo.nombre} {eg.legajo.apellido}</h2>
          <p className="p-sub" style={{ marginTop: "-0.3rem" }}>Su último día es el {fechaPeriodo(eg.fechaEgreso)}. Estas son tus tareas:</p>
          {eg.tareas.map((t) => (
            <div key={t.id} className="p-card">
              <div className="p-card-titulo">{t.estado !== "pendiente" ? "✅ " : ""}{t.titulo}</div>
              {t.detalle && <div className="p-card-dato">{t.detalle}</div>}
              {t.estado === "pendiente" && <div className="p-card-dato">Para el {fechaPeriodo(t.vence)}{t.vence < hoy ? " — está vencida" : ""}</div>}
              {!t.clave && t.estado !== "no_aplica" && <div style={{ marginTop: "0.4rem" }}><TildarTarea id={t.id} hecha={t.estado === "hecha"} titulo={t.titulo} tipo="egreso" /></div>}
            </div>
          ))}
        </div>
      ))}
    </>
  );
}
