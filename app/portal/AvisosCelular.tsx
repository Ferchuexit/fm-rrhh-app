"use client";
// FM RRHH — app/portal/AvisosCelular.tsx
// "Activar avisos en este celular". El permiso es por aparato: cada
// celular donde el empleado quiera recibir avisos lo activa una vez.
import { useEffect, useState } from "react";

type Estado = "cargando" | "no_disponible" | "ios_instalar" | "bloqueado" | "apagado" | "prendido";

// La llave pública viene en texto (base64 "url"); el navegador la quiere en bytes.
function aBytes(base64url: string) {
  const b64 = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

// El receptor de avisos, ya activo. Su alcance es "/portal/" (la carpeta
// donde está el archivo); la pantalla de inicio es "/portal", sin barra, y
// queda afuera — por eso NO se usa navigator.serviceWorker.ready, que
// espera uno que controle la pantalla actual y acá no llegaría nunca. Para
// recibir avisos no hace falta que controle ninguna pantalla.
async function receptor(): Promise<ServiceWorkerRegistration> {
  const registro = await navigator.serviceWorker.register("/portal/sw.js", { scope: "/portal/" });
  if (registro.active) return registro;
  const sw = registro.installing ?? registro.waiting;
  if (sw) {
    await new Promise<void>((listo, fallo) => {
      const limite = setTimeout(() => fallo(new Error("El celular tardó demasiado en preparar los avisos. Probá de nuevo.")), 10000);
      sw.addEventListener("statechange", () => { if (sw.state === "activated") { clearTimeout(limite); listo(); } });
      if (sw.state === "activated") { clearTimeout(limite); listo(); }
    });
  }
  return registro;
}

export default function AvisosCelular() {
  const [estado, setEstado] = useState<Estado>("cargando");
  const [clave, setClave] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [trabajando, setTrabajando] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const esIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
        const instalada = window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone === true;
        const soporta = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
        // En iPhone las notificaciones solo existen con el portal agregado a
        // la pantalla de inicio: antes de eso el navegador ni las ofrece.
        if (esIOS && !instalada) return setEstado("ios_instalar");
        if (!soporta) return setEstado("no_disponible");

        const res = await fetch("/api/portal/push");
        const datos = res.ok ? await res.json() : { clavePublica: null };
        if (!datos.clavePublica) return setEstado("no_disponible");
        setClave(datos.clavePublica);
        if (Notification.permission === "denied") return setEstado("bloqueado");

        const registro = await receptor();
        const actual = await registro.pushManager.getSubscription();
        // Activado = el navegador tiene la suscripción Y el servidor la conoce
        // para ESTE empleado (si el celular lo usó otro antes, se reactiva).
        const conocida = actual && (datos.dispositivos ?? []).some((d: any) => d.endpoint === actual.endpoint);
        setEstado(conocida ? "prendido" : "apagado");
      } catch {
        setEstado("no_disponible");
      }
    })();
  }, []);

  async function activar() {
    setTrabajando(true);
    setMensaje("");
    try {
      const permiso = await Notification.requestPermission();
      if (permiso !== "granted") {
        setEstado(permiso === "denied" ? "bloqueado" : "apagado");
        return;
      }
      const registro = await receptor();
      const suscripcion = (await registro.pushManager.getSubscription()) ?? (await registro.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: aBytes(clave) }));
      const res = await fetch("/api/portal/push", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ suscripcion: suscripcion.toJSON() }) });
      if (!res.ok) { setMensaje((await res.json().catch(() => ({}))).error || "No se pudieron activar. Probá de nuevo."); return; }
      setEstado("prendido");
      setMensaje("Listo. Te mandamos un aviso de prueba.");
      fetch("/api/portal/push/prueba", { method: "POST" }).catch(() => {});
    } catch (e) {
      // Lo que falla acá es el celular o el navegador (sin conexión, modo
      // incógnito, ahorro de batería): su mensaje viene en inglés y no le
      // sirve al empleado.
      console.error("Avisos: no se pudo activar:", e);
      setMensaje("No se pudieron activar en este celular. Revisá tu conexión, que no estés en modo incógnito, y probá de nuevo.");
    } finally {
      setTrabajando(false);
    }
  }

  async function desactivar() {
    setTrabajando(true);
    setMensaje("");
    try {
      const registro = await receptor();
      const suscripcion = await registro.pushManager.getSubscription();
      if (suscripcion) {
        await fetch("/api/portal/push", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: suscripcion.endpoint }) });
        await suscripcion.unsubscribe();
      }
      setEstado("apagado");
      setMensaje("Avisos desactivados en este celular.");
    } catch {
      setMensaje("No se pudieron desactivar. Probá de nuevo.");
    } finally {
      setTrabajando(false);
    }
  }

  async function probar() {
    setTrabajando(true);
    const res = await fetch("/api/portal/push/prueba", { method: "POST" }).catch(() => null);
    const datos = res ? await res.json().catch(() => ({})) : {};
    setMensaje(res?.ok ? "Enviado. Debería llegarte en unos segundos." : datos.error || "No hay conexión.");
    setTrabajando(false);
  }

  if (estado === "cargando" || estado === "no_disponible") return null;

  return (
    <div className="p-card" style={{ marginTop: "1rem" }}>
      <strong style={{ color: "var(--azul-oscuro)" }}>🔔 Avisos en este celular</strong>
      {estado === "apagado" && (
        <>
          <p className="p-sub" style={{ margin: "0.4rem 0 0.7rem" }}>Enterate al momento cuando haya un recibo para firmar, una respuesta de RR.HH. o una noticia.</p>
          <button className="p-btn" onClick={activar} disabled={trabajando}>{trabajando ? "Activando…" : "Activar avisos"}</button>
        </>
      )}
      {estado === "prendido" && (
        <>
          <p className="p-sub" style={{ margin: "0.4rem 0 0.7rem" }}>Activados. Te avisamos por recibos, respuestas de RR.HH. y noticias.</p>
          <button className="p-btn sec chico" onClick={probar} disabled={trabajando}>Mandarme una prueba</button>{" "}
          <button className="p-btn sec chico" onClick={desactivar} disabled={trabajando}>Desactivar</button>
        </>
      )}
      {estado === "ios_instalar" && (
        <p className="p-sub" style={{ margin: "0.4rem 0 0" }}>
          En iPhone, primero agregá el portal a tu pantalla de inicio: tocá <strong>Compartir</strong> (el cuadrado con la flecha) y después{" "}
          <strong>Agregar a inicio</strong>. Abrilo desde ese ícono y vas a poder activar los avisos.
        </p>
      )}
      {estado === "bloqueado" && (
        <p className="p-sub" style={{ margin: "0.4rem 0 0" }}>
          Este celular tiene bloqueadas las notificaciones del portal. Para recibirlas, habilitalas desde los ajustes del navegador (Configuración del sitio → Notificaciones) y volvé a entrar.
        </p>
      )}
      {mensaje && <p className="p-pie" style={{ margin: "0.6rem 0 0" }} role="status">{mensaje}</p>}
    </div>
  );
}
