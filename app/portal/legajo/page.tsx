// FM RRHH — app/portal/legajo/page.tsx
// "Mi legajo": la carpeta del empleado, como checklist. Qué falta, qué hay
// que firmar, qué subió y en qué estado está, y sus datos.
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerSesionPortal } from "@/lib/portal";
import { cargarLegajoDigital, TIPOS_DOCUMENTO, CAMPOS_EDITABLES, CATEGORIA_RESERVADA, type TipoDocumento, type EstadoItem, type CampoEditable, type Cambios } from "@/lib/legajo-digital";
import { fechaHora } from "../formato";
import FirmarConstancia from "./FirmarConstancia";
import SubirDocumento from "./SubirDocumento";
import TallesForm from "./TallesForm";
import CambioDatosForm from "./CambioDatosForm";

export const dynamic = "force-dynamic";

const CHIP: Record<EstadoItem, { clase: string; texto: string }> = {
  completo: { clase: "conforme", texto: "Completo" },
  para_firmar: { clase: "pendiente", texto: "Falta firmar" },
  desactualizado: { clase: "pendiente", texto: "Firmar de nuevo" },
  en_revision: { clase: "info", texto: "En revisión" },
  rechazado: { clase: "disconforme", texto: "Rechazado: subir de nuevo" },
  falta: { clase: "pendiente", texto: "Falta" },
  opcional: { clase: "cancelada", texto: "Opcional" },
};
const NOMBRE_CONSTANCIA: Record<string, string> = { ficha: "Ficha de datos personales", ddjj_domicilio: "Declaración jurada de domicilio", notif_vacaciones: "Notificación de vacaciones" };

export default async function PortalLegajo() {
  const sesion = await obtenerSesionPortal();
  if (!sesion) redirect("/portal/login");

  const [{ legajo, items, paraFirmar, resumen, firmas }, documentos, cambios] = await Promise.all([
    cargarLegajoDigital(sesion.legajoId),
    prisma.documentoLegajo.findMany({
      where: { legajoId: sesion.legajoId, categoria: { not: CATEGORIA_RESERVADA } },
      select: { id: true, tipo: true, nombre: true, estado: true, motivoRechazo: true, fechaSubida: true },
      orderBy: { fechaSubida: "desc" },
    }),
    prisma.solicitudCambioDatos.findMany({ where: { legajoId: sesion.legajoId }, orderBy: { createdAt: "desc" }, take: 1 }),
  ]);
  const item = (clave: string) => items.find((i) => i.clave === clave)!;
  const ultimoCambio = cambios[0];
  const datosActuales = Object.fromEntries((Object.keys(CAMPOS_EDITABLES) as CampoEditable[]).map((c) => [c, ((legajo as any)[c] as string | null) ?? ""])) as Record<CampoEditable, string>;

  return (
    <>
      <h1>Mi legajo</h1>
      {resumen.completo ? (
        <div className="p-aviso ok">Tu legajo está completo.</div>
      ) : (
        <div className="p-aviso pendiente">
          <strong>{resumen.completos} de {resumen.total}</strong> ítems completos.
          {resumen.pendientesEmpleado > 0 ? ` Hay ${resumen.pendientesEmpleado} que ${resumen.pendientesEmpleado === 1 ? "depende" : "dependen"} de vos.` : " Lo que falta lo está viendo RR.HH."}
        </div>
      )}

      {paraFirmar.length > 0 && <h2>Para firmar</h2>}
      {paraFirmar.map((p) => (
        <div key={p.clave} className="p-card">
          <div className="p-card-titulo">{item(p.clave).nombre}</div>
          {item(p.clave).detalle && <div className="p-card-dato">{item(p.clave).detalle}</div>}
          <details className="p-detalle" open={paraFirmar.length === 1}>
            <summary>Leer lo que voy a firmar</summary>
            {p.contenido.secciones.map((s, i) => (
              <div key={i}>
                {s.titulo && <div className="p-seccion">{s.titulo}</div>}
                <table className="p-tabla p-datos"><tbody>
                  {s.filas.map(([k, v]) => <tr key={k}><td>{k}</td><td>{v || <em>sin cargar</em>}</td></tr>)}
                </tbody></table>
              </div>
            ))}
            <p className="p-declaracion">{p.contenido.declaracion}</p>
          </details>
          <FirmarConstancia clave={p.clave} hash={p.hash} />
        </div>
      ))}

      <h2>Documentos</h2>
      {(Object.keys(TIPOS_DOCUMENTO) as TipoDocumento[]).map((tipo) => {
        const def = TIPOS_DOCUMENTO[tipo];
        const it = item(tipo);
        // "Otros" junta también lo que RR.HH. cargó antes de que existiera el checklist.
        const propios = documentos.filter((d) => d.tipo === tipo || (tipo === "otro" && d.tipo === null));
        return (
          <div key={tipo} className="p-card">
            <div className="p-fila-titulo">
              <span className="p-card-titulo">{def.nombre}</span>
              <span className={`p-chip ${CHIP[it.estado].clase}`}>{CHIP[it.estado].texto}</span>
            </div>
            {it.estado === "rechazado" && it.detalle && <div className="p-respuesta"><strong>RR.HH.:</strong> {it.detalle}</div>}
            {propios.map((d) => (
              <div key={d.id} className="p-doc">
                <a href={`/api/portal/legajo/documentos/${d.id}`} target="_blank" rel="noopener">{d.nombre}</a>
                <span>{fechaHora(d.fechaSubida).slice(0, 10)}{d.estado === "pendiente" ? " · en revisión" : d.estado === "rechazado" ? " · rechazado" : ""}</span>
              </div>
            ))}
            {def.quien === "empleado" ? (
              <SubirDocumento tipo={tipo} pideDetalle={!def.requerido} yaTiene={propios.length > 0} />
            ) : (
              propios.length === 0 && <p className="p-pie" style={{ margin: "0.4rem 0 0" }}>Este documento lo carga RR.HH.</p>
            )}
          </div>
        );
      })}

      <h2>Mis talles</h2>
      <TallesForm ropa={legajo.talleRopa ?? ""} calzado={legajo.talleCalzado ?? ""} />

      <h2>Mis datos</h2>
      <div className="p-card">
        <table className="p-tabla p-datos"><tbody>
          <tr><td>Nombre</td><td>{legajo.apellido}, {legajo.nombre}</td></tr>
          <tr><td>CUIL</td><td>{legajo.cuil}</td></tr>
          {(Object.keys(CAMPOS_EDITABLES) as CampoEditable[]).map((c) => (
            <tr key={c}><td>{CAMPOS_EDITABLES[c].nombre.replace(/ \(.*/, "")}</td><td>{datosActuales[c] || <em>sin cargar</em>}</td></tr>
          ))}
        </tbody></table>

        {ultimoCambio?.estado === "pendiente" ? (
          <div className="p-aviso info" style={{ margin: "0.9rem 0 0" }}>
            Pediste cambiar: {Object.keys(ultimoCambio.cambios as Cambios).map((c) => CAMPOS_EDITABLES[c as CampoEditable]?.nombre.replace(/ \(.*/, "")).join(", ")}. Está esperando la respuesta de RR.HH.
          </div>
        ) : (
          <>
            {ultimoCambio?.estado === "rechazada" && (
              <div className="p-respuesta" style={{ marginTop: "0.9rem" }}><strong>RR.HH. no aprobó tu último cambio:</strong> {ultimoCambio.respuesta}</div>
            )}
            <CambioDatosForm actuales={datosActuales} />
          </>
        )}
        <p className="p-pie" style={{ marginBottom: 0 }}>Si hay un error en tu nombre, CUIL o fecha de ingreso, avisale a RR.HH.</p>
      </div>

      {firmas.length > 0 && (
        <>
          <h2>Lo que ya firmé</h2>
          <div className="p-card">
            {firmas.map((f) => (
              <div key={f.id} className="p-doc">
                <a href={`/api/portal/legajo/constancias/${f.id}`} target="_blank" rel="noopener">{NOMBRE_CONSTANCIA[f.tipo] ?? f.tipo}</a>
                <span>{fechaHora(f.firmadoEn)}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
