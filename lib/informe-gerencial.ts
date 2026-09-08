// FM RRHH — lib/informe-gerencial.ts
// Junta los datos de centro-control.ts + auditoria-context.ts + una
// distribución por convenio (nueva, chica) en la forma que necesita
// informe-gerencial-contenido.ts y el generador de .docx.
import { prisma } from "./prisma";
import { obtenerCentroControl } from "./centro-control";
import { obtenerResultadoAuditoria } from "./auditoria-context";

export async function obtenerDatosInformeGerencial(periodoId: string) {
  const periodo = await prisma.periodo.findUniqueOrThrow({ where: { id: periodoId }, include: { empresa: true } });

  const centroControl = await obtenerCentroControl(periodoId);

  let desvios: { severidad: string; mensaje: string }[] = [];
  try {
    const auditoria = await obtenerResultadoAuditoria(periodoId);
    desvios = auditoria.resumen.map((r: any) => ({ severidad: r.severidad, mensaje: r.mensaje }));
  } catch {
    // Sin liquidaciones todavía, no hay nada que auditar — el informe
    // sigue generándose igual, solo sin esta sección.
  }

  // "Distribución por sector/centro de costo" — se usa Convenio como
  // dimensión, no CentroCosto, porque es el dato que confiablemente está
  // cargado para cualquier legajo en este sistema. Si en el futuro
  // CentroCosto se usa de forma consistente, se puede sumar como columna
  // extra sin romper esto.
  const liquidacionesVigentes = await prisma.liquidacion.findMany({
    where: { periodoId, vigente: true },
    include: { legajo: { include: { convenio: true } } },
  });
  const porConvenioMap = new Map<string, { cantidad: number; costoLaboral: number }>();
  for (const liq of liquidacionesVigentes) {
    const codigo = liq.legajo.convenio.codigo;
    const actual = porConvenioMap.get(codigo) ?? { cantidad: 0, costoLaboral: 0 };
    actual.cantidad += 1;
    actual.costoLaboral += liq.bruto;
    porConvenioMap.set(codigo, actual);
  }
  const distribucionPorConvenio = [...porConvenioMap.entries()].map(([convenio, v]) => ({ convenio, ...v }));

  return {
    empresa: { razonSocial: periodo.empresa.razonSocial },
    periodoActual: centroControl.periodoActual,
    periodoAnterior: centroControl.periodoAnterior,
    costoLaboral: centroControl.costoLaboral,
    dotacion: centroControl.dotacion,
    ausentismoPct: centroControl.ausentismoPct,
    horasExtra: centroControl.horasExtra,
    costoPorEmpleado: centroControl.costoPorEmpleado,
    alertas: centroControl.alertas,
    distribucionPorConvenio,
    desvios,
  };
}
