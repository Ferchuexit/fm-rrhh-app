"use client";
// FM RRHH — app/accesos-portal/avisos/page.tsx
// "¿Le avisaron?": quién puede recibir avisos y qué salió, por qué canal.
import { useEffect, useState } from "react";

type Persona = { id: string; numero: number; apellido: string; nombre: string; acceso: "activo" | "pin_temporal" | "sin_acceso"; celulares: string[]; tieneMail: boolean };
type Aviso = { id: string; legajoId: string; tipo: string; titulo: string; cuerpo: string; pushEnviados: number; pushFallidos: number; emailEstado: string | null; createdAt: string; legajo: { numeroLegajo: number; apellido: string; nombre: string } };

const momento = (iso: string) => new Date(iso).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
const caja: React.CSSProperties = { background: "white", border: "1px solid #dfe4e8", padding: "1rem", marginBottom: "1.5rem", maxWidth: "1100px" };
const TIPO: Record<string, string> = { recibo: "Recibo", solicitud: "Vacaciones / permisos", noticia: "Noticia", legajo: "Legajo", horario: "Horario", ingreso: "Ingreso", prueba: "Prueba" };

export default function AvisosEnviadosPage() {
  const [datos, setDatos] = useState<{ canales: { push: boolean; mail: boolean }; personas: Persona[]; avisos: Aviso[] } | null>(null);
  const [error, setError] = useState("");
  const [de, setDe] = useState("");
  const [soloSinCanal, setSoloSinCanal] = useState(false);

  async function cargar(legajoId = de) {
    const res = await fetch(`/api/accesos-portal/avisos${legajoId ? `?legajoId=${legajoId}` : ""}`);
    const d = await res.json().catch(() => ({ error: "El servidor no devolvió una respuesta válida." }));
    if (!res.ok) { setError(d.error ?? "No se pudo cargar."); return; }
    setError("");
    setDatos(d);
  }
  useEffect(() => { cargar(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [de]);

  // A quién NO le llega nada hoy, aunque tenga acceso al portal.
  const sinCanal = (p: Persona) => p.acceso !== "sin_acceso" && p.celulares.length === 0 && !p.tieneMail;
  const personas = (datos?.personas ?? []).filter((p) => !soloSinCanal || sinCanal(p));
  const conAcceso = (datos?.personas ?? []).filter((p) => p.acceso !== "sin_acceso");
  const conCelular = conAcceso.filter((p) => p.celulares.length > 0);

  // Cómo salió un aviso, en palabras.
  function resultado(a: Aviso) {
    const partes: string[] = [];
    if (a.pushEnviados > 0) partes.push(`${a.pushEnviados} ${a.pushEnviados === 1 ? "celular" : "celulares"}`);
    if (a.emailEstado === "enviado") partes.push("mail");
    if (partes.length > 0) return { texto: `Llegó por ${partes.join(" y ")}`, color: "#2F6F5E" };
    if (a.pushFallidos > 0 || a.emailEstado?.startsWith("error")) return { texto: `No salió${a.emailEstado?.startsWith("error") ? ` (mail: ${a.emailEstado.slice(7)})` : ""}`, color: "#B23A3A" };
    return { texto: "No tenía avisos activados ni mail", color: "#6b727b" };
  }

  return (
    <main>
      <h1>Avisos enviados</h1>
      <p style={{ maxWidth: "860px" }}>
        Quién puede recibir avisos del sistema y qué se le mandó. Los avisos salen solos (recibo nuevo, respuesta a un pedido, noticia, cambio de horario, ingreso); acá se
        consulta. Para dar o quitar el acceso al portal: <a href="/accesos-portal">Accesos al portal</a>.
      </p>
      {error && <p style={{ color: "#B23A3A" }}>{error}</p>}
      {!datos && !error && <p>Cargando…</p>}

      {datos && (
        <>
          {(!datos.canales.push || !datos.canales.mail) && (
            <div style={{ ...caja, borderLeft: "4px solid #B8752B" }}>
              {!datos.canales.push && <div><strong>Las notificaciones en el celular no están configuradas</strong> en este servidor: faltan las llaves VAPID (ver <code>docs/84-avisos.md</code>). Nadie puede activarlas todavía.</div>}
              {!datos.canales.mail && <div><strong>El mail no está configurado</strong> en este servidor: falta la clave de Resend. No sale ningún mail.</div>}
            </div>
          )}

          <div style={caja}>
            <h3 style={{ marginTop: 0 }}>Quién recibe avisos</h3>
            <p style={{ fontSize: "0.9rem", marginTop: 0 }}>
              De <strong>{conAcceso.length}</strong> con acceso al portal, <strong>{conCelular.length}</strong> {conCelular.length === 1 ? "activó" : "activaron"} los avisos en el celular
              y <strong>{conAcceso.filter((p) => p.tieneMail).length}</strong> {conAcceso.filter((p) => p.tieneMail).length === 1 ? "tiene" : "tienen"} mail cargado.{" "}
              {conAcceso.filter(sinCanal).length > 0 && <span style={{ color: "#B8752B" }}>A {conAcceso.filter(sinCanal).length} no les llega nada.</span>}
            </p>
            <label style={{ fontSize: "0.85rem" }}><input type="checkbox" checked={soloSinCanal} onChange={(e) => setSoloSinCanal(e.target.checked)} style={{ marginRight: 6 }} />Ver solo a quienes no les llega nada</label>
            <table style={{ marginTop: "0.5rem" }}>
              <thead><tr><th>Legajo</th><th>Empleado</th><th>Portal</th><th>Avisos en el celular</th><th>Mail</th><th></th></tr></thead>
              <tbody>
                {personas.map((p) => (
                  <tr key={p.id}>
                    <td>{p.numero}</td>
                    <td>{p.apellido}, {p.nombre}</td>
                    <td style={{ color: p.acceso === "activo" ? "#2F6F5E" : p.acceso === "pin_temporal" ? "#B8752B" : "#6b727b" }}>{p.acceso === "activo" ? "Activo" : p.acceso === "pin_temporal" ? "Todavía no entró" : "Sin acceso"}</td>
                    <td>{p.celulares.length > 0 ? p.celulares.join(", ") : <span style={{ color: "#6b727b" }}>No activó</span>}</td>
                    <td>{p.tieneMail ? "Sí" : <span style={{ color: "#6b727b" }}>No tiene</span>}</td>
                    <td><button onClick={() => setDe(de === p.id ? "" : p.id)} style={{ background: "white", color: "#163A5C", border: "1px solid #163A5C", padding: "0.2rem 0.6rem", fontSize: "0.8rem" }}>{de === p.id ? "Ver todos" : "Ver sus avisos"}</button></td>
                  </tr>
                ))}
                {personas.length === 0 && <tr><td colSpan={6} style={{ opacity: 0.6 }}>Nadie en esta situación.</td></tr>}
              </tbody>
            </table>
          </div>

          <div style={caja}>
            <h3 style={{ marginTop: 0 }}>
              Últimos avisos{de ? ` de ${datos.personas.find((p) => p.id === de)?.apellido ?? ""}` : ""} ({datos.avisos.length}{datos.avisos.length === 200 ? ", los más recientes" : ""})
            </h3>
            {datos.avisos.length === 0 && <p style={{ opacity: 0.7 }}>Todavía no salió ningún aviso.</p>}
            {datos.avisos.length > 0 && (
              <table>
                <thead><tr><th>Cuándo</th><th>Empleado</th><th>Tema</th><th>Qué decía</th><th>Resultado</th></tr></thead>
                <tbody>
                  {datos.avisos.map((a) => {
                    const r = resultado(a);
                    return (
                      <tr key={a.id}>
                        <td style={{ whiteSpace: "nowrap" }}>{momento(a.createdAt)}</td>
                        <td>{a.legajo.apellido}, {a.legajo.nombre}</td>
                        <td>{TIPO[a.tipo] ?? a.tipo}</td>
                        <td><strong>{a.titulo}</strong><div style={{ fontSize: "0.8rem", color: "#6b727b" }}>{a.cuerpo}</div></td>
                        <td style={{ color: r.color }}>{r.texto}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            <p style={{ fontSize: "0.75rem", color: "#6b727b", marginBottom: 0 }}>"Llegó por celular" significa que el servicio de notificaciones lo aceptó; si el teléfono estaba apagado, lo recibe al encenderlo (hasta 2 días después).</p>
          </div>
        </>
      )}
    </main>
  );
}
