"use client";
// FM RRHH — app/legajo-digital/page.tsx
// Lado RR.HH. del legajo digital: bandeja de lo que espera revisión
// (documentos que subieron los empleados y cambios de datos que pidieron)
// y el checklist de toda la dotación.
import { useEffect, useRef, useState } from "react";

type Estado = "completo" | "para_firmar" | "desactualizado" | "en_revision" | "rechazado" | "falta" | "opcional";
type Item = { clave: string; nombre: string; estado: Estado; detalle?: string; leToca: "empleado" | "rrhh" | null; requerido: boolean };
type Fila = {
  legajoId: string; numeroLegajo: number; apellido: string; nombre: string; tieneAcceso: boolean; items: Item[];
  resumen: { completos: number; total: number; completo: boolean; pendientesEmpleado: number; pendientesRrhh: number };
  firmas: { id: string; tipo: string; vacacionId: string | null; firmadoEn: string }[];
};
type DocPend = { id: string; tipo: string | null; nombre: string; tipoMime: string; fechaSubida: string; legajo: { numeroLegajo: number; apellido: string; nombre: string } };
type CambioPend = { id: string; cambios: Record<string, { antes: string; despues: string }>; createdAt: string; legajo: { numeroLegajo: number; apellido: string; nombre: string } };

const SIMBOLO: Record<Estado, { s: string; color: string; texto: string }> = {
  completo: { s: "✓", color: "#2F6F5E", texto: "Completo" },
  para_firmar: { s: "✎", color: "#B8752B", texto: "Falta que el empleado lo firme" },
  desactualizado: { s: "✎", color: "#B8752B", texto: "Los datos cambiaron: tiene que firmar de nuevo" },
  en_revision: { s: "⏳", color: "#163A5C", texto: "Subido por el empleado, esperando tu revisión" },
  rechazado: { s: "✗", color: "#B23A3A", texto: "Rechazado: falta que lo suba de nuevo" },
  falta: { s: "✗", color: "#B23A3A", texto: "Falta" },
  opcional: { s: "–", color: "#a0a6ad", texto: "Opcional, sin cargar" },
};
const COLUMNAS = [["ficha", "Ficha"], ["ddjj_domicilio", "DD.JJ."], ["talles", "Talles"], ["dni", "DNI"], ["cuil", "CUIL"], ["alta_temprana", "Alta"]] as const;
const TIPOS_SUBIBLES = [["alta_temprana", "Alta temprana de ARCA"], ["dni", "DNI (frente y dorso)"], ["cuil", "Constancia de CUIL"], ["cert_estudios", "Certificado de estudios"], ["cert_medico", "Certificado médico"], ["otro", "Otro"]];
const CAMPO: Record<string, string> = { domicilio: "Domicilio", localidad: "Localidad", partido: "Partido", provincia: "Provincia", telefono: "Teléfono", email: "Email", estadoCivil: "Estado civil" };
const NOMBRE_CONSTANCIA: Record<string, string> = { ficha: "Ficha", ddjj_domicilio: "DD.JJ. de domicilio", notif_vacaciones: "Notificación de vacaciones" };
const cuando = (iso: string) => new Date(iso).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
const btnSec = { background: "white", color: "#163A5C", border: "1px solid #163A5C" } as const;
const chico = { padding: "0.35rem 0.7rem", fontSize: "0.8rem" } as const;

export default function LegajoDigitalPage() {
  const [datos, setDatos] = useState<{ legajos: Fila[]; documentos: DocPend[]; cambios: CambioPend[] } | null>(null);
  const [error, setError] = useState("");
  const [ocupado, setOcupado] = useState("");
  const [rechazo, setRechazo] = useState<{ id: string; texto: string } | null>(null);
  const [abierto, setAbierto] = useState("");
  const [filtro, setFiltro] = useState("");
  const [soloIncompletos, setSoloIncompletos] = useState(false);
  const [tipoSubida, setTipoSubida] = useState("alta_temprana");
  const archivo = useRef<HTMLInputElement>(null);

  async function cargar() {
    const d = await fetch("/api/legajo-digital").then((r) => r.json());
    setDatos(d);
  }
  useEffect(() => { cargar(); }, []);

  async function post(url: string, cuerpo: any, clave: string) {
    setOcupado(clave);
    setError("");
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo) });
    const data = await res.json().catch(() => ({ error: "El servidor no devolvió una respuesta válida." }));
    setOcupado("");
    if (!res.ok) { setError(data.error ?? "Error inesperado."); if (res.status === 409) cargar(); return false; }
    setRechazo(null);
    await cargar();
    return true;
  }

  async function subir(legajoId: string, f: File) {
    if (f.size > 3 * 1024 * 1024) { setError("El archivo pesa más de 3 MB — comprimilo o escanealo en menor resolución."); return; }
    const contenidoBase64 = await new Promise<string>((ok) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.readAsDataURL(f); });
    await post("/api/legajo-digital/documentos", { legajoId, tipo: tipoSubida, contenidoBase64 }, "subir");
  }

  if (!datos) return <main><h1>Legajo digital</h1><p>Cargando…</p></main>;

  const q = filtro.trim().toLowerCase();
  const visibles = datos.legajos.filter((l) => (!soloIncompletos || !l.resumen.completo) && (!q || `${l.numeroLegajo} ${l.apellido} ${l.nombre}`.toLowerCase().includes(q)));
  const completos = datos.legajos.filter((l) => l.resumen.completo).length;
  const paraRevisar = datos.documentos.length + datos.cambios.length;
  const faltantes = (clave: string) => datos.legajos.filter((l) => l.items.find((i) => i.clave === clave)?.estado !== "completo").length;

  const caja = (n: number | string, texto: string, color: string) => (
    <div style={{ background: "white", border: "1px solid #dfe4e8", borderTop: `4px solid ${color}`, padding: "0.75rem 1rem", minWidth: "150px" }}>
      <div style={{ fontSize: "1.6rem", fontWeight: 700, color }}>{n}</div>
      <div style={{ fontSize: "0.85rem" }}>{texto}</div>
    </div>
  );

  const cajaRechazo = (id: string, url: string, campo: "motivo" | "respuesta", accion: string) =>
    rechazo?.id === id && (
      <div style={{ marginTop: "0.5rem" }}>
        <input value={rechazo.texto} onChange={(e) => setRechazo({ id, texto: e.target.value })} placeholder="Motivo (lo lee el empleado) — ej: la foto está cortada" maxLength={300} autoFocus style={{ width: "100%", maxWidth: "460px", padding: "0.45rem" }} />{" "}
        <button style={{ ...chico, background: "#B23A3A" }} disabled={ocupado !== ""} onClick={() => post(url, { accion, [campo]: rechazo.texto }, id)}>Confirmar rechazo</button>{" "}
        <button style={{ ...chico, ...btnSec }} onClick={() => setRechazo(null)}>Volver</button>
      </div>
    );

  return (
    <main>
      <h1>Legajo digital</h1>
      <p style={{ maxWidth: "860px" }}>
        La carpeta de cada empleado, como checklist. El empleado firma la ficha y la DD.JJ. de domicilio con su PIN, carga sus talles y sube fotos de su
        documentación desde el <a href="/accesos-portal">portal</a>; lo que sube queda acá para que lo revises antes de darlo por válido.
      </p>

      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", margin: "1rem 0" }}>
        {caja(`${completos} / ${datos.legajos.length}`, "Legajos completos", "#2F6F5E")}
        {caja(paraRevisar, "Para revisar", paraRevisar ? "#B8752B" : "#6b727b")}
        {caja(faltantes("dni"), "Sin DNI", "#6b727b")}
        {caja(faltantes("ddjj_domicilio"), "Sin DD.JJ. firmada", "#6b727b")}
        {caja(faltantes("alta_temprana"), "Sin alta temprana", "#6b727b")}
      </div>

      {error && <p style={{ color: "#B23A3A", background: "#f8e4e4", padding: "0.6rem 0.8rem", maxWidth: "900px" }}>{error}</p>}

      {paraRevisar > 0 && <h2>Para revisar ({paraRevisar})</h2>}
      {datos.documentos.map((d) => (
        <div key={d.id} style={{ background: "white", border: "1px solid #dfe4e8", borderLeft: "4px solid #B8752B", padding: "0.8rem 1rem", maxWidth: "900px", marginBottom: "0.6rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap", alignItems: "center" }}>
            <div>
              <strong style={{ color: "#163A5C" }}>#{d.legajo.numeroLegajo} {d.legajo.apellido}, {d.legajo.nombre}</strong> · {d.nombre}
              <div style={{ fontSize: "0.78rem", color: "#6b727b" }}>Subido el {cuando(d.fechaSubida)} · {d.tipoMime === "application/pdf" ? "PDF" : "foto"}</div>
            </div>
            <div style={{ display: "flex", gap: "0.4rem" }}>
              <a href={`/api/documentos/${d.id}`} target="_blank" rel="noopener" style={{ ...chico, ...btnSec, borderRadius: "3px", textDecoration: "none" }}>Ver</a>
              <button style={chico} disabled={ocupado !== ""} onClick={() => post(`/api/legajo-digital/documentos/${d.id}`, { accion: "aceptar" }, d.id)}>Aceptar</button>
              <button style={{ ...chico, ...btnSec }} onClick={() => setRechazo({ id: d.id, texto: "" })}>Rechazar</button>
            </div>
          </div>
          {cajaRechazo(d.id, `/api/legajo-digital/documentos/${d.id}`, "motivo", "rechazar")}
        </div>
      ))}
      {datos.cambios.map((c) => (
        <div key={c.id} style={{ background: "white", border: "1px solid #dfe4e8", borderLeft: "4px solid #163A5C", padding: "0.8rem 1rem", maxWidth: "900px", marginBottom: "0.6rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
            <div>
              <strong style={{ color: "#163A5C" }}>#{c.legajo.numeroLegajo} {c.legajo.apellido}, {c.legajo.nombre}</strong> pide cambiar sus datos
              <table style={{ marginTop: "0.4rem", maxWidth: "620px" }}>
                <thead><tr><th>Dato</th><th>Hoy en la ficha</th><th>Pide que diga</th></tr></thead>
                <tbody>{Object.entries(c.cambios).map(([campo, v]) => <tr key={campo}><td>{CAMPO[campo] ?? campo}</td><td>{v.antes || "—"}</td><td><strong>{v.despues || "(vacío)"}</strong></td></tr>)}</tbody>
              </table>
              <div style={{ fontSize: "0.78rem", color: "#6b727b", marginTop: "0.3rem" }}>Pedido el {cuando(c.createdAt)}. Si aprobás, la ficha se actualiza y el empleado tiene que volver a firmarla.</div>
            </div>
            <div style={{ display: "flex", gap: "0.4rem", alignItems: "flex-start" }}>
              <button style={chico} disabled={ocupado !== ""} onClick={() => post(`/api/legajo-digital/cambios/${c.id}`, { accion: "aprobar" }, c.id)}>Aprobar</button>
              <button style={{ ...chico, ...btnSec }} onClick={() => setRechazo({ id: c.id, texto: "" })}>Rechazar</button>
            </div>
          </div>
          {cajaRechazo(c.id, `/api/legajo-digital/cambios/${c.id}`, "respuesta", "rechazar")}
        </div>
      ))}

      <h2 style={{ marginTop: "1.75rem" }}>Dotación activa</h2>
      <div style={{ display: "flex", gap: "1rem", alignItems: "center", flexWrap: "wrap", marginBottom: "0.75rem" }}>
        <input placeholder="Buscar por legajo o apellido" value={filtro} onChange={(e) => setFiltro(e.target.value)} style={{ padding: "0.5rem", width: "260px" }} />
        <label><input type="checkbox" checked={soloIncompletos} onChange={(e) => setSoloIncompletos(e.target.checked)} /> Solo incompletos</label>
        <span style={{ fontSize: "0.8rem", color: "#6b727b" }}>✓ completo · ✎ falta firma · ⏳ para revisar · ✗ falta</span>
      </div>

      <input ref={archivo} type="file" accept="image/*,application/pdf" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f && abierto) subir(abierto, f); }} />
      <table style={{ maxWidth: "1100px" }}>
        <thead>
          <tr><th>Legajo</th><th>Empleado</th><th>Avance</th>{COLUMNAS.map(([, n]) => <th key={n} style={{ textAlign: "center" }}>{n}</th>)}<th></th></tr>
        </thead>
        <tbody>
          {visibles.map((l) => {
            const esta = abierto === l.legajoId;
            return [
              <tr key={l.legajoId}>
                <td>{l.numeroLegajo}</td>
                <td>{l.apellido}, {l.nombre}{!l.tieneAcceso && <div style={{ fontSize: "0.75rem", color: "#B8752B" }}>sin acceso al portal</div>}</td>
                <td style={{ whiteSpace: "nowrap", fontWeight: 600, color: l.resumen.completo ? "#2F6F5E" : "#4A4F58" }}>{l.resumen.completos} / {l.resumen.total}</td>
                {COLUMNAS.map(([clave]) => {
                  const it = l.items.find((i) => i.clave === clave)!;
                  return <td key={clave} title={SIMBOLO[it.estado].texto} style={{ textAlign: "center", color: SIMBOLO[it.estado].color, fontWeight: 700 }}>{SIMBOLO[it.estado].s}</td>;
                })}
                <td><button style={{ ...chico, ...btnSec }} onClick={() => setAbierto(esta ? "" : l.legajoId)}>{esta ? "Cerrar" : "Ver detalle"}</button></td>
              </tr>,
              esta && (
                <tr key={l.legajoId + "-d"}>
                  <td colSpan={COLUMNAS.length + 4} style={{ background: "white", padding: "0.9rem 1.2rem" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "1.25rem" }}>
                      <div>
                        <strong style={{ color: "#163A5C" }}>Checklist</strong>
                        {l.items.map((it) => (
                          <div key={it.clave} style={{ display: "flex", gap: "0.5rem", padding: "0.3rem 0", borderBottom: "1px solid #EEF1F4", fontSize: "0.88rem" }}>
                            <span style={{ color: SIMBOLO[it.estado].color, fontWeight: 700, width: "1.2rem" }}>{SIMBOLO[it.estado].s}</span>
                            <span style={{ flex: 1 }}>{it.nombre}<div style={{ fontSize: "0.76rem", color: "#6b727b" }}>{it.detalle ?? SIMBOLO[it.estado].texto}</div></span>
                          </div>
                        ))}
                      </div>
                      <div>
                        <strong style={{ color: "#163A5C" }}>Constancias firmadas</strong>
                        {l.firmas.length === 0 && <p style={{ fontSize: "0.88rem", margin: "0.3rem 0" }}>Todavía no firmó ninguna.</p>}
                        {l.firmas.map((f) => (
                          <div key={f.id} style={{ fontSize: "0.88rem", padding: "0.3rem 0", borderBottom: "1px solid #EEF1F4" }}>
                            <a href={`/api/legajo-digital/constancias/${f.id}`} target="_blank" rel="noopener" style={{ color: "#163A5C", fontWeight: 600 }}>{NOMBRE_CONSTANCIA[f.tipo] ?? f.tipo} (PDF)</a>
                            <span style={{ color: "#6b727b", fontSize: "0.78rem" }}> · {cuando(f.firmadoEn)}</span>
                          </div>
                        ))}
                        <div style={{ marginTop: "1rem" }}>
                          <strong style={{ color: "#163A5C" }}>Subir un documento a este legajo</strong>
                          <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.4rem", flexWrap: "wrap" }}>
                            <select value={tipoSubida} onChange={(e) => setTipoSubida(e.target.value)} style={{ padding: "0.4rem" }}>
                              {TIPOS_SUBIBLES.map(([v, n]) => <option key={v} value={v}>{n}</option>)}
                            </select>
                            <button style={chico} disabled={ocupado !== ""} onClick={() => archivo.current?.click()}>{ocupado === "subir" ? "Subiendo…" : "Elegir archivo"}</button>
                          </div>
                          <p style={{ fontSize: "0.78rem", color: "#6b727b", margin: "0.4rem 0 0" }}>
                            Foto o PDF, hasta 3 MB. Todos los documentos del empleado se ven en <a href={`/legajos/${l.legajoId}/editar`}>su ficha</a>.
                          </p>
                        </div>
                      </div>
                    </div>
                  </td>
                </tr>
              ),
            ];
          })}
          {visibles.length === 0 && <tr><td colSpan={COLUMNAS.length + 4}>No hay legajos que coincidan.</td></tr>}
        </tbody>
      </table>
    </main>
  );
}
