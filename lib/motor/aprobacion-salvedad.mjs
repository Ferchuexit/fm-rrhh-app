// FM RRHH — aprobacion-salvedad.mjs
//
// motor-auditoria.mjs bloquea el cierre si hay alertas rojas — a propósito,
// eso está bien como default. Pero hay casos legítimos: un bajo_escala real
// porque el empleado está con licencia sin goce de sueldo, no porque alguien
// cargó mal un dato. Este módulo no debilita la auditoría — agrega un camino
// explícito para cerrar igual, dejando constancia de POR QUÉ, quién lo
// autorizó y cuándo. La regla de auditoría sigue disparando exactamente
// igual; lo que cambia es que ahora hay una salida documentada en vez de
// "aflojar el semáforo".

/**
 * @param {object} resultadoAuditoria - el objeto que devuelve auditarPeriodo() de motor-auditoria.mjs
 * @param {Array} justificaciones - [{ tipo, motivo, usuarioId }] — una por cada
 *   grupo de alerta ROJA que se quiere salvar. `tipo` tiene que matchear
 *   exactamente el `tipo` del grupo en resultadoAuditoria.resumen.
 */
function evaluarCierreConSalvedad(resultadoAuditoria, justificaciones = []) {
  const gruposRojos = resultadoAuditoria.resumen.filter((r) => r.severidad === "rojo");

  if (gruposRojos.length === 0) {
    return { puedeCerrar: resultadoAuditoria.puedeCerrar, requiereSalvedad: false, pendientes: [], salvedadesAplicadas: [] };
  }

  const justificacionPorTipo = new Map(justificaciones.map((j) => [j.tipo, j]));
  const pendientes = [];
  const salvedadesAplicadas = [];

  for (const grupo of gruposRojos) {
    const j = justificacionPorTipo.get(grupo.tipo);
    if (!j || !j.motivo || j.motivo.trim().length < 15) {
      // Se exige un mínimo de 15 caracteres a propósito — "ok" o "sí" no es una
      // justificación, es un click para sacarse de encima la alerta. Si el
      // motivo real es corto, va a tener que decir POR QUÉ igual.
      pendientes.push({
        tipo: grupo.tipo,
        mensaje: grupo.mensaje,
        motivoRequerido: !j
          ? "Falta justificar esta alerta para poder cerrar con salvedad."
          : "El motivo es demasiado breve — se necesita una explicación real, no un click.",
      });
    } else {
      salvedadesAplicadas.push({
        tipo: grupo.tipo,
        mensaje: grupo.mensaje,
        motivo: j.motivo.trim(),
        usuarioId: j.usuarioId ?? null,
        fecha: new Date().toISOString(),
      });
    }
  }

  const puedeCerrarConSalvedad = pendientes.length === 0;

  return {
    puedeCerrar: puedeCerrarConSalvedad,
    requiereSalvedad: true,
    pendientes,
    salvedadesAplicadas,
    // Esto es lo que se persiste en audit_log / alertas_auditoria.resuelto,
    // no un simple booleano — la trazabilidad completa de qué se salvó y por qué.
    registroParaAuditLog: puedeCerrarConSalvedad
      ? {
          accion: "cierre_con_salvedad",
          salvedades: salvedadesAplicadas,
        }
      : null,
  };
}

export { evaluarCierreConSalvedad };
