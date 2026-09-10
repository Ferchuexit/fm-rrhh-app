"use client";
import { useState, useEffect, useRef } from "react";

// FM RRHH — app/legajos/[id]/biometria/page.tsx
//
// Alta biométrica facial — Fase 3 del Control de Asistencia. Corre
// face-api.js EN EL NAVEGADOR (cargado desde CDN, sin tocar package.json)
// para calcular el descriptor acá mismo, con la webcam de quien esté
// dando de alta al empleado (normalmente un admin, desde la oficina) —
// solo el descriptor (un vector de números) viaja al servidor, nunca la
// foto en sí.
//
// IMPORTANTE — consentimiento: esto registra un dato biométrico de un
// tercero (el empleado). Antes de capturar, confirmá que la persona sabe
// y está de acuerdo — la Ley 25.326 lo exige. Este formulario no reemplaza
// ese consentimiento, es responsabilidad de quien lo usa conseguirlo antes.
declare global {
  interface Window {
    faceapi: any;
  }
}

const CDN_FACEAPI = "https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js";

export default function BiometriaLegajoPage({ params }: { params: { id: string } }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [scriptListo, setScriptListo] = useState(false);
  const [modelosListos, setModelosListos] = useState(false);
  const [camaraLista, setCamaraLista] = useState(false);
  const [estado, setEstado] = useState<any>(null);
  const [capturando, setCapturando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    cargarEstado();
    cargarScriptYModelos();
    return () => {
      const stream = videoRef.current?.srcObject as MediaStream | undefined;
      stream?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function cargarEstado() {
    const res = await fetch(`/api/legajos/${params.id}/biometria`);
    if (res.ok) setEstado(await res.json());
  }

  function cargarScriptYModelos() {
    if (window.faceapi) {
      setScriptListo(true);
      cargarModelos();
      return;
    }
    const script = document.createElement("script");
    script.src = CDN_FACEAPI;
    script.onload = () => {
      setScriptListo(true);
      cargarModelos();
    };
    script.onerror = () => setError("No se pudo cargar la librería de reconocimiento facial — revisá la conexión a internet.");
    document.head.appendChild(script);
  }

  async function cargarModelos() {
    try {
      await window.faceapi.nets.tinyFaceDetector.loadFromUri("/models");
      await window.faceapi.nets.faceLandmark68Net.loadFromUri("/models");
      await window.faceapi.nets.faceRecognitionNet.loadFromUri("/models");
      setModelosListos(true);
      iniciarCamara();
    } catch {
      setError("No se pudieron cargar los modelos de reconocimiento — revisá que la carpeta /models esté publicada.");
    }
  }

  async function iniciarCamara() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setCamaraLista(true);
      }
    } catch {
      setError("No se pudo acceder a la cámara — revisá los permisos del navegador.");
    }
  }

  async function capturarYGuardar() {
    if (!videoRef.current) return;
    setCapturando(true);
    setError("");
    setMensaje("");
    try {
      const deteccion = await window.faceapi
        .detectSingleFace(videoRef.current, new window.faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!deteccion) {
        setError("No se detectó ninguna cara — acercate más a la cámara, con buena luz, y probá de nuevo.");
        setCapturando(false);
        return;
      }

      const descriptor = Array.from(deteccion.descriptor as Float32Array);
      const res = await fetch(`/api/legajos/${params.id}/biometria`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ descriptor }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
        setCapturando(false);
        return;
      }
      setMensaje("✔ Registro biométrico guardado.");
      cargarEstado();
    } catch (e: any) {
      setError("Error inesperado al capturar: " + e.message);
    }
    setCapturando(false);
  }

  async function revocar() {
    if (!confirm("¿Revocar la identificación biométrica de este legajo? Va a dejar de reconocerse en las terminales hasta que se registre de nuevo.")) return;
    const res = await fetch(`/api/legajos/${params.id}/biometria`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error);
      return;
    }
    cargarEstado();
  }

  return (
    <main>
      <h1>Biometría</h1>
      <p>
        <a href={`/legajos/${params.id}/editar`}>← Volver al legajo</a>
      </p>

      <div style={{ background: "#fdf2ea", border: "1px solid #B8752B", padding: "0.75rem", maxWidth: "600px", marginBottom: "1.5rem", fontSize: "0.85rem" }}>
        ⚠ Confirmá que el empleado sabe y está de acuerdo con que se registre su cara para fichar antes de capturar —
        es un dato biométrico, la Ley 25.326 exige su consentimiento.
      </div>

      {estado && (
        <div style={{ background: estado.estado === "activo" ? "#eaf5ef" : "white", border: `1px solid ${estado.estado === "activo" ? "#2F6F5E" : "#dfe4e8"}`, padding: "0.75rem", maxWidth: "600px", marginBottom: "1.5rem" }}>
          {estado.estado === "activo" ? (
            <>
              <strong>🟢 Registrado</strong> — desde {new Date(estado.fechaAlta).toLocaleDateString("es-AR")}
              {estado.dispositivoAlta && ` (${estado.dispositivoAlta.nombre})`}
              <div style={{ marginTop: "0.5rem" }}>
                <button onClick={revocar} style={{ background: "white", color: "#B23A3A", border: "1px solid #B23A3A", fontSize: "0.85rem" }}>
                  Revocar identificación
                </button>
              </div>
            </>
          ) : (
            <span style={{ opacity: 0.6 }}>Sin registro biométrico todavía (o revocado el {estado.fechaRevocacion && new Date(estado.fechaRevocacion).toLocaleDateString("es-AR")}).</span>
          )}
        </div>
      )}

      <div style={{ background: "white", border: "1px solid #dfe4e8", padding: "1.5rem", maxWidth: "500px" }}>
        {!scriptListo || !modelosListos ? (
          <p style={{ opacity: 0.6 }}>Cargando reconocimiento facial...</p>
        ) : (
          <>
            <video ref={videoRef} autoPlay muted playsInline style={{ width: "100%", borderRadius: "8px", background: "#000", transform: "scaleX(-1)" }} />
            <button onClick={capturarYGuardar} disabled={!camaraLista || capturando} style={{ width: "100%", padding: "0.75rem", marginTop: "1rem", fontSize: "1rem" }}>
              {capturando ? "Capturando..." : estado?.estado === "activo" ? "Actualizar registro" : "Capturar y registrar"}
            </button>
          </>
        )}
        {mensaje && <p style={{ color: "#2F6F5E", marginTop: "0.75rem" }}>{mensaje}</p>}
        {error && <p style={{ color: "#B23A3A", marginTop: "0.75rem" }}>{error}</p>}
      </div>
    </main>
  );
}
