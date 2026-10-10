// FM RRHH — lib/avisos.ts
// Manda avisos a los empleados por dos canales: notificación en el celular
// (para quien la activó desde el portal) y mail (para quien tiene mail en
// el legajo). Deja registro de cada aviso en la tabla Aviso.
//
// Dos reglas que valen para todo el archivo:
//   1. Un aviso NUNCA hace fallar la acción que lo dispara. Si el mail o la
//      notificación no salen, el recibo igual queda cerrado y el pedido
//      igual queda aprobado. Por eso avisar() no tira errores.
//   2. Solo se le avisa a quien puede entrar al portal (acceso activo): el
//      aviso lleva a una pantalla del portal.
//
// CONFIGURACIÓN (en .env.local y en Vercel):
//   VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY  ← las "llaves" de las
//       notificaciones. Se generan UNA sola vez con:
//           npx web-push generate-vapid-keys
//       Si se cambian, todos los celulares tienen que activar de nuevo.
//   VAPID_CONTACTO=mailto:alguien@empresa  ← opcional; a quién escribe el
//       servicio de notificaciones si hay un problema.
//   RESEND_API_KEY / EMAIL_REMITENTE  ← las del mail, ver lib/email.ts.
// Sin las VAPID, el portal no ofrece activar avisos; sin las de mail, no
// salen mails. Nada de eso rompe el resto.
import webpush from "web-push";
import { headers } from "next/headers";
import { prismaSistema } from "./prisma";
import { enviarEmailsEnLote } from "./email";
import { limpiarPermisos, permisosHeredados } from "./permisos";
import { htmlDelAviso, type TextoAviso } from "./avisos-reglas";
export * from "./avisos-reglas";

export function clavePublicaPush(): string | null {
  return process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY ? process.env.VAPID_PUBLIC_KEY : null;
}

let vapidListo = false;
function prepararPush(): boolean {
  const publica = clavePublicaPush();
  if (!publica) return false;
  if (!vapidListo) {
    webpush.setVapidDetails(process.env.VAPID_CONTACTO || "mailto:soporte@fmconsultorarrhh.com.ar", publica, process.env.VAPID_PRIVATE_KEY!);
    vapidListo = true;
  }
  return true;
}

// https://dominio del pedido en curso — para armar los enlaces del mail.
export function urlBaseDelPedido(): string {
  try {
    const h = headers();
    const host = h.get("x-forwarded-host") ?? h.get("host");
    if (host) return `${h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https")}://${host}`;
  } catch {}
  return process.env.URL_PUBLICA ?? "";
}

async function enTandas<T>(items: T[], tamanio: number, hacer: (item: T) => Promise<void>) {
  for (let i = 0; i < items.length; i += tamanio) await Promise.allSettled(items.slice(i, i + tamanio).map(hacer));
}

// Avisa a uno o varios empleados. Devuelve un resumen (para la pantalla de
// prueba y los logs); nunca tira.
export async function avisar(legajoIds: string[], aviso: TextoAviso | ((legajoId: string) => TextoAviso)): Promise<{ personas: number; push: number; mails: number }> {
  const resumen = { personas: 0, push: 0, mails: 0 };
  try {
    const ids = [...new Set(legajoIds)];
    if (ids.length === 0) return resumen;
    const db = prismaSistema;
    const legajos = await db.legajo.findMany({
      where: { id: { in: ids }, accesoPortal: { activo: true } },
      select: { id: true, nombre: true, email: true, empresa: { select: { razonSocial: true, nombreFantasia: true } }, suscripcionesPush: true },
    });
    if (legajos.length === 0) return resumen;
    resumen.personas = legajos.length;
    const textoDe = (id: string) => (typeof aviso === "function" ? aviso(id) : aviso);
    const estado = new Map(legajos.map((l) => [l.id, { pushEnviados: 0, pushFallidos: 0, emailEstado: null as string | null }]));

    // ── Notificaciones ──
    if (prepararPush()) {
      const envios = legajos.flatMap((l) => l.suscripcionesPush.map((s) => ({ l, s })));
      const vencidas: string[] = [];
      await enTandas(envios, 25, async ({ l, s }) => {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(textoDe(l.id)), { TTL: 60 * 60 * 24 * 2, urgency: "normal" });
          estado.get(l.id)!.pushEnviados++;
          resumen.push++;
        } catch (e: any) {
          estado.get(l.id)!.pushFallidos++;
          // 404 / 410 = el celular desactivó los avisos o desinstaló: esa
          // suscripción no sirve más y se borra para no insistir.
          if (e?.statusCode === 404 || e?.statusCode === 410) vencidas.push(s.id);
          else console.error("Aviso: no salió una notificación:", e?.statusCode ?? e?.message);
        }
      });
      if (vencidas.length) await db.suscripcionPush.deleteMany({ where: { id: { in: vencidas } } });
    }

    // ── Mails ──
    const conMail = legajos.filter((l) => l.email && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(l.email));
    if (conMail.length > 0) {
      const urlBase = urlBaseDelPedido();
      const { configurado, resultados } = await enviarEmailsEnLote(
        conMail.map((l) => {
          const t = textoDe(l.id);
          return { destinatario: l.email!, asunto: t.titulo, html: htmlDelAviso(t, l.nombre, l.empresa.nombreFantasia || l.empresa.razonSocial, urlBase) };
        })
      );
      if (configurado) {
        conMail.forEach((l, i) => {
          estado.get(l.id)!.emailEstado = resultados[i] === null ? "enviado" : `error: ${resultados[i]}`;
          if (resultados[i] === null) resumen.mails++;
        });
        const fallo = resultados.find((r) => r !== null);
        if (fallo) console.error("Aviso: no salieron mails:", fallo);
      }
    }

    await db.aviso.createMany({ data: legajos.map((l) => ({ legajoId: l.id, ...textoDe(l.id), ...estado.get(l.id)! })) });
  } catch (e) {
    console.error("Aviso: falló el envío (la acción que lo disparó no se ve afectada):", e);
  }
  return resumen;
}

// A RR.HH. cuando entra un pedido nuevo: mail a los usuarios del panel que
// pueden responderlo en esa empresa (Vacaciones en "gestionar", y con el
// sector de la persona si están limitados a sectores). Si la empresa no
// tiene ningún usuario así, les llega a los administradores.
export async function avisarPedidoNuevoARRHH(p: { empresaId: string; centroCostoId: string | null; empleado: string; tipo: string; desde: Date; hasta: Date; pedidoPor: string | null }) {
  try {
    if (!process.env.RESEND_API_KEY) return;
    const db = prismaSistema;
    const asignados = await db.usuarioEmpresa.findMany({ where: { empresaId: p.empresaId }, select: { sectores: true, usuario: { select: { email: true, rol: true } }, rol: { select: { permisos: true } } } });
    let destinatarios = asignados
      .filter((a) => a.usuario.rol !== "admin")
      .filter((a) => (a.rol ? limpiarPermisos(a.rol.permisos) : permisosHeredados(a.usuario.rol)).vacaciones === "gestionar")
      .filter((a) => a.sectores.length === 0 || (p.centroCostoId !== null && a.sectores.includes(p.centroCostoId)))
      .map((a) => a.usuario.email);
    if (destinatarios.length === 0) destinatarios = (await db.usuario.findMany({ where: { rol: "admin" }, select: { email: true } })).map((u) => u.email);
    if (destinatarios.length === 0) return;

    const empresa = await db.empresa.findUnique({ where: { id: p.empresaId }, select: { razonSocial: true, nombreFantasia: true } });
    const nombreEmpresa = empresa?.nombreFantasia || empresa?.razonSocial || "";
    const dia = (d: Date) => d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
    const que = p.tipo === "vacaciones" ? "vacaciones" : "un permiso";
    const texto = {
      tipo: "solicitud",
      titulo: `Pedido nuevo de ${que}: ${p.empleado}`,
      cuerpo: `${p.pedidoPor ? `${p.pedidoPor} pidió ${que} para ${p.empleado}` : `${p.empleado} pidió ${que}`}, del ${dia(p.desde)} al ${dia(p.hasta)}. Está esperando tu respuesta.`,
      url: "/solicitudes",
    };
    const urlBase = urlBaseDelPedido();
    const html = htmlDelAviso(texto, "", nombreEmpresa, urlBase)
      .replace("Hola, :", "Hola:")
      .replace("Portal del empleado</span>", "FM RRHH</span>")
      .replace("Abrir el portal", "Ver el pedido")
      .replace("Entrás con tu CUIL o DNI y tu PIN. ", "");
    const { resultados } = await enviarEmailsEnLote([...new Set(destinatarios)].map((d) => ({ destinatario: d, asunto: `${nombreEmpresa}: ${texto.titulo}`, html })));
    const fallo = resultados.find((r) => r !== null);
    if (fallo) console.error("Aviso a RR.HH.: no salió el mail:", fallo);
  } catch (e) {
    console.error("Aviso a RR.HH.: falló el envío:", e);
  }
}
