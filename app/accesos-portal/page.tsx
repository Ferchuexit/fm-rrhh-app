"use client";
// FM RRHH — app/accesos-portal/page.tsx
// RR.HH. administra quién entra al portal del empleado: genera el PIN
// temporal (uno o todos), lo entrega, y puede desactivar un acceso.
import { useEffect, useState } from "react";

type Acceso = { activo: boolean; debeCambiarPin: boolean; ultimoIngreso: string | null; bloqueadoHasta: string | null; updatedAt: string } | null;
type Fila = { id: string; numeroLegajo: number; apellido: string; nombre: string; condicion: string; accesoPortal: Acceso };
type Generado = { legajoId: string; numeroLegajo: number; apellido: string; nombre: string; cuil: string; pinTemporal: string };

const fecha = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }) : "—";

function estado(a: Acceso): { texto: string; color: string } {
  if (!a) return { texto: "Sin acceso", color: "#6b727b" };
  if (!a.activo) return { texto: "Desactivado", color: "#B23A3A" };
  if (a.debeCambiarPin) return { texto: "PIN temporal entregado — todavía no entró", color: "#B8752B" };
  return { texto: "Activo", color: "#2F6F5E" };
}

export default function AccesosPortalPage() {
  const [filas, setFilas] = useState<Fila[]>([]);
  const [empresa, setEmpresa] = useState("");
  const [cargando, setCargando] = useState(true);
  const [trabajando, setTrabajando] = useState("");
  const [generados, setGenerados] = useState<Generado[]>([]);
  const [error, setError] = useState("");
  const [filtro, setFiltro] = useState("");
  const [urlPortal, setUrlPortal] = useState("/portal");

  async function cargar() {
    const d = await fetch("/api/accesos-portal").then((r) => r.json());
    setFilas(d.legajos ?? []);
    setEmpresa(d.empresa ?? "");
    setCargando(false);
  }
  useEffect(() => {
    setUrlPortal(`${window.location.origin}/portal`);
    cargar();
  }, []);

  async function pedir(metodo: string, cuerpo: any) {
    const res = await fetch("/api/accesos-portal", { method: metodo, headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo) });
    const data = await res.json().catch(() => ({ error: "El servidor no devolvió una respuesta válida." }));
    if (!res.ok) throw new Error(data.error ?? "Error inesperado.");
    return data;
  }

  async function generarUno(f: Fila) {
    if (f.accesoPortal && !confirm(`${f.apellido}, ${f.nombre} ya tiene acceso. Si generás un PIN nuevo, el que tiene ahora deja de funcionar. ¿Seguir?`)) return;
    setError("");
    setTrabajando(f.id);
    try {
      const d = await pedir("POST", { legajoId: f.id });
      setGenerados(d.generados);
      await cargar();
    } catch (e: any) {
      setError(e.message);
    }
    setTrabajando("");
  }

  async function generarTodos() {
    const sinAcceso = filas.filter((f) => !f.accesoPortal && f.condicion === "activo").length;
    if (!confirm(`Se va a generar un PIN temporal para ${sinAcceso} empleado(s) activo(s) que todavía no tienen acceso. Los PIN se muestran una sola vez: descargá la lista antes de salir de esta pantalla. ¿Seguir?`)) return;
    setError("");
    setTrabajando("todos");
    const acumulado: Generado[] = [];
    try {
      // Por tandas (ver la nota en la API) hasta que no quede ninguno.
      for (let i = 0; i < 200; i++) {
        const d = await pedir("POST", { todosSinAcceso: true });
        acumulado.push(...d.generados);
        setGenerados([...acumulado]);
        if (d.restantes === 0 || d.generados.length === 0) break;
      }
    } catch (e: any) {
      setError(`${e.message} — se generaron ${acumulado.length} antes del error; podés volver a tocar el botón para seguir con el resto.`);
    }
    await cargar();
    setTrabajando("");
  }

  async function cambiarActivo(f: Fila, activo: boolean) {
    if (!activo && !confirm(`${f.apellido}, ${f.nombre} no va a poder entrar al portal hasta que lo reactives. ¿Seguir?`)) return;
    setError("");
    setTrabajando(f.id);
    try {
      await pedir("PATCH", { legajoId: f.id, activo });
      await cargar();
    } catch (e: any) {
      setError(e.message);
    }
    setTrabajando("");
  }

  function descargarLista() {
    const filasCsv = [["Legajo", "Apellido", "Nombre", "CUIL", "PIN temporal", "Ingreso"], ...generados.map((g) => [g.numeroLegajo, g.apellido, g.nombre, g.cuil, g.pinTemporal, urlPortal])];
    const csv = "﻿" + filasCsv.map((f) => f.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = "pines_temporales_portal.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const q = filtro.trim().toLowerCase();
  const visibles = filas.filter((f) => !q || `${f.numeroLegajo} ${f.apellido} ${f.nombre}`.toLowerCase().includes(q));
  const sinAcceso = filas.filter((f) => !f.accesoPortal && f.condicion === "activo").length;
  const conAcceso = filas.filter((f) => f.accesoPortal?.activo).length;
  const yaEntraron = filas.filter((f) => f.accesoPortal?.activo && !f.accesoPortal.debeCambiarPin).length;

  return (
    <main>
      <h1>Accesos al portal del empleado</h1>
      <p style={{ maxWidth: "820px" }}>
        Cada empleado entra a <a href={urlPortal} target="_blank" rel="noopener"><code>{urlPortal}</code></a> con su CUIL (o DNI) y un PIN de 6
        números, y ve <strong>solo sus propios recibos</strong>. Acá generás el PIN temporal para entregarle; en el primer ingreso el sistema lo
        obliga a elegir uno propio.
      </p>
      <p>
        <strong>{empresa}</strong> — {conAcceso} con acceso ({yaEntraron} ya entraron) · {sinAcceso} activos sin acceso
      </p>

      {error && <p style={{ color: "#B23A3A", background: "#f8e4e4", padding: "0.6rem 0.8rem", maxWidth: "900px" }}>{error}</p>}

      {generados.length > 0 && (
        <div style={{ background: "#fdf1e1", border: "1px solid #efcf9f", padding: "1rem", maxWidth: "900px", marginBottom: "1rem" }}>
          <strong>PIN temporales recién generados ({generados.length})</strong>
          <p style={{ margin: "0.4rem 0 0.75rem", fontSize: "0.9rem" }}>
            Se muestran <strong>solo ahora</strong> — el sistema guarda el PIN cifrado y no lo puede volver a mostrar. Entregá cada uno en mano a su
            dueño (no por un grupo). Si alguno se pierde, generale otro.
          </p>
          <table style={{ maxWidth: "640px" }}>
            <thead><tr><th>Legajo</th><th>Empleado</th><th>PIN temporal</th></tr></thead>
            <tbody>
              {generados.slice(0, 15).map((g) => (
                <tr key={g.legajoId}><td>{g.numeroLegajo}</td><td>{g.apellido}, {g.nombre}</td><td><code style={{ fontSize: "1.05rem", letterSpacing: "0.15em" }}>{g.pinTemporal}</code></td></tr>
              ))}
            </tbody>
          </table>
          {generados.length > 15 && <p style={{ fontSize: "0.85rem" }}>…y {generados.length - 15} más: están todos en la lista descargable.</p>}
          <div style={{ marginTop: "0.75rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <button onClick={descargarLista}>⬇ Descargar lista (Excel/CSV)</button>
            <button onClick={() => confirm("¿Ya entregaste o descargaste los PIN? No se van a poder ver de nuevo.") && setGenerados([])} style={{ background: "white", color: "#163A5C", border: "1px solid #163A5C" }}>
              Ya los tengo, ocultar
            </button>
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap", marginBottom: "0.75rem" }}>
        <input placeholder="Buscar por legajo o apellido" value={filtro} onChange={(e) => setFiltro(e.target.value)} style={{ padding: "0.5rem", width: "260px" }} />
        <button onClick={generarTodos} disabled={sinAcceso === 0 || trabajando !== ""}>
          {trabajando === "todos" ? `Generando… (${generados.length})` : `Generar PIN para los ${sinAcceso} sin acceso`}
        </button>
      </div>

      {cargando ? (
        <p>Cargando…</p>
      ) : (
        <table>
          <thead><tr><th>Legajo</th><th>Empleado</th><th>Estado</th><th>Último ingreso</th><th></th></tr></thead>
          <tbody>
            {visibles.map((f) => {
              const est = estado(f.accesoPortal);
              const ocupado = trabajando !== "";
              return (
                <tr key={f.id}>
                  <td>{f.numeroLegajo}</td>
                  <td>{f.apellido}, {f.nombre}{f.condicion !== "activo" ? <span style={{ color: "#6b727b" }}> ({f.condicion})</span> : null}</td>
                  <td style={{ color: est.color, fontWeight: 600 }}>{est.texto}</td>
                  <td>{fecha(f.accesoPortal?.ultimoIngreso ?? null)}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <button onClick={() => generarUno(f)} disabled={ocupado} style={{ padding: "0.35rem 0.7rem", fontSize: "0.8rem" }}>
                      {trabajando === f.id ? "…" : f.accesoPortal ? "PIN nuevo" : "Dar acceso"}
                    </button>{" "}
                    {f.accesoPortal && (
                      <button onClick={() => cambiarActivo(f, !f.accesoPortal!.activo)} disabled={ocupado}
                        style={{ padding: "0.35rem 0.7rem", fontSize: "0.8rem", background: "white", color: "#163A5C", border: "1px solid #163A5C" }}>
                        {f.accesoPortal.activo ? "Desactivar" : "Reactivar"}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {visibles.length === 0 && <tr><td colSpan={5}>No hay legajos que coincidan.</td></tr>}
          </tbody>
        </table>
      )}
    </main>
  );
}
