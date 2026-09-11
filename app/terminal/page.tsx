"use client";
import { useState, useEffect, useRef } from "react";

// FM RRHH — app/terminal/page.tsx
//
// La pantalla de kiosco en sí — Fase 2 del Control de Asistencia. Corre en
// una tablet/celular en la ubicación del cliente, SIN sesión de usuario
// (se identifica con su dispositivoId, vinculado una vez con un código).
//
// Todavía sin cámara ni huella (eso es Fase 3) — el empleado se busca por
// número de legajo o apellido en una lista, como pediste que arrancara.
// Cuando llegue la biometría, lo único que cambia es CÓMO se llega al
// legajoId antes de fichar — el resto de esta pantalla (confirmación,
// cola offline, sincronización) queda igual.
//
// MODO OFFLINE (punto 9 del documento): si falla la conexión al fichar,
// la fichada se guarda en localStorage y se reintenta sola cada 15
// segundos y apenas el navegador detecta que volvió el internet. Nunca se
// pierde una fichada por falta de señal.
//
// FASE 3 — reconocimiento facial: corre ENTERAMENTE en este navegador
// (face-api.js desde CDN + los modelos en /public/models) contra los
// descriptores de la empresa, bajados una sola vez al vincular. Si
// reconoce una cara con buena confianza, selecciona el legajo solo — el
// empleado igual tiene que tocar "Registrar Ingreso/Salida" a mano, para
// no fichar a nadie sin que se dé cuenta. La búsqueda manual sigue andando
// igual, como respaldo si la cámara falla o alguien todavía no está
// registrado biométricamente.
declare global {
  interface Window {
    faceapi: any;
  }
}
const CDN_FACEAPI = "https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js";
const UMBRAL_DISTANCIA = 0.5; // más bajo = más estricto. 0.5-0.6 es lo habitual para face-api.js

const CLAVE_DISPOSITIVO = "terminal.dispositivoId";
const CLAVE_NOMBRE = "terminal.nombreDispositivo";
const CLAVE_COLA = "terminal.colaPendiente";

interface Legajo {
  id: string;
  numeroLegajo: number;
  apellido: string;
  nombre: string;
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
  const [codigo, setCodigo] = useState("");
  const [errorVinculacion, setErrorVinculacion] = useState("");
  const [vinculando, setVinculando] = useState(false);

  const [legajos, setLegajos] = useState<Legajo[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [seleccionado, setSeleccionado] = useState<Legajo | null>(null);
  const [confirmacion, setConfirmacion] = useState<{ texto: string; subtexto?: string; ok: boolean } | null>(null);
  const [cola, setCola] = useState<FichadaPendiente[]>([]);

  // ── Fase 3: reconocimiento facial ──
  const videoRef = useRef<HTMLVideoElement>(null);
  const [descriptores, setDescriptores] = useState<DescriptorBiometrico[]>([]);
  const [modelosListos, setModelosListos] = useState(false);
  const [camaraLista, setCamaraLista] = useState(false);
  const [reconocido, setReconocido] = useState<string | null>(null); // nombre, solo para el toast breve
  const reconociendoRef = useRef(false); // evita superponer detecciones mientras una todavía está corriendo

  // ── Cargar dispositivo ya vinculado, si lo hay — o vincular solo si
  // llegamos acá con ?codigo=XXXXXX en la URL (desde un QR) ──
  useEffect(() => {
    const id = localStorage.getItem(CLAVE_DISPOSITIVO);
    const nombre = localStorage.getItem(CLAVE_NOMBRE);
    if (id) {
      setDispositivoId(id);
      setNombreDispositivo(nombre ?? "");
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

  // ── Una vez vinculado: cargar legajos, heartbeat, sincronizar la cola, y arrancar reconocimiento facial ──
  useEffect(() => {
    if (!dispositivoId) return;
    cargarLegajos();
    cargarDescriptoresYModelos();
    const heartbeatInterval = setInterval(() => {
      fetch("/api/dispositivos/heartbeat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dispositivoId }) }).catch(() => {});
    }, 2 * 60000);
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

  // ── Loop de reconocimiento — solo corre en la pantalla principal (nadie seleccionado, sin confirmación en pantalla) ──
  useEffect(() => {
    if (!modelosListos || !camaraLista || seleccionado || confirmacion) return;
    const intervalo = setInterval(reconocerCara, 1200);
    return () => clearInterval(intervalo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelosListos, camaraLista, seleccionado, confirmacion, descriptores]);

  function cargarDescriptoresYModelos() {
    const seguir = () => {
      cargarModelos();
      fetch("/api/dispositivos/biometria", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dispositivoId }) })
        .then((r) => (r.ok ? r.json() : []))
        .then(setDescriptores)
        .catch(() => {}); // sin conexión — sigue funcionando con búsqueda manual, se reintenta al recargar
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
        let mejor: { d: DescriptorBiometrico; distancia: number } | null = null;
        for (const d of descriptores) {
          const distancia = window.faceapi.euclideanDistance(deteccion.descriptor, d.descriptor);
          if (!mejor || distancia < mejor.distancia) mejor = { d, distancia };
        }
        if (mejor && mejor.distancia < UMBRAL_DISTANCIA) {
          setReconocido(`${mejor.d.apellido}, ${mejor.d.nombre}`);
          setSeleccionado({ id: mejor.d.legajoId, numeroLegajo: mejor.d.numeroLegajo, apellido: mejor.d.apellido, nombre: mejor.d.nombre });
          setTimeout(() => setReconocido(null), 2000);
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
      // sin conexión — se reintenta solo la próxima vez que se abra la pantalla o se sincronice
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
        restantes.push(f); // sigue sin conexión — se reintenta en el próximo ciclo
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
      setDispositivoId(data.dispositivoId);
      setNombreDispositivo(data.nombre);
    } catch {
      setErrorVinculacion("No se pudo conectar — revisá el internet de la tablet e intentá de nuevo.");
    }
    setVinculando(false);
  }

  async function fichar(tipo: "entrada" | "salida") {
    if (!seleccionado) return;
    const legajoLabel = `${seleccionado.apellido}, ${seleccionado.nombre}`;
    const horaLocal = new Date().toLocaleTimeString("es-AR");

    try {
      const res = await fetch("/api/fichadas/terminal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dispositivoId, legajoId: seleccionado.id, tipo }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      const saludo = tipo === "entrada" ? `¡Bienvenido/a, ${seleccionado.nombre}!` : `¡Hasta luego, ${seleccionado.nombre}!`;
      setConfirmacion({ texto: saludo, subtexto: `${tipo === "entrada" ? "Ingreso" : "Egreso"} registrado — ${data.hora}`, ok: true });
    } catch {
      const nueva: FichadaPendiente = { tempId: crypto.randomUUID(), legajoId: seleccionado.id, legajoLabel, tipo, horaLocal };
      const nuevaCola = [...leerCola(), nueva];
      guardarCola(nuevaCola);
      setCola(nuevaCola);
      setConfirmacion({ texto: `Guardado sin conexión — ${legajoLabel}`, subtexto: "Se sincroniza solo apenas vuelva el internet", ok: false });
    }

    setSeleccionado(null);
    setBusqueda("");
    setTimeout(() => setConfirmacion(null), 3500);
  }

  const resultados = busqueda.trim()
    ? legajos.filter((l) => `${l.numeroLegajo} ${l.apellido} ${l.nombre}`.toLowerCase().includes(busqueda.toLowerCase())).slice(0, 8)
    : [];

  // ── Pantalla de vinculación (primera vez) ──
  if (!dispositivoId) {
    return (
      <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(180deg, #0d2540, #163A5C)" }}>
        <div style={{ background: "white", borderRadius: "16px", padding: "2.5rem", maxWidth: "380px", width: "90%", textAlign: "center", boxShadow: "0 10px 40px rgba(0,0,0,0.25)" }}>
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

  // ── Pantalla de confirmación (después de fichar) ──
  if (confirmacion) {
    return (
      <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: confirmacion.ok ? "#2F6F5E" : "#B8752B" }}>
        <div style={{ textAlign: "center", color: "white", padding: "2rem" }}>
          <div style={{ fontSize: "4rem" }}>{confirmacion.ok ? "✔" : "🟠"}</div>
          <p style={{ fontSize: "1.6rem", fontWeight: 700, marginTop: "1rem", maxWidth: "500px" }}>{confirmacion.texto}</p>
          {confirmacion.subtexto && <p style={{ fontSize: "1rem", opacity: 0.85, marginTop: "0.4rem" }}>{confirmacion.subtexto}</p>}
        </div>
      </main>
    );
  }

  // ── Pantalla de confirmar entrada/salida para el legajo elegido ──
  if (seleccionado) {
    return (
      <main style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#163A5C", padding: "2rem" }}>
        <div style={{ background: "white", borderRadius: "12px", padding: "2.5rem", maxWidth: "420px", width: "100%", textAlign: "center" }}>
          <p style={{ opacity: 0.6, marginBottom: "0.3rem" }}>Legajo {seleccionado.numeroLegajo}</p>
          <h2 style={{ marginTop: 0, marginBottom: "2rem" }}>{seleccionado.apellido}, {seleccionado.nombre}</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <button onClick={() => fichar("entrada")} style={{ padding: "1.2rem", fontSize: "1.1rem", background: "#2F6F5E", color: "white", border: "none", borderRadius: "8px" }}>
              Registrar Ingreso
            </button>
            <button onClick={() => fichar("salida")} style={{ padding: "1.2rem", fontSize: "1.1rem", background: "#163A5C", color: "white", border: "none", borderRadius: "8px" }}>
              Registrar Salida
            </button>
            <button onClick={() => setSeleccionado(null)} style={{ padding: "0.6rem", marginTop: "0.5rem", background: "white", border: "1px solid #ccc" }}>
              No soy yo — volver
            </button>
          </div>
        </div>
      </main>
    );
  }

  // ── Pantalla principal: cámara (si está disponible) + buscar empleado ──
  return (
    <main style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", background: "linear-gradient(180deg, #0d2540, #163A5C)", padding: "2.5rem 1.5rem" }}>
      <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(255,255,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.6rem", marginBottom: "0.75rem" }}>
        🕒
      </div>
      <h1 style={{ color: "white", marginBottom: "0.2rem", fontSize: "1.4rem" }}>Control de Asistencia</h1>
      <p style={{ color: "rgba(255,255,255,0.6)", marginBottom: "1.5rem", fontSize: "0.85rem" }}>{nombreDispositivo}</p>

      <div style={{ position: "relative", width: "100%", maxWidth: "420px", marginBottom: "1.5rem" }}>
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          style={{ width: "100%", borderRadius: "16px", background: "#000", transform: "scaleX(-1)", display: camaraLista ? "block" : "none", boxShadow: "0 8px 30px rgba(0,0,0,0.3)" }}
        />
        {!camaraLista && (
          <p style={{ color: "rgba(255,255,255,0.5)", textAlign: "center", fontSize: "0.85rem" }}>
            {modelosListos ? "Sin cámara — usá la búsqueda de abajo." : "Cargando reconocimiento facial..."}
          </p>
        )}
        {reconocido && (
          <div style={{ position: "absolute", bottom: "0.75rem", left: "0.75rem", right: "0.75rem", background: "rgba(47,111,94,0.92)", color: "white", padding: "0.6rem", borderRadius: "8px", textAlign: "center", fontSize: "0.9rem", fontWeight: 600 }}>
            ✔ Reconocido: {reconocido}
          </div>
        )}
      </div>

      <input
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        placeholder="O escribí tu legajo o apellido..."
        style={{ width: "100%", maxWidth: "420px", padding: "1rem", fontSize: "1.1rem", borderRadius: "10px", border: "none", marginBottom: "1rem" }}
      />

      <div style={{ width: "100%", maxWidth: "420px" }}>
        {resultados.map((l) => (
          <button
            key={l.id}
            onClick={() => setSeleccionado(l)}
            style={{ display: "block", width: "100%", textAlign: "left", padding: "0.9rem", marginBottom: "0.5rem", background: "white", border: "none", borderRadius: "8px", fontSize: "1rem" }}
          >
            <strong>{l.numeroLegajo}</strong> — {l.apellido}, {l.nombre}
          </button>
        ))}
        {busqueda.trim() && resultados.length === 0 && (
          <p style={{ color: "rgba(255,255,255,0.6)", textAlign: "center" }}>No encontramos a nadie con eso.</p>
        )}
      </div>

      <div style={{ position: "fixed", bottom: "1rem", left: 0, right: 0, textAlign: "center", fontSize: "0.75rem", color: "rgba(255,255,255,0.5)" }}>
        {cola.length > 0 ? `🟠 ${cola.length} fichada${cola.length > 1 ? "s" : ""} pendiente${cola.length > 1 ? "s" : ""} de sincronización` : "🟢 Sincronizado"}
        {" · "}
        <a href="/login" style={{ color: "rgba(255,255,255,0.5)" }}>Salir del modo terminal</a>
      </div>
    </main>
  );
}
