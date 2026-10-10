// FM RRHH — lib/avisos-reglas.ts
// Qué dice cada aviso que el sistema le manda a un empleado. Funciones
// puras, sin base de datos (tests/avisos-reglas.test.mjs).
//
// REGLA DE PRIVACIDAD: una notificación se lee en la pantalla bloqueada del
// celular, a la vista de cualquiera. Por eso ningún aviso lleva importes,
// motivos de un permiso ni el texto de un rechazo: dice QUÉ pasó y manda a
// abrir el portal para ver el detalle.

export interface TextoAviso { tipo: string; titulo: string; cuerpo: string; url: string }

// A mano y no con toLocaleDateString: según la versión de Node, "es-AR"
// devuelve 11/1 en vez de 11/01.
const dia = (d: Date) => `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
const rango = (desde: Date, hasta: Date) => (desde.getTime() === hasta.getTime() ? `el ${dia(desde)}` : `del ${dia(desde)} al ${dia(hasta)}`);

export function avisoReciboDisponible(periodo: string): TextoAviso {
  return { tipo: "recibo", titulo: "Tenés un recibo nuevo", cuerpo: `Ya está tu recibo de ${periodo}. Entrá para verlo y firmarlo.`, url: "/portal/recibos" };
}

export function avisoSolicitudRespondida(s: { tipo: string; estado: "aprobada" | "rechazada"; desde: Date; hasta: Date; paraOtro?: string }): TextoAviso {
  const que = s.tipo === "vacaciones" ? "las vacaciones" : "el permiso";
  const deQuien = s.paraOtro ? ` de ${s.paraOtro}` : "";
  return {
    tipo: "solicitud",
    titulo: s.estado === "aprobada" ? `RR.HH. aprobó ${que}${deQuien}` : `RR.HH. no aprobó ${que}${deQuien}`,
    cuerpo: s.estado === "aprobada" ? `Quedaron confirmadas ${rango(s.desde, s.hasta)}.` : `El pedido ${rango(s.desde, s.hasta).replace(/^el /, "del ")} fue rechazado. Entrá para ver el motivo.`,
    url: s.paraOtro ? "/portal/equipo" : "/portal/vacaciones",
  };
}

// Al empleado, cuando RR.HH. aprueba las vacaciones que pidió su jefe.
export function avisoVacacionesConfirmadas(desde: Date, hasta: Date): TextoAviso {
  return { tipo: "solicitud", titulo: "Tus vacaciones están confirmadas", cuerpo: `RR.HH. las aprobó ${rango(desde, hasta)}.`, url: "/portal/vacaciones" };
}

export function avisoNoticia(titulo: string, requiereAcuse: boolean): TextoAviso {
  return { tipo: "noticia", titulo: requiereAcuse ? "Noticia para confirmar lectura" : "Hay una noticia nueva", cuerpo: titulo.slice(0, 120), url: "/portal/noticias" };
}

// Sin el nombre del documento: puede ser un certificado médico, y la
// notificación se lee con el celular bloqueado.
export function avisoDocumentoRechazado(): TextoAviso {
  return { tipo: "legajo", titulo: "Hay que volver a subir un documento", cuerpo: "RR.HH. revisó un documento de tu legajo y necesita que lo subas de nuevo. Entrá para ver cuál y por qué.", url: "/portal/legajo" };
}

// Al empleado, cuando su jefe carga un pedido de vacaciones para él.
export function avisoPedidoDelJefe(desde: Date, hasta: Date): TextoAviso {
  return { tipo: "solicitud", titulo: "Tu jefe pidió vacaciones para vos", cuerpo: `Son ${rango(desde, hasta)}. Todavía falta que RR.HH. las apruebe.`, url: "/portal/vacaciones" };
}

export function avisoCambioDatosRespondido(aprobado: boolean): TextoAviso {
  return {
    tipo: "legajo",
    titulo: aprobado ? "RR.HH. actualizó tus datos" : "RR.HH. no aplicó el cambio de datos",
    cuerpo: aprobado ? "El cambio que pediste ya está en tu legajo." : "Entrá para ver el motivo.",
    url: "/portal/legajo",
  };
}

export function avisoCambioDeHorario(desde: Date): TextoAviso {
  return { tipo: "horario", titulo: "Cambió tu horario de trabajo", cuerpo: `Tenés un horario nuevo desde el ${dia(desde)}. Entrá para verlo.`, url: "/portal/horario" };
}

export function avisoCambioDeUnDia(fecha: Date): TextoAviso {
  return { tipo: "horario", titulo: "Cambio en tu horario", cuerpo: `Hay un cambio para el ${dia(fecha)}. Entrá para verlo.`, url: "/portal/horario" };
}

export function avisoCapacitacionProgramada(titulo: string, fecha: Date): TextoAviso {
  return { tipo: "capacitacion", titulo: "Tenés una capacitación", cuerpo: `${titulo.slice(0, 90)} — el ${dia(fecha)}.`, url: "/portal/capacitaciones" };
}

export function avisoConstanciaCapacitacion(titulo: string): TextoAviso {
  return { tipo: "capacitacion", titulo: "Confirmá tu capacitación", cuerpo: `Entrá a confirmar que recibiste: ${titulo.slice(0, 100)}.`, url: "/portal/capacitaciones" };
}

export function avisoEvaluacionesParaCompletar(cantidad: number, limite: Date): TextoAviso {
  return { tipo: "evaluacion", titulo: cantidad === 1 ? "Tenés una evaluación para completar" : `Tenés ${cantidad} evaluaciones para completar`, cuerpo: `De tu equipo, hasta el ${dia(limite)}. Entrá a Evaluaciones.`, url: "/portal/evaluaciones" };
}

// Sin el resultado: se lee con el celular bloqueado.
export function avisoEvaluacionEntregada(): TextoAviso {
  return { tipo: "evaluacion", titulo: "Ya está tu evaluación de desempeño", cuerpo: "Entrá para verla y dejar constancia de que la leíste.", url: "/portal/evaluaciones" };
}

export function avisoIngresoAlEmpleado(): TextoAviso {
  return { tipo: "ingreso", titulo: "Te damos la bienvenida", cuerpo: "Tenés algunos pasos para completar tu ingreso. Entrá para verlos.", url: "/portal/ingreso" };
}

export function avisoIngresoAlJefe(nombre: string, fechaIngreso: Date): TextoAviso {
  return { tipo: "ingreso", titulo: `Ingresa ${nombre.slice(0, 40)} a tu equipo`, cuerpo: `Empieza el ${dia(fechaIngreso)}. Tenés tareas para recibirlo: entrá a Mi equipo.`, url: "/portal/equipo" };
}

export const avisoDePrueba = (): TextoAviso => ({ tipo: "prueba", titulo: "Los avisos funcionan", cuerpo: "Así te va a llegar cuando haya un recibo, una respuesta o una noticia.", url: "/portal" });

// "Android · Chrome" — para que el empleado reconozca su celular en la lista.
export function nombreDispositivo(userAgent: string): string {
  const ua = userAgent || "";
  const equipo = /iPhone|iPad|iPod/.test(ua) ? "iPhone" : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows" : /Mac OS X/.test(ua) ? "Mac" : /Linux/.test(ua) ? "Linux" : "Otro equipo";
  const navegador = /Edg\//.test(ua) ? "Edge" : /SamsungBrowser/.test(ua) ? "Samsung Internet" : /Firefox|FxiOS/.test(ua) ? "Firefox" : /Chrome|CriOS/.test(ua) ? "Chrome" : /Safari/.test(ua) ? "Safari" : "navegador";
  return `${equipo} · ${navegador}`;
}

const escapar = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// El mismo aviso, como mail. `urlBase` = https://dominio (sin barra final).
export function htmlDelAviso(a: TextoAviso, nombre: string, empresa: string, urlBase: string): string {
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#2b2f36">
  <div style="background:#163A5C;color:#fff;padding:16px 20px;font-size:15px"><strong>${escapar(empresa)}</strong><br><span style="font-size:12px;opacity:.85">Portal del empleado</span></div>
  <div style="padding:20px;border:1px solid #dfe4e8;border-top:0">
    <p style="margin:0 0 6px;font-size:14px">Hola, ${escapar(nombre)}:</p>
    <h1 style="font-size:18px;color:#163A5C;margin:10px 0">${escapar(a.titulo)}</h1>
    <p style="font-size:14px;line-height:1.5;margin:0 0 18px">${escapar(a.cuerpo)}</p>
    <a href="${escapar(urlBase + a.url)}" style="display:inline-block;background:#163A5C;color:#fff;text-decoration:none;padding:11px 20px;border-radius:6px;font-size:14px">Abrir el portal</a>
    <p style="font-size:11px;color:#6b727b;margin:22px 0 0">Entrás con tu CUIL o DNI y tu PIN. Este mail es solo un aviso: no respondas a esta dirección.</p>
  </div>
</div>`;
}

// ¿Esta dirección es de un servicio de notificaciones de verdad? La entrega
// el navegador del empleado y después el SERVIDOR le manda pedidos: sin
// este control, alguien podría hacer que el sistema le pegue a cualquier
// dirección. Solo se aceptan los servicios de Chrome/Android, Firefox,
// Safari/iPhone y Edge/Windows.
const SERVICIOS_PUSH = ["fcm.googleapis.com", "android.googleapis.com", "push.services.mozilla.com", "push.apple.com", "notify.windows.com"];
export function endpointPushValido(endpoint: string, hostsExtra: string[] = []): boolean {
  if (typeof endpoint !== "string" || endpoint.length > 1000) return false;
  let u: URL;
  try { u = new URL(endpoint); } catch { return false; }
  if (u.protocol !== "https:" || u.username || u.password) return false;
  const host = u.hostname.toLowerCase();
  return [...SERVICIOS_PUSH, ...hostsExtra].some((s) => host === s || host.endsWith("." + s));
}
