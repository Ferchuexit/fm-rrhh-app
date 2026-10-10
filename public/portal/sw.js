// FM RRHH — public/portal/sw.js
// Lo que corre en el celular del empleado aunque el portal esté cerrado:
// recibe el aviso y lo muestra; al tocarlo, abre el portal en la pantalla
// que corresponde. No guarda nada ni trabaja sin conexión.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = {}; }
  e.waitUntil(
    self.registration.showNotification(d.titulo || "Portal del empleado", {
      body: d.cuerpo || "Tenés una novedad en el portal.",
      icon: "/portal/icono-192.png",
      badge: "/portal/icono-192.png",
      tag: d.tipo || "portal", // un aviso nuevo del mismo tipo reemplaza al anterior en vez de apilarse
      renotify: true,
      data: { url: typeof d.url === "string" && d.url.startsWith("/portal") ? d.url : "/portal" },
    })
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "/portal";
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((abiertas) => {
      for (const c of abiertas) {
        if (new URL(c.url).pathname.startsWith("/portal") && "focus" in c) {
          if ("navigate" in c) c.navigate(url);
          return c.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
