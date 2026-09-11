// FM RRHH — public/sw.js
// Service Worker de la terminal de asistencia (PWA). Cache-first para
// assets estáticos (modelos de reconocimiento, íconos, la librería de
// face-api desde el CDN) — así la terminal carga rápido incluso con wifi
// débil, y los modelos no se vuelven a bajar en cada visita.
//
// A propósito NO toca ninguna llamada a /api/ — esas siempre van directo
// a la red. El modo offline de las fichadas en sí ya está resuelto en
// app/terminal/page.tsx con su propia cola en localStorage; este Service
// Worker es solo para que la PANTALLA cargue, no para los datos.
const CACHE_NAME = "fm-terminal-v1";
const ASSETS_PROPIOS = [
  "/terminal",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_PROPIOS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((nombres) => Promise.all(nombres.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Nunca cachear ni interceptar la API — siempre en vivo.
  if (request.url.includes("/api/")) return;
  // Solo GET tiene sentido cachear.
  if (request.method !== "GET") return;

  const esModeloOIcono = request.url.includes("/models/") || request.url.includes("/icons/");
  const esCdnFaceApi = request.url.includes("cdn.jsdelivr.net");

  if (esModeloOIcono || esCdnFaceApi || ASSETS_PROPIOS.some((a) => request.url.endsWith(a))) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cacheado = await cache.match(request);
        if (cacheado) return cacheado;
        try {
          const respuestaRed = await fetch(request, esCdnFaceApi ? { mode: "no-cors" } : undefined);
          cache.put(request, respuestaRed.clone());
          return respuestaRed;
        } catch {
          return cacheado || Response.error();
        }
      })
    );
  }
  // Todo lo demás: comportamiento normal del navegador, sin tocar.
});
