"use client";
import { useState, useEffect, Fragment } from "react";

// FM RRHH — app/dispositivos/page.tsx
// Fase 1 del Control de Asistencia — administrar terminales, sin
// biometría todavía (eso es Fase 3). Admin-only (ver middleware.ts).
export default function DispositivosPage() {
  const [dispositivos, setDispositivos] = useState<any[]>([]);
  const [nombre, setNombre] = useState("");
  const [ubicacion, setUbicacion] = useState("");
  const [error, setError] = useState("");
  const [creando, setCreando] = useState(false);
  const [codigoRecienCreado, setCodigoRecienCreado] = useState<{ nombre: string; codigo: string } | null>(null);
  const [mostrandoQrPara, setMostrandoQrPara] = useState<string | null>(null);

  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [subiendoLogo, setSubiendoLogo] = useState(false);
  const [errorLogo, setErrorLogo] = useState("");
  const [configurandoPinPara, setConfigurandoPinPara] = useState<string | null>(null);
  const [pinNuevo, setPinNuevo] = useState("");

  function urlTerminal(codigo: string) {
    const origen = typeof window !== "undefined" ? window.location.origin : "";
    return `${origen}/terminal?codigo=${codigo}`;
  }
  function imagenQr(url: string) {
    return `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(url)}`;
  }

  useEffect(() => {
    cargar();
    fetch("/api/empresas/actual").then((r) => r.json()).then((d) => setLogoUrl(d.logoUrl));
  }, []);

  async function cargar() {
    const res = await fetch("/api/dispositivos");
    setDispositivos(await res.json());
  }

  async function subirLogo(e: any) {
    const archivo = e.target.files?.[0];
    if (!archivo) return;
    setSubiendoLogo(true);
    setErrorLogo("");
    const lector = new FileReader();
    lector.onload = async () => {
      try {
        const res = await fetch("/api/empresas/actual/logo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contenidoBase64: lector.result, tipoMime: archivo.type }),
        });
        let data: any;
        try {
          data = await res.json();
        } catch {
          setSubiendoLogo(false);
          setErrorLogo(`El servidor no devolvió una respuesta válida (código ${res.status}) — probablemente la imagen sea muy grande o el formato no sea compatible.`);
          return;
        }
        setSubiendoLogo(false);
        if (!res.ok) {
          setErrorLogo(`${data.error} (código ${res.status})`);
          return;
        }
        setLogoUrl(data.logoUrl);
      } catch (err: any) {
        setSubiendoLogo(false);
        setErrorLogo("No se pudo conectar con el servidor: " + err.message);
      }
    };
    lector.onerror = () => {
      setSubiendoLogo(false);
      setErrorLogo("No se pudo leer el archivo elegido.");
    };
    lector.readAsDataURL(archivo);
  }

  async function guardarPin(dispositivoId: string) {
    if (!/^\d{4,6}$/.test(pinNuevo)) {
      alert("El PIN tiene que tener entre 4 y 6 números.");
      return;
    }
    const res = await fetch("/api/dispositivos/pin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dispositivoId, pin: pinNuevo }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error);
      return;
    }
    setConfigurandoPinPara(null);
    setPinNuevo("");
    cargar();
  }

  async function crear() {
    if (!nombre.trim()) {
      setError("Falta el nombre.");
      return;
    }
    setCreando(true);
    setError("");
    const res = await fetch("/api/dispositivos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre, ubicacion }),
    });
    const data = await res.json();
    setCreando(false);
    if (!res.ok) {
      setError(data.error);
      return;
    }
    setCodigoRecienCreado({ nombre: data.nombre, codigo: data.codigoVinculacion });
    setNombre("");
    setUbicacion("");
    cargar();
  }

  async function eliminar(id: string, nombre: string) {
    if (!confirm(`¿Eliminar "${nombre}"? Se borran también las fichadas que haya generado. No se puede deshacer.`)) return;
    const res = await fetch("/api/dispositivos", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error);
      return;
    }
    cargar();
  }

  async function regenerarCodigo(id: string) {
    if (!confirm("¿Generar un código nuevo para esta terminal? Corta la conexión AHORA MISMO — la que esté usándola va a dejar de fichar hasta que ingrese el código nuevo.")) return;
    const res = await fetch("/api/dispositivos/regenerar-codigo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dispositivoId: id }) });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error);
      return;
    }
    setCodigoRecienCreado({ nombre: data.nombre, codigo: data.codigo });
    cargar();
  }

  return (
    <main>
      <h1>Dispositivos — Control de Asistencia</h1>
      <p>
        Terminales instaladas en la ubicación de cada cliente (tablet, celular) que registran fichadas. Todavía sin
        reconocimiento facial/huella — esta es la base (Fase 1): alta, estado online/offline, vinculación.
      </p>

      <div style={{ background: "white", border: "1px solid #dfe4e8", padding: "1rem", marginBottom: "1.5rem", maxWidth: "500px" }}>
        <h3 style={{ marginTop: 0 }}>Logo para la terminal</h3>
        <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
          {logoUrl ? (
            <img src={logoUrl} alt="Logo actual" style={{ height: "48px", maxWidth: "160px", objectFit: "contain" }} />
          ) : (
            <span style={{ opacity: 0.5, fontSize: "0.85rem" }}>Sin logo todavía</span>
          )}
          <label style={{ fontSize: "0.85rem", cursor: "pointer", background: "#EEF1F4", padding: "0.4rem 0.8rem", borderRadius: "6px" }}>
            {subiendoLogo ? "Subiendo..." : logoUrl ? "Cambiar logo" : "Subir logo"}
            <input type="file" accept="image/*" onChange={subirLogo} disabled={subiendoLogo} style={{ display: "none" }} />
          </label>
        </div>
        {errorLogo && <p style={{ color: "#B23A3A", fontSize: "0.8rem", marginTop: "0.5rem" }}>{errorLogo}</p>}
      </div>

      <div style={{ background: "white", border: "1px solid #dfe4e8", padding: "1rem", marginBottom: "1.5rem", maxWidth: "500px" }}>
        <h3 style={{ marginTop: 0 }}>Nueva terminal</h3>
        <div style={{ marginBottom: "0.5rem" }}>
          <input placeholder="Nombre (ej. Terminal Recepción)" value={nombre} onChange={(e) => setNombre(e.target.value)} style={{ width: "100%", padding: "0.4rem" }} />
        </div>
        <div style={{ marginBottom: "0.5rem" }}>
          <input placeholder="Ubicación (opcional, ej. Planta Garín)" value={ubicacion} onChange={(e) => setUbicacion(e.target.value)} style={{ width: "100%", padding: "0.4rem" }} />
        </div>
        <button onClick={crear} disabled={creando}>{creando ? "Creando..." : "Crear y generar código"}</button>
        {error && <p style={{ color: "#B23A3A", fontSize: "0.85rem" }}>{error}</p>}

        {codigoRecienCreado && (
          <div style={{ marginTop: "1rem", background: "#eaf5ef", border: "1px solid #2F6F5E", padding: "0.75rem", textAlign: "center" }}>
            <p style={{ margin: "0 0 0.5rem", fontSize: "0.85rem" }}>
              "{codigoRecienCreado.nombre}" — escaneá este QR desde el celular de la terminal (o ingresá el código a mano, se puede usar una sola vez):
            </p>
            <img src={imagenQr(urlTerminal(codigoRecienCreado.codigo))} alt="QR para vincular la terminal" style={{ margin: "0 auto 0.5rem" }} />
            <div style={{ fontSize: "2rem", fontWeight: "bold", letterSpacing: "0.3em", fontFamily: "monospace" }}>{codigoRecienCreado.codigo}</div>
          </div>
        )}
      </div>

      <table>
        <thead>
          <tr>
            <th>Estado</th>
            <th>Nombre</th>
            <th>Ubicación</th>
            <th>Vinculado</th>
            <th>Última conexión</th>
            <th>Código (si no vinculó todavía)</th>
            <th>PIN (modo admin en la terminal)</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {dispositivos.map((d) => (
            <Fragment key={d.id}>
              <tr>
                <td>{d.online ? <span style={{ color: "#2F6F5E" }}>🟢 Online</span> : <span style={{ opacity: 0.5 }}>🔴 Offline</span>}</td>
                <td>{d.nombre}</td>
                <td>{d.ubicacion ?? "—"}</td>
                <td>{d.vinculado ? "✔ Sí" : "— No"}</td>
                <td>{d.ultimaConexion ? new Date(d.ultimaConexion).toLocaleString("es-AR") : "Nunca"}</td>
                <td>
                  {!d.vinculado && (
                    <>
                      <code>{d.codigoVinculacion}</code>{" "}
                      <button onClick={() => setMostrandoQrPara(mostrandoQrPara === d.id ? null : d.id)} style={{ fontSize: "0.75rem" }}>
                        {mostrandoQrPara === d.id ? "Ocultar QR" : "Ver QR"}
                      </button>
                      {" "}
                    </>
                  )}
                  <button onClick={() => regenerarCodigo(d.id)} style={{ fontSize: "0.75rem" }} title="Para cuando la terminal pierde la vinculación sola (pasa en Safari/iOS)">
                    {d.vinculado ? "Re-vincular (código nuevo)" : "Nuevo código"}
                  </button>
                </td>
                <td>
                  {configurandoPinPara === d.id ? (
                    <span style={{ display: "flex", gap: "0.3rem", alignItems: "center" }}>
                      <input value={pinNuevo} onChange={(e) => setPinNuevo(e.target.value)} placeholder="4-6 dígitos" inputMode="numeric" style={{ width: "80px" }} />
                      <button onClick={() => guardarPin(d.id)} style={{ fontSize: "0.75rem" }}>OK</button>
                      <button onClick={() => setConfigurandoPinPara(null)} style={{ fontSize: "0.75rem" }}>×</button>
                    </span>
                  ) : (
                    <button onClick={() => { setConfigurandoPinPara(d.id); setPinNuevo(""); }} style={{ fontSize: "0.75rem" }}>
                      {d.tienePin ? "Cambiar PIN" : "Configurar PIN"}
                    </button>
                  )}
                </td>
                <td>
                  <button onClick={() => eliminar(d.id, d.nombre)} style={{ background: "white", color: "#B23A3A", border: "1px solid #B23A3A", fontSize: "0.8rem" }}>
                    Eliminar
                  </button>
                </td>
              </tr>
              {mostrandoQrPara === d.id && (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", padding: "1rem", background: "#f8f9fc" }}>
                    <img src={imagenQr(urlTerminal(d.codigoVinculacion))} alt="QR para vincular la terminal" />
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
          {dispositivos.length === 0 && (
            <tr>
              <td colSpan={8} style={{ opacity: 0.5, textAlign: "center" }}>Todavía no hay ninguna terminal creada.</td>
            </tr>
          )}
        </tbody>
      </table>

      <p style={{ marginTop: "1.5rem" }}>
        <a href="/fichadas" style={{ fontSize: "0.85rem" }}>Ver fichadas registradas →</a>
      </p>
    </main>
  );
}
