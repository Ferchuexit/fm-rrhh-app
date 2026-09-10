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
const CLAVE_DISPOSITIVO = "terminal.dispositivoId";
const CLAVE_NOMBRE = "terminal.nombreDispositivo";
const CLAVE_COLA = "terminal.colaPendiente";

interface Legajo {
  id: string;
  numeroLegajo: number;
  apellido: string;
  nombre: string;
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
  const [confirmacion, setConfirmacion] = useState<{ texto: string; ok: boolean } | null>(null);
  const [cola, setCola] = useState<FichadaPendiente[]>([]);

  // ── Cargar dispositivo ya vinculado, si lo hay ──
  useEffect(() => {
    const id = localStorage.getItem(CLAVE_DISPOSITIVO);
    const nombre = localStorage.getItem(CLAVE_NOMBRE);
    if (id) {
      setDispositivoId(id);
      setNombreDispositivo(nombre ?? "");
    }
    setCola(leerCola());
  }, []);

  // ── Una vez vinculado: cargar legajos, heartbeat, y sincronizar la cola ──
  useEffect(() => {
    if (!dispositivoId) return;
    cargarLegajos();
    const heartbeatInterval = setInterval(() => {
      fetch("/api/dispositivos/heartbeat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dispositivoId }) }).catch(() => {});
    }, 2 * 60000);
    const syncInterval = setInterval(sincronizarCola, 15000);
    window.addEventListener("online", sincronizarCola);
    return () => {
      clearInterval(heartbeatInterval);
      clearInterval(syncInterval);
      window.removeEventListener("online", sincronizarCola);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispositivoId]);

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
    setVinculando(true);
    setErrorVinculacion("");
    try {
      const res = await fetch("/api/dispositivos/vincular", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ codigo: codigo.trim() }) });
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
      setConfirmacion({ texto: `${tipo === "entrada" ? "Ingreso" : "Egreso"} registrado — ${legajoLabel} — ${data.hora}`, ok: true });
    } catch {
      const nueva: FichadaPendiente = { tempId: crypto.randomUUID(), legajoId: seleccionado.id, legajoLabel, tipo, horaLocal };
      const nuevaCola = [...leerCola(), nueva];
      guardarCola(nuevaCola);
      setCola(nuevaCola);
      setConfirmacion({ texto: `Guardado sin conexión — ${legajoLabel} — se sincroniza solo apenas vuelva el internet`, ok: false });
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
      <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#163A5C" }}>
        <div style={{ background: "white", borderRadius: "12px", padding: "2.5rem", maxWidth: "380px", width: "90%", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.3rem", marginBottom: "0.5rem" }}>FM Software</h1>
          <p style={{ opacity: 0.6, marginBottom: "1.5rem" }}>Control de Asistencia</p>
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
          <p style={{ fontSize: "1.4rem", marginTop: "1rem", maxWidth: "500px" }}>{confirmacion.texto}</p>
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

  // ── Pantalla principal: buscar empleado ──
  return (
    <main style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", background: "#163A5C", padding: "3rem 1.5rem" }}>
      <h1 style={{ color: "white", marginBottom: "0.3rem" }}>FM Software</h1>
      <p style={{ color: "rgba(255,255,255,0.7)", marginBottom: "2rem" }}>{nombreDispositivo} — Buenos días</p>

      <input
        autoFocus
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        placeholder="Escribí tu legajo o apellido..."
        style={{ width: "100%", maxWidth: "420px", padding: "1rem", fontSize: "1.2rem", borderRadius: "8px", border: "none", marginBottom: "1rem" }}
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
