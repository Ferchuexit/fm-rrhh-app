// FM RRHH — lib/estado-implementacion-convenio.ts
//
// "Estado de implementación" por convenio (documento de mejora, sección
// "Convenios: convertir la parametrización en un activo") — para poder
// decir con datos reales qué tan preparado está cada CCT, en vez de
// ofrecerlo como "completo" de palabra.
//
// Distinción importante: hay ítems OBLIGATORIOS siempre (todo convenio
// necesita básico, aportes de seguridad social, escalas cargadas, y
// códigos ARCA completos para exportar LSD) — su ausencia SÍ es un hueco
// real. Y hay ítems OPCIONALES por CCT (presentismo, sindical, no
// remunerativos) — su ausencia puede ser perfectamente correcta (ej.
// Camioneros no tiene presentismo en este sistema, y no debería tenerlo,
// no es un hueco). Estos se muestran como "cargado / no cargado", sin
// tratarlos como una falla.
import { prisma } from "./prisma";

const CODIGOS_APORTES = ["JUBILACION", "LEY_19032", "OBRA_SOCIAL"];
const CODIGOS_CONTRIBUCIONES = ["CONTRIB_JUBILACION", "CONTRIB_OBRA_SOCIAL"];

export async function obtenerEstadoImplementacion(convenioId: string) {
  const convenio = await prisma.convenio.findUniqueOrThrow({ where: { id: convenioId } });

  const reglas = await prisma.reglaConcepto.findMany({
    where: { convenioId, vigenciaHasta: null },
    include: { concepto: true },
  });
  const codigosConRegla = new Set(reglas.map((r) => r.concepto.codigo));

  const escalasCount = await prisma.escala.count({ where: { convenioId } });
  const categoriasCount = await prisma.categoria.count({ where: { convenioId } });

  const tieneBasico = codigosConRegla.has("REM_BASICA");
  const tieneAntiguedad = codigosConRegla.has("ANTIGUEDAD");
  const tieneAportes = CODIGOS_APORTES.every((c) => codigosConRegla.has(c));
  const tieneContribuciones = CODIGOS_CONTRIBUCIONES.every((c) => codigosConRegla.has(c));
  const tieneEscalas = escalasCount > 0 && categoriasCount > 0;

  // Códigos ARCA completos = todo concepto QUE ESTE CONVENIO USA (tiene
  // una regla vigente) tiene codigoArca cargado — sin esto, el LSD se
  // rompe al exportar (ya lo vivimos con Ganancias).
  const conceptosSinCodigoArca = reglas.filter((r) => !r.concepto.codigoArca).map((r) => r.concepto.codigo);
  const codigosArcaCompletos = conceptosSinCodigoArca.length === 0;

  // Opcionales por CCT — informativo, no penaliza el % si faltan.
  const tienePresentismo = codigosConRegla.has("PRESENTISMO");
  const tieneSindical = codigosConRegla.has("SINDICATO");
  const tieneNoRemunerativos = reglas.some((r) => r.concepto.tipo === "no_remunerativo");
  const tieneHorasExtra = codigosConRegla.has("HS_EXTRA_50") || codigosConRegla.has("HS_EXTRA_100");

  const itemsObligatorios = [
    { clave: "basico", etiqueta: "Básico", ok: tieneBasico },
    { clave: "antiguedad", etiqueta: "Antigüedad", ok: tieneAntiguedad },
    { clave: "aportes", etiqueta: "Aportes de seguridad social (Jubilación/Ley 19.032/Obra Social)", ok: tieneAportes },
    { clave: "contribuciones", etiqueta: "Contribuciones patronales", ok: tieneContribuciones },
    { clave: "escalas", etiqueta: "Escalas y categorías cargadas", ok: tieneEscalas },
    { clave: "codigos_arca", etiqueta: "Códigos ARCA completos (LSD)", ok: codigosArcaCompletos, detalleSiFalta: conceptosSinCodigoArca },
  ];

  const cantidadOk = itemsObligatorios.filter((i) => i.ok).length;
  const porcentaje = Math.round((cantidadOk / itemsObligatorios.length) * 100);

  return {
    convenio: { id: convenio.id, codigo: convenio.codigo, nombre: convenio.nombre },
    porcentaje,
    itemsObligatorios,
    itemsOpcionales: [
      { clave: "presentismo", etiqueta: "Presentismo", cargado: tienePresentismo },
      { clave: "sindical", etiqueta: "Cuota sindical", cargado: tieneSindical },
      { clave: "no_remunerativos", etiqueta: "Conceptos no remunerativos", cargado: tieneNoRemunerativos },
      { clave: "horas_extra", etiqueta: "Horas extra", cargado: tieneHorasExtra },
    ],
    // Ganancias y el motor de Recibo son capacidades del SISTEMA, no de
    // un convenio en particular — cualquier legajo de cualquier convenio
    // ya las usa automáticamente una vez liquidado, así que no tiene
    // sentido medirlas "por convenio".
    capacidadesDelSistema: [
      { etiqueta: "Impuesto a las Ganancias 4ta categoría", ok: true },
      { etiqueta: "Generación de recibo (PDF)", ok: true },
      { etiqueta: "Embargos (judicial/comercial)", ok: true },
    ],
  };
}
