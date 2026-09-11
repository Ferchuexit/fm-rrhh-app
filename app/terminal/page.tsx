"use client";
import { useState, useEffect, useRef, type CSSProperties } from "react";

// FM RRHH — app/terminal/page.tsx
//
// La pantalla de kiosco — Fases 2 y 3 del Control de Asistencia. Corre en
// una tablet/celular en la ubicación del cliente, SIN sesión de usuario
// (se identifica con su dispositivoId, vinculado una vez con un código).
//
// REDISEÑO 10/09/2026 (según mockup de Fernando): header con logo de la
// empresa + fecha/hora en vivo, marco de cámara con esquinas guía,
// mensajes de bienvenida/despedida, y botones protegidos por PIN
// ("Registrar nuevo empleado", "Listado de empleados", "Configuración",
// "Fichar manualmente") — el PIN es por terminal (lo configura un admin
// desde /dispositivos, hash guardado, nunca en texto plano), NO el login
// real de un admin.
//
// DECISIÓN IMPORTANTE (10/09/2026, pedido explícito de Fernando después de
// 14 años lidiando con esto en clientes reales): la búsqueda manual por
// legajo/apellido NUNCA es un camino de autofichaje — se sacó de la
// pantalla principal a propósito. Dejarla ahí abría la puerta a que
// alguien fiche por otro con solo tocar un nombre de una lista, que es
// justo lo que el reconocimiento biométrico existe para evitar. La única
// forma de fichar sin la cámara es "Fichar manualmente (excepción)",
// protegido por PIN — así una excepción real (cámara rota, alguien sin
// registrar todavía) queda con un responsable identificado detrás, no es
// autoservicio.
//
// MODO OFFLINE (punto 9 del documento original): si falla la conexión al
// fichar, la fichada se guarda en localStorage y se reintenta sola cada 15
// segundos y apenas el navegador detecta que volvió el internet.
//
// RECONOCIMIENTO FACIAL: corre ENTERAMENTE en este navegador (face-api.js
// desde CDN + modelos en /public/models) contra los descriptores de la
// empresa. Si reconoce con buena confianza, selecciona el legajo solo — el
// empleado igual tiene que tocar "Registrar Ingreso/Salida" a mano. Si
// detecta una cara pero NO coincide con nadie, suena un aviso y muestra
// "No reconocido" (con un enfriamiento de 4 segundos, para no repetir el
// sonido en cada cuadro mientras la persona sigue ahí parada).
declare global {
  interface Window {
    faceapi: any;
  }
}
const CDN_FACEAPI = "https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js";
const UMBRAL_DISTANCIA = 0.5;
const UMBRAL_REPOSO_MS = 45000; // 45s sin ninguna cara detectada → pantalla de reposo

// Tonos generados con Web Audio — no son archivos de audio (nada que
// licenciar ni que bajar), un osciloscopio simple alcanza para un "ok" y
// un "rechazado" reconocibles.
function sonido(frecuencia: number, duracionMs: number, tipo: OscillatorType = "sine") {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = tipo;
    osc.frequency.value = frecuencia;
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duracionMs / 1000);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duracionMs / 1000);
  } catch {
    // algún navegador puede bloquear audio sin interacción previa del usuario — no es crítico, la pantalla sigue andando igual
  }
}
function sonidoOk() {
  sonido(880, 150);
  setTimeout(() => sonido(1200, 150), 130);
}
function sonidoRechazo() {
  sonido(220, 300, "square");
}

const CLAVE_DISPOSITIVO = "terminal.dispositivoId";
const CLAVE_NOMBRE = "terminal.nombreDispositivo";
const CLAVE_LOGO = "terminal.logoUrl";
const CLAVE_COLA = "terminal.colaPendiente";

interface Legajo {
  id: string;
  numeroLegajo: number;
  apellido: string;
  nombre: string;
  biometriaActiva?: boolean;
}
interface DescriptorBiometrico {
  legajoId: string;
  numeroLegajo: number;
  apellido: string;
  nombre: string;
  descriptor: number[];
}
interface FichadaPendiente {
  tempId: string;
  legajoId: string;
  legajoLabel: string;
  tipo: "entrada" | "salida";
  horaLocal: string;
}
type PantallaAdmin = "pin" | "enrolar" | "listado" | "configuracion" | "manual" | null;
type Destino = "enrolar" | "listado" | "configuracion" | "manual";

function leerCola(): FichadaPendiente[] {
  try {
    return JSON.parse(localStorage.getItem(CLAVE_COLA) ?? "[]");
  } catch {
    return [];
  }
}
function guardarCola(cola: FichadaPendiente[]) {
  localStorage.setItem(CLAVE_COLA, JSON.stringify(cola));
}

export default function TerminalPage() {
  const [dispositivoId, setDispositivoId] = useState<string | null>(null);
  const [nombreDispositivo, setNombreDispositivo] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [codigo, setCodigo] = useState("");
  const [errorVinculacion, setErrorVinculacion] = useState("");
  const [vinculando, setVinculando] = useState(false);

  const [legajos, setLegajos] = useState<Legajo[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [seleccionado, setSeleccionado] = useState<Legajo | null>(null);
  const [confianzaSeleccion, setConfianzaSeleccion] = useState<number | null>(null); // score real (0.5-1) si vino de la cámara; 0 si fue manual — nunca null en un fichaje real, así se puede distinguir de una fichada importada de reloj
  const [confirmacion, setConfirmacion] = useState<{ texto: string; subtexto?: string; ok: boolean } | null>(null);
  const [cola, setCola] = useState<FichadaPendiente[]>([]);
  const [ahora, setAhora] = useState(new Date());

  // ── Reconocimiento facial ──
  const videoRef = useRef<HTMLVideoElement>(null);
  const [descriptores, setDescriptores] = useState<DescriptorBiometrico[]>([]);
  const [modelosListos, setModelosListos] = useState(false);
  const [camaraLista, setCamaraLista] = useState(false);
  const [reconocido, setReconocido] = useState<string | null>(null);
  const [rechazado, setRechazado] = useState(false);
  const [reposo, setReposo] = useState(false);
  const reconociendoRef = useRef(false);
  const ultimoRechazoRef = useRef(0);
  const ultimoFichadoRef = useRef<{ legajoId: string; ts: number } | null>(null);
  const ultimaActividadRef = useRef(Date.now());

  // ── Modo administración (PIN) ──
  const [pantallaAdmin, setPantallaAdmin] = useState<PantallaAdmin>(null);
  const [destinoPendiente, setDestinoPendiente] = useState<Destino | null>(null);
  const [pinInput, setPinInput] = useState("");
  const [pinVerificado, setPinVerificado] = useState<string | null>(null); // el PIN en sí, en memoria, para mandarlo en las llamadas que lo necesitan — se pierde al volver a fichar
  const [errorPin, setErrorPin] = useState("");
  const [enrolarBusqueda, setEnrolarBusqueda] = useState("");
  const [enrolarLegajo, setEnrolarLegajo] = useState<Legajo | null>(null);
  const [enrolarMensaje, setEnrolarMensaje] = useState<{ texto: string; ok: boolean } | null>(null);
  const [listadoBusqueda, setListadoBusqueda] = useState("");
  const [configPinNuevo, setConfigPinNuevo] = useState("");
  const [configMensaje, setConfigMensaje] = useState("");

  // ── Reloj en vivo ──
  useEffect(() => {
    const t = setInterval(() => setAhora(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // ── PWA: Service Worker (cachea assets para que cargue rápido) y Wake
  // Lock (pantalla siempre prendida — pensado para el tablet fijo a la
  // pared que describiste). El Wake Lock se libera solo cuando la pestaña
  // pierde foco/visibilidad, por eso se vuelve a pedir cada vez que
  // vuelve a estar visible.
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    let wakeLock: any = null;
    async function pedirWakeLock() {
      try {
        if ("wakeLock" in navigator) wakeLock = await (navigator as any).wakeLock.request("screen");
      } catch {
        // algunos navegadores lo bloquean sin interacción previa del usuario — no es crítico
      }
    }
    pedirWakeLock();
    function alVolverVisible() {
      if (document.visibilityState === "visible") pedirWakeLock();
    }
    document.addEventListener("visibilitychange", alVolverVisible);
    return () => document.removeEventListener("visibilitychange", alVolverVisible);
  }, []);

  // ── Reposo: si pasan 45s sin detectar ninguna cara (y no hay nada más
  // pasando en pantalla), se atenúa la pantalla. Cualquier cara detectada
  // la despierta — ver reconocerCara().
  useEffect(() => {
    if (seleccionado || confirmacion || pantallaAdmin) return;
    const t = setInterval(() => {
      if (Date.now() - ultimaActividadRef.current > UMBRAL_REPOSO_MS) setReposo(true);
    }, 5000);
    return () => clearInterval(t);
  }, [seleccionado, confirmacion, pantallaAdmin]);

  // ── Cargar dispositivo ya vinculado, si lo hay — o vincular solo si
  // llegamos acá con ?codigo=XXXXXX en la URL (desde un QR) ──
  useEffect(() => {
    const id = localStorage.getItem(CLAVE_DISPOSITIVO);
    const nombre = localStorage.getItem(CLAVE_NOMBRE);
    const logo = localStorage.getItem(CLAVE_LOGO);
    if (id) {
      setDispositivoId(id);
      setNombreDispositivo(nombre ?? "");
      setLogoUrl(logo || null);
    } else {
      const codigoUrl = new URLSearchParams(window.location.search).get("codigo");
      if (codigoUrl) {
        setCodigo(codigoUrl);
        vincularConCodigo(codigoUrl);
      }
    }
    setCola(leerCola());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Una vez vinculado: cargar legajos, heartbeat (que también trae el
  // logo actualizado), sincronizar la cola, y arrancar reconocimiento facial ──
  useEffect(() => {
    if (!dispositivoId) return;
    cargarLegajos();
    cargarDescriptoresYModelos();
    const heartbeat = () => {
      fetch("/api/dispositivos/heartbeat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dispositivoId }) })
        .then((r) => {
          // El servidor deja de reconocer este dispositivo si alguien le
          // generó un código nuevo desde /dispositivos (eso desvincula al
          // toque, sin que la terminal se entere hasta el próximo
          // heartbeat) — antes esto fallaba en silencio para siempre; ahora
          // la terminal misma se da cuenta y vuelve a pedir el código.
          if (r.status === 404) {
            manejarDesvinculacion();
            return null;
          }
          return r.ok ? r.json() : null;
        })
        .then((data) => {
          if (data?.logoUrl) {
            setLogoUrl(data.logoUrl);
            localStorage.setItem(CLAVE_LOGO, data.logoUrl);
          }
        })
        .catch(() => {});
    };
    heartbeat();
    const heartbeatInterval = setInterval(heartbeat, 2 * 60000);
    const syncInterval = setInterval(sincronizarCola, 15000);
    window.addEventListener("online", sincronizarCola);
    return () => {
      clearInterval(heartbeatInterval);
      clearInterval(syncInterval);
      window.removeEventListener("online", sincronizarCola);
      const stream = videoRef.current?.srcObject as MediaStream | undefined;
      stream?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispositivoId]);

  // ── Loop de reconocimiento — solo en la pantalla principal de fichaje ──
  useEffect(() => {
    if (!modelosListos || !camaraLista || seleccionado || confirmacion || pantallaAdmin) return;
    const intervalo = setInterval(reconocerCara, 1200);
    return () => clearInterval(intervalo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelosListos, camaraLista, seleccionado, confirmacion, pantallaAdmin, descriptores]);

  function cargarDescriptoresYModelos() {
    const seguir = () => {
      cargarModelos();
      fetch("/api/dispositivos/biometria", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dispositivoId }) })
        .then((r) => (r.ok ? r.json() : []))
        .then(setDescriptores)
        .catch(() => {});
    };
    if (window.faceapi) {
      seguir();
      return;
    }
    const script = document.createElement("script");
    script.src = CDN_FACEAPI;
    script.onload = seguir;
    document.head.appendChild(script);
  }

  async function cargarModelos() {
    try {
      await window.faceapi.nets.tinyFaceDetector.loadFromUri("/models");
      await window.faceapi.nets.faceLandmark68Net.loadFromUri("/models");
      await window.faceapi.nets.faceRecognitionNet.loadFromUri("/models");
      setModelosListos(true);
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setCamaraLista(true);
      }
    } catch {
      // sin cámara o sin modelos — la pantalla sigue andando con búsqueda manual nada más
    }
  }

  async function reconocerCara() {
    if (reconociendoRef.current || !videoRef.current || descriptores.length === 0) return;
    reconociendoRef.current = true;
    try {
      const deteccion = await window.faceapi
        .detectSingleFace(videoRef.current, new window.faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptor();
      if (deteccion) {
        ultimaActividadRef.current = Date.now();
        setReposo(false);
        let mejor: { d: DescriptorBiometrico; distancia: number } | null = null;
        for (const d of descriptores) {
          const distancia = window.faceapi.euclideanDistance(deteccion.descriptor, d.descriptor);
          if (!mejor || distancia < mejor.distancia) mejor = { d, distancia };
        }
        if (mejor && mejor.distancia < UMBRAL_DISTANCIA) {
          const yaFichadoHacePoco = ultimoFichadoRef.current?.legajoId === mejor.d.legajoId && Date.now() - ultimoFichadoRef.current.ts < 30000;
          if (yaFichadoHacePoco) {
            reconociendoRef.current = false;
            return;
          }
          ultimoFichadoRef.current = { legajoId: mejor.d.legajoId, ts: Date.now() };
          sonidoOk();
          setReconocido(`${mejor.d.apellido}, ${mejor.d.nombre}`);
          setConfianzaSeleccion(Math.max(0.01, 1 - mejor.distancia));
          setSeleccionado({ id: mejor.d.legajoId, numeroLegajo: mejor.d.numeroLegajo, apellido: mejor.d.apellido, nombre: mejor.d.nombre });
          setTimeout(() => setReconocido(null), 2000);
        } else if (Date.now() - ultimoRechazoRef.current > 4000) {
          // Hay una cara ahí, pero no coincide con nadie registrado — avisar,
          // pero solo una vez cada 4 segundos, no en cada cuadro mientras la
          // persona sigue parada frente a la cámara.
          ultimoRechazoRef.current = Date.now();
          sonidoRechazo();
          setRechazado(true);
          setTimeout(() => setRechazado(false), 2000);
        }
      }
    } catch {
      // un frame fallido no importa, se reintenta en el próximo ciclo
    }
    reconociendoRef.current = false;
  }

  async function cargarLegajos() {
    try {
      const res = await fetch("/api/dispositivos/legajos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dispositivoId }) });
      if (res.ok) setLegajos(await res.json());
    } catch {
      // sin conexión — se reintenta la próxima vez que se abra la pantalla o se sincronice
    }
  }

  async function sincronizarCola() {
    const pendientes = leerCola();
    if (pendientes.length === 0) return;
    const restantes: FichadaPendiente[] = [];
    for (const f of pendientes) {
      try {
        const res = await fetch("/api/fichadas/terminal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dispositivoId, legajoId: f.legajoId, tipo: f.tipo }),
        });
        if (!res.ok) throw new Error();
      } catch {
        restantes.push(f);
      }
    }
    guardarCola(restantes);
    setCola(restantes);
  }

  async function vincular() {
    if (!codigo.trim()) return;
    await vincularConCodigo(codigo.trim());
  }

  async function vincularConCodigo(codigoAUsar: string) {
    setVinculando(true);
    setErrorVinculacion("");
    try {
      const res = await fetch("/api/dispositivos/vincular", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ codigo: codigoAUsar }) });
      const data = await res.json();
      if (!res.ok) {
        setErrorVinculacion(data.error);
        setVinculando(false);
        return;
      }
      localStorage.setItem(CLAVE_DISPOSITIVO, data.dispositivoId);
      localStorage.setItem(CLAVE_NOMBRE, data.nombre);
      if (data.logoUrl) localStorage.setItem(CLAVE_LOGO, data.logoUrl);
      setDispositivoId(data.dispositivoId);
      setNombreDispositivo(data.nombre);
      setLogoUrl(data.logoUrl || null);
    } catch {
      setErrorVinculacion("No se pudo conectar — revisá el internet de la tablet e intentá de nuevo.");
    }
    setVinculando(false);
  }

  async function ficharAhora() {
    if (!seleccionado) return;
    const legajoLabel = `${seleccionado.apellido}, ${seleccionado.nombre}`;
    const horaLocal = new Date().toLocaleTimeString("es-AR");

    try {
      const res = await fetch("/api/fichadas/terminal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dispositivoId, legajoId: seleccionado.id, nivelConfianza: confianzaSeleccion }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      const saludo = data.tipo === "entrada" ? `¡Bienvenido/a, ${seleccionado.nombre}!` : `¡Buen descanso, ${seleccionado.nombre}!`;
      setConfirmacion({ texto: saludo, subtexto: `${data.tipo === "entrada" ? "Ingreso" : "Egreso"} registrado — ${data.hora}`, ok: true });
    } catch {
      // Sin conexión no sabemos cuántas fichadas tiene hoy — se guarda como
      // "entrada" provisorio; si en realidad correspondía salida, se
      // corrige a mano en /fichadas cuando vuelva la señal. Es la única
      // excepción donde el server no puede decidir por vos.
      const nueva: FichadaPendiente = { tempId: crypto.randomUUID(), legajoId: seleccionado.id, legajoLabel, tipo: "entrada", horaLocal };
      const nuevaCola = [...leerCola(), nueva];
      guardarCola(nuevaCola);
      setCola(nuevaCola);
      setConfirmacion({ texto: `Guardado sin conexión — ${legajoLabel}`, subtexto: "Se sincroniza solo apenas vuelva el internet", ok: false });
    }

    setSeleccionado(null);
    setConfianzaSeleccion(null);
    setBusqueda("");
    setTimeout(() => setConfirmacion(null), 3500);
  }

  // ── Auto-confirmar a los 1.5s de reconocer a alguien, salvo que se cancele ──
  useEffect(() => {
    if (!seleccionado) return;
    const t = setTimeout(ficharAhora, 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seleccionado]);

  // ── Modo administración ──
  function pedirPinPara(destino: Destino) {
    setDestinoPendiente(destino);
    setPantallaAdmin("pin");
    setPinInput("");
    setErrorPin("");
  }

  async function verificarPin() {
    setErrorPin("");
    try {
      const res = await fetch("/api/dispositivos/verificar-pin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dispositivoId, pin: pinInput }) });
      const data = await res.json();
      if (!res.ok) {
        setErrorPin(data.error);
        return;
      }
      setPinVerificado(pinInput);
      setPantallaAdmin(destinoPendiente);
      setDestinoPendiente(null);
      setPinInput("");
    } catch {
      setErrorPin("No se pudo conectar — revisá el internet.");
    }
  }

  function volverAFichar() {
    setPantallaAdmin(null);
    setDestinoPendiente(null);
    setPinVerificado(null);
    setEnrolarLegajo(null);
    setEnrolarBusqueda("");
    setEnrolarMensaje(null);
    setListadoBusqueda("");
    setConfigPinNuevo("");
    setConfigMensaje("");
  }

  async function capturarYEnrolar() {
    if (!videoRef.current || !enrolarLegajo || !pinVerificado) return;
    setEnrolarMensaje(null);
    try {
      const deteccion = await window.faceapi
        .detectSingleFace(videoRef.current, new window.faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptor();
      if (!deteccion) {
        setEnrolarMensaje({ texto: "No se detectó ninguna cara — acercate más, con buena luz.", ok: false });
        return;
      }
      const descriptor = Array.from(deteccion.descriptor as Float32Array);
      const res = await fetch("/api/dispositivos/biometria/enrolar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dispositivoId, pin: pinVerificado, legajoId: enrolarLegajo.id, descriptor }),
      });
      const data = await res.json();
      if (!res.ok) {
        setEnrolarMensaje({ texto: data.error, ok: false });
        return;
      }
      setEnrolarMensaje({ texto: `✔ Registrado — ${enrolarLegajo.apellido}, ${enrolarLegajo.nombre}`, ok: true });
      cargarDescriptoresYModelos(); // refrescar la lista de descriptores para que reconozca a esta persona ya mismo
      cargarLegajos();
    } catch (e: any) {
      setEnrolarMensaje({ texto: "Error inesperado: " + e.message, ok: false });
    }
  }

  async function cambiarPin() {
    if (!/^\d{4,6}$/.test(configPinNuevo)) {
      setConfigMensaje("El PIN nuevo tiene que tener entre 4 y 6 números.");
      return;
    }
    const res = await fetch("/api/dispositivos/pin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dispositivoId, pin: configPinNuevo }) });
    const data = await res.json();
    if (!res.ok) {
      setConfigMensaje(data.error);
      return;
    }
    setConfigMensaje("✔ PIN actualizado.");
    setConfigPinNuevo("");
  }

  function manejarDesvinculacion() {
    localStorage.removeItem(CLAVE_DISPOSITIVO);
    localStorage.removeItem(CLAVE_NOMBRE);
    localStorage.removeItem(CLAVE_LOGO);
    setDispositivoId(null);
    setErrorVinculacion("Esta terminal se desvinculó (alguien generó un código nuevo desde /dispositivos) — ingresá el código actual para reconectarla.");
  }

  function desvincularDispositivo() {
    if (!confirm("¿Desvincular esta terminal? Vas a tener que volver a ingresar un código para usarla de nuevo.")) return;
    localStorage.removeItem(CLAVE_DISPOSITIVO);
    localStorage.removeItem(CLAVE_NOMBRE);
    localStorage.removeItem(CLAVE_LOGO);
    window.location.reload();
  }

  const resultados = busqueda.trim()
    ? legajos.filter((l) => `${l.numeroLegajo} ${l.apellido} ${l.nombre}`.toLowerCase().includes(busqueda.toLowerCase())).slice(0, 8)
    : [];
  const resultadosEnrolar = enrolarBusqueda.trim()
    ? legajos.filter((l) => `${l.numeroLegajo} ${l.apellido} ${l.nombre}`.toLowerCase().includes(enrolarBusqueda.toLowerCase())).slice(0, 8)
    : [];
  const resultadosListado = legajos.filter((l) =>
    listadoBusqueda.trim() ? `${l.numeroLegajo} ${l.apellido} ${l.nombre}`.toLowerCase().includes(listadoBusqueda.toLowerCase()) : true
  );

  const fechaFormateada = ahora.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const horaFormateada = ahora.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });

  function Encabezado() {
    return (
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", maxWidth: "900px", marginBottom: "1.5rem", padding: "0 0.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" style={{ height: "40px", maxWidth: "120px", objectFit: "contain", background: "white", borderRadius: "8px", padding: "4px" }} />
          ) : (
            <div style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(255,255,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem" }}>🕒</div>
          )}
          <div>
            <div style={{ color: "white", fontWeight: 700, fontSize: "1rem" }}>Control de Asistencia</div>
            <div style={{ color: "rgba(255,255,255,0.55)", fontSize: "0.75rem" }}>{nombreDispositivo}</div>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.75rem", textTransform: "capitalize" }}>{fechaFormateada}</div>
          <div style={{ color: "white", fontSize: "1.4rem", fontWeight: 700 }}>{horaFormateada}</div>
        </div>
      </div>
    );
  }

  const cajaBlanca: CSSProperties = { background: "white", borderRadius: "16px", padding: "2rem", maxWidth: "480px", width: "100%", boxShadow: "0 10px 40px rgba(0,0,0,0.25)" };

  // ── Pantalla de vinculación (primera vez) ──
  if (!dispositivoId) {
    return (
      <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(180deg, #0d2540, #163A5C)" }}>
        <div style={{ ...cajaBlanca, maxWidth: "380px", textAlign: "center" }}>
          <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#EEF1F4", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.4rem", margin: "0 auto 0.75rem" }}>🕒</div>
          <h1 style={{ fontSize: "1.2rem", marginBottom: "0.2rem" }}>Control de Asistencia</h1>
          <p style={{ opacity: 0.6, marginBottom: "1.5rem", fontSize: "0.85rem" }}>FM Software</p>
          <p style={{ fontSize: "0.9rem", marginBottom: "1rem" }}>Ingresá el código que te dieron para vincular esta terminal:</p>
          <input
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            placeholder="000000"
            style={{ fontSize: "1.5rem", textAlign: "center", letterSpacing: "0.3em", width: "100%", padding: "0.6rem", marginBottom: "1rem" }}
            inputMode="numeric"
          />
          <button onClick={vincular} disabled={vinculando} style={{ width: "100%", padding: "0.75rem", fontSize: "1rem" }}>
            {vinculando ? "Vinculando..." : "Vincular"}
          </button>
          {errorVinculacion && <p style={{ color: "#B23A3A", fontSize: "0.85rem", marginTop: "1rem" }}>{errorVinculacion}</p>}
        </div>
      </main>
    );
  }

  // ── A PARTIR DE ACÁ: una sola estructura persistente ──
  //
  // FIX 11/09/2026 (bug real que Fernando encontró probando con la
  // familia): antes, cada "pantalla" (confirmación, fichando, PIN,
  // listado...) era un return por separado — la cámara se reiniciaba de
  // cero cada vez que React saltaba de un return a otro, porque el
  // <video> literalmente se destruía y se volvía a crear. Después de
  // fichar una vez, la cámara quedaba negra hasta refrescar el
  // navegador — inaceptable para una fila de gente esperando fichar.
  //
  // Ahora el <video> vive en un solo lugar del árbol, SIEMPRE montado
  // mientras haya dispositivoId — nunca se destruye. Las demás pantallas
  // se dibujan como capas superpuestas (position: fixed) encima, con
  // z-index más alto. Cuando desaparecen, la cámara de abajo sigue viva,
  // con la misma conexión de siempre, sin cortes.
  const capaCompleta: CSSProperties = { position: "fixed", inset: 0, zIndex: 20, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "2rem" };
  const capaCompletaScroll: CSSProperties = { position: "fixed", inset: 0, zIndex: 20, display: "flex", flexDirection: "column", alignItems: "center", padding: "2rem 1.5rem", overflowY: "auto" };

  return (
    <main
      onClick={() => { ultimaActividadRef.current = Date.now(); setReposo(false); }}
      style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", background: "linear-gradient(180deg, #0d2540, #163A5C)", padding: "1.5rem 1.5rem 2rem", position: "relative" }}
    >
      <Encabezado />

      {/* ── Capa base: cámara, SIEMPRE montada mientras haya dispositivoId ── */}
      <div style={{ position: "relative", width: "100%", maxWidth: "420px", marginBottom: "1.25rem" }}>
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          style={{ width: "100%", aspectRatio: "4/3", objectFit: "cover", borderRadius: "16px", background: "#000", transform: "scaleX(-1)", display: camaraLista ? "block" : "none", boxShadow: "0 8px 30px rgba(0,0,0,0.3)" }}
        />
        {camaraLista && !pantallaAdmin && !seleccionado && !confirmacion && (
          // Esquinas guía — solo en la pantalla principal, puramente visual
          <div style={{ position: "absolute", inset: "12%", pointerEvents: "none" }}>
            {[
              { top: 0, left: 0, borderWidth: "3px 0 0 3px" },
              { top: 0, right: 0, borderWidth: "3px 3px 0 0" },
              { bottom: 0, left: 0, borderWidth: "0 0 3px 3px" },
              { bottom: 0, right: 0, borderWidth: "0 3px 3px 0" },
            ].map((esquina, i) => (
              <div key={i} style={{ position: "absolute", width: "32px", height: "32px", borderColor: "rgba(255,255,255,0.85)", borderStyle: "solid", ...esquina }} />
            ))}
          </div>
        )}
        {!camaraLista && (
          <p style={{ color: "rgba(255,255,255,0.5)", textAlign: "center", fontSize: "0.85rem" }}>
            {modelosListos ? "Sin cámara — usá \"Fichar manualmente\"." : "Cargando reconocimiento facial..."}
          </p>
        )}
        {reconocido && !pantallaAdmin && (
          <div style={{ position: "absolute", bottom: "0.75rem", left: "0.75rem", right: "0.75rem", background: "rgba(47,111,94,0.92)", color: "white", padding: "0.6rem", borderRadius: "8px", textAlign: "center", fontSize: "0.9rem", fontWeight: 600 }}>
            ✔ Reconocido: {reconocido}
          </div>
        )}
        {rechazado && !reconocido && !pantallaAdmin && (
          <div style={{ position: "absolute", bottom: "0.75rem", left: "0.75rem", right: "0.75rem", background: "rgba(184,58,58,0.92)", color: "white", padding: "0.6rem", borderRadius: "8px", textAlign: "center", fontSize: "0.9rem", fontWeight: 600 }}>
            ✕ No reconocido — pedile a un encargado que te registre
          </div>
        )}
        {!reconocido && !rechazado && camaraLista && !pantallaAdmin && !seleccionado && !confirmacion && (
          <p style={{ position: "absolute", bottom: "0.6rem", left: 0, right: 0, textAlign: "center", color: "rgba(255,255,255,0.75)", fontSize: "0.8rem" }}>Por favor, mire a la cámara</p>
        )}
      </div>

      {/* ── Debajo de la cámara: contenido que cambia según la pantalla, pero SIN tapar el video de arriba ── */}
      {pantallaAdmin === "enrolar" ? (
        <div style={{ ...cajaBlanca, marginBottom: "1.5rem" }}>
          <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>Registrar nuevo empleado</h2>
          {!enrolarLegajo ? (
            <>
              <p style={{ fontSize: "0.85rem", opacity: 0.7 }}>Buscá al empleado (el legajo tiene que existir ya, cargado desde la oficina):</p>
              <input value={enrolarBusqueda} onChange={(e) => setEnrolarBusqueda(e.target.value)} placeholder="Legajo o apellido..." style={{ width: "100%", padding: "0.6rem", marginBottom: "0.75rem" }} autoFocus />
              {resultadosEnrolar.map((l) => (
                <button key={l.id} onClick={() => setEnrolarLegajo(l)} style={{ display: "block", width: "100%", textAlign: "left", padding: "0.7rem", marginBottom: "0.4rem", background: "#f8f9fc", border: "1px solid #eee" }}>
                  <strong>{l.numeroLegajo}</strong> — {l.apellido}, {l.nombre} {l.biometriaActiva && <span style={{ color: "#2F6F5E", fontSize: "0.8rem" }}>(ya registrado — esto lo reemplaza)</span>}
                </button>
              ))}
            </>
          ) : (
            <>
              <p style={{ fontSize: "0.9rem" }}>Usando la cámara de arriba — <strong>{enrolarLegajo.numeroLegajo}</strong> — {enrolarLegajo.apellido}, {enrolarLegajo.nombre}</p>
              <button onClick={capturarYEnrolar} style={{ width: "100%", padding: "0.75rem", marginBottom: "0.5rem" }}>Capturar y registrar</button>
              <button onClick={() => { setEnrolarLegajo(null); setEnrolarMensaje(null); }} style={{ width: "100%", padding: "0.5rem", background: "white", border: "1px solid #ccc" }}>Elegir otro</button>
              {enrolarMensaje && <p style={{ color: enrolarMensaje.ok ? "#2F6F5E" : "#B23A3A", fontSize: "0.85rem", marginTop: "0.75rem" }}>{enrolarMensaje.texto}</p>}
            </>
          )}
          <button onClick={volverAFichar} style={{ width: "100%", padding: "0.5rem", marginTop: "1rem", background: "none", border: "none", color: "#1b3468", textDecoration: "underline" }}>← Volver a fichar</button>
        </div>
      ) : !pantallaAdmin && !seleccionado && !confirmacion ? (
        <>
          <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", justifyContent: "center", width: "100%", maxWidth: "700px" }}>
            <button onClick={() => pedirPinPara("enrolar")} style={{ flex: "1 1 180px", padding: "0.9rem", fontSize: "0.85rem", background: "rgba(255,255,255,0.1)", color: "white", border: "1px solid rgba(255,255,255,0.25)", borderRadius: "8px" }}>
              👤➕ Registrar nuevo empleado
              <div style={{ fontSize: "0.7rem", opacity: 0.6, marginTop: "2px" }}>(solo personal autorizado)</div>
            </button>
            <button onClick={() => pedirPinPara("listado")} style={{ flex: "1 1 180px", padding: "0.9rem", fontSize: "0.85rem", background: "rgba(255,255,255,0.1)", color: "white", border: "1px solid rgba(255,255,255,0.25)", borderRadius: "8px" }}>
              👥 Listado de empleados
              <div style={{ fontSize: "0.7rem", opacity: 0.6, marginTop: "2px" }}>(solo personal autorizado)</div>
            </button>
            <button onClick={() => pedirPinPara("manual")} style={{ flex: "1 1 180px", padding: "0.9rem", fontSize: "0.85rem", background: "rgba(255,255,255,0.1)", color: "white", border: "1px solid rgba(255,255,255,0.25)", borderRadius: "8px" }}>
              🖊️ Fichar manualmente
              <div style={{ fontSize: "0.7rem", opacity: 0.6, marginTop: "2px" }}>(excepción — solo personal autorizado)</div>
            </button>
            <button onClick={() => pedirPinPara("configuracion")} style={{ flex: "1 1 180px", padding: "0.9rem", fontSize: "0.85rem", background: "rgba(255,255,255,0.1)", color: "white", border: "1px solid rgba(255,255,255,0.25)", borderRadius: "8px" }}>
              ⚙️ Configuración
              <div style={{ fontSize: "0.7rem", opacity: 0.6, marginTop: "2px" }}>(solo personal autorizado)</div>
            </button>
          </div>
          <div style={{ marginTop: "1.25rem", textAlign: "center", fontSize: "0.75rem", color: "rgba(255,255,255,0.5)" }}>
            {cola.length > 0 ? `🟠 ${cola.length} fichada${cola.length > 1 ? "s" : ""} pendiente${cola.length > 1 ? "s" : ""} de sincronización` : "🟢 Conectado"}
            {" · FM Terminal v1.0"}
          </div>
        </>
      ) : null}

      {/* ── Reposo: se superpone, pero la cámara de abajo sigue detectando ── */}
      {reposo && !pantallaAdmin && !seleccionado && !confirmacion && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(13,37,64,0.92)", zIndex: 15, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "white" }}>
          {logoUrl && <img src={logoUrl} alt="Logo" style={{ height: "56px", maxWidth: "160px", objectFit: "contain", marginBottom: "1.5rem", opacity: 0.9 }} />}
          <div style={{ fontSize: "3rem", fontWeight: 700 }}>{horaFormateada}</div>
          <div style={{ fontSize: "0.9rem", opacity: 0.6, textTransform: "capitalize", marginTop: "0.3rem" }}>{fechaFormateada}</div>
          <p style={{ marginTop: "2rem", opacity: 0.5, fontSize: "0.85rem" }}>Acercate para fichar</p>
        </div>
      )}

      {/* ── Confirmando (1.5s, cancelable) — capa completa, la cámara sigue viva debajo ── */}
      {seleccionado && !confirmacion && (
        <div style={capaCompleta}>
          <div style={{ ...cajaBlanca, textAlign: "center" }}>
            <p style={{ opacity: 0.6, marginBottom: "0.3rem" }}>Legajo {seleccionado.numeroLegajo}</p>
            <h2 style={{ marginTop: 0, marginBottom: "1.5rem" }}>{seleccionado.apellido}, {seleccionado.nombre}</h2>
            <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>⏳</div>
            <p style={{ opacity: 0.6, marginBottom: "1.5rem", fontSize: "0.9rem" }}>Fichando...</p>
            <button onClick={() => { setSeleccionado(null); setConfianzaSeleccion(null); }} style={{ padding: "0.7rem 1.5rem", background: "white", border: "1px solid #ccc" }}>
              No soy yo — cancelar
            </button>
          </div>
        </div>
      )}

      {/* ── Confirmación (después de fichar) ── */}
      {confirmacion && (
        <div style={{ ...capaCompleta, background: confirmacion.ok ? "#2F6F5E" : "#B8752B" }}>
          <div style={{ textAlign: "center", color: "white" }}>
            <div style={{ fontSize: "4rem" }}>{confirmacion.ok ? "✔" : "🟠"}</div>
            <p style={{ fontSize: "1.6rem", fontWeight: 700, marginTop: "1rem", maxWidth: "500px" }}>{confirmacion.texto}</p>
            {confirmacion.subtexto && <p style={{ fontSize: "1rem", opacity: 0.85, marginTop: "0.4rem" }}>{confirmacion.subtexto}</p>}
          </div>
        </div>
      )}

      {/* ── PIN ── */}
      {pantallaAdmin === "pin" && (
        <div style={{ ...capaCompleta, background: "linear-gradient(180deg, #0d2540, #163A5C)" }}>
          <div style={{ ...cajaBlanca, maxWidth: "340px", textAlign: "center" }}>
            <p style={{ fontSize: "0.9rem", marginBottom: "1rem" }}>PIN de administración</p>
            <input
              autoFocus
              type="password"
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && verificarPin()}
              placeholder="••••"
              inputMode="numeric"
              style={{ fontSize: "1.5rem", textAlign: "center", letterSpacing: "0.3em", width: "100%", padding: "0.6rem", marginBottom: "1rem" }}
            />
            <button onClick={verificarPin} style={{ width: "100%", padding: "0.75rem", fontSize: "1rem", marginBottom: "0.5rem" }}>Ingresar</button>
            <button onClick={volverAFichar} style={{ width: "100%", padding: "0.5rem", background: "white", border: "1px solid #ccc" }}>Cancelar</button>
            {errorPin && <p style={{ color: "#B23A3A", fontSize: "0.85rem", marginTop: "1rem" }}>{errorPin}</p>}
          </div>
        </div>
      )}

      {/* ── Listado de empleados ── */}
      {pantallaAdmin === "listado" && (
        <div style={{ ...capaCompletaScroll, background: "linear-gradient(180deg, #0d2540, #163A5C)" }}>
          <div style={{ ...cajaBlanca, maxHeight: "70vh", overflowY: "auto" }}>
            <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>Listado de empleados</h2>
            <input value={listadoBusqueda} onChange={(e) => setListadoBusqueda(e.target.value)} placeholder="Buscar..." style={{ width: "100%", padding: "0.6rem", marginBottom: "0.75rem" }} autoFocus />
            {resultadosListado.map((l) => (
              <div key={l.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.6rem 0", borderBottom: "1px solid #eee" }}>
                <div style={{ fontSize: "0.9rem" }}><strong>{l.numeroLegajo}</strong> — {l.apellido}, {l.nombre}</div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  {l.biometriaActiva ? <span style={{ color: "#2F6F5E", fontSize: "0.75rem" }}>🟢 Registrado</span> : <span style={{ opacity: 0.4, fontSize: "0.75rem" }}>Sin registrar</span>}
                  <button onClick={() => { setEnrolarLegajo(l); setPantallaAdmin("enrolar"); }} style={{ fontSize: "0.75rem" }}>{l.biometriaActiva ? "Actualizar" : "Registrar"}</button>
                </div>
              </div>
            ))}
            <button onClick={volverAFichar} style={{ width: "100%", padding: "0.5rem", marginTop: "1rem", background: "none", border: "none", color: "#1b3468", textDecoration: "underline" }}>← Volver a fichar</button>
          </div>
        </div>
      )}

      {/* ── Configuración ── */}
      {pantallaAdmin === "configuracion" && (
        <div style={{ ...capaCompletaScroll, background: "linear-gradient(180deg, #0d2540, #163A5C)" }}>
          <div style={{ ...cajaBlanca }}>
            <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>Configuración</h2>
            <p style={{ fontSize: "0.85rem", opacity: 0.7 }}><strong>Terminal:</strong> {nombreDispositivo}</p>

            <div style={{ marginTop: "1.5rem", paddingTop: "1rem", borderTop: "1px solid #eee" }}>
              <p style={{ fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.5rem" }}>Cambiar PIN de administración</p>
              <input value={configPinNuevo} onChange={(e) => setConfigPinNuevo(e.target.value)} placeholder="PIN nuevo (4-6 dígitos)" inputMode="numeric" style={{ width: "100%", padding: "0.5rem", marginBottom: "0.5rem" }} />
              <button onClick={cambiarPin} style={{ width: "100%", padding: "0.6rem" }}>Guardar PIN nuevo</button>
              {configMensaje && <p style={{ fontSize: "0.85rem", marginTop: "0.5rem" }}>{configMensaje}</p>}
            </div>

            <div style={{ marginTop: "1.5rem", paddingTop: "1rem", borderTop: "1px solid #eee" }}>
              <p style={{ fontSize: "0.85rem", opacity: 0.6, marginBottom: "0.5rem" }}>
                Para cambiar turnos o corregir una fichada puntual, entrá a FM Software desde una computadora con tu usuario — eso todavía no está en esta pantalla.
              </p>
              <button onClick={desvincularDispositivo} style={{ width: "100%", padding: "0.6rem", background: "white", color: "#B23A3A", border: "1px solid #B23A3A" }}>
                Desvincular esta terminal
              </button>
            </div>

            <button onClick={volverAFichar} style={{ width: "100%", padding: "0.5rem", marginTop: "1rem", background: "none", border: "none", color: "#1b3468", textDecoration: "underline" }}>← Volver a fichar</button>
          </div>
        </div>
      )}

      {/* ── Fichar manualmente (excepción, requiere PIN) ── */}
      {pantallaAdmin === "manual" && (
        <div style={{ ...capaCompletaScroll, background: "linear-gradient(180deg, #0d2540, #163A5C)" }}>
          <div style={{ ...cajaBlanca }}>
            <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>Fichar manualmente</h2>
            <p style={{ fontSize: "0.8rem", background: "#fdf2ea", border: "1px solid #B8752B", padding: "0.5rem", borderRadius: "6px" }}>
              ⚠ Excepción — usar solo si la cámara falla o la persona todavía no está registrada. Queda igual en el
              historial de fichadas con el origen marcado, para poder auditarlo después.
            </p>
            <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Legajo o apellido..." style={{ width: "100%", padding: "0.6rem", margin: "0.75rem 0" }} autoFocus />
            {resultados.map((l) => (
              <button
                key={l.id}
                onClick={() => { setSeleccionado(l); setConfianzaSeleccion(0); setPantallaAdmin(null); setPinVerificado(null); setDestinoPendiente(null); }}
                style={{ display: "block", width: "100%", textAlign: "left", padding: "0.7rem", marginBottom: "0.4rem", background: "#f8f9fc", border: "1px solid #eee" }}
              >
                <strong>{l.numeroLegajo}</strong> — {l.apellido}, {l.nombre}
              </button>
            ))}
            {busqueda.trim() && resultados.length === 0 && <p style={{ opacity: 0.5, fontSize: "0.85rem" }}>No encontramos a nadie con eso.</p>}
            <button onClick={volverAFichar} style={{ width: "100%", padding: "0.5rem", marginTop: "1rem", background: "none", border: "none", color: "#1b3468", textDecoration: "underline" }}>← Volver a fichar</button>
          </div>
        </div>
      )}
    </main>
  );
}
