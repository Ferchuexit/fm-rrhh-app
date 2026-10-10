"use client";
// FM RRHH — app/roles/page.tsx
// Roles y permisos: cada rol es una grilla de módulos con tres niveles
// (sin acceso / ver / gestionar). Solo admin.
import { useEffect, useState } from "react";

type Nivel = "" | "ver" | "gestionar";
type Modulo = { clave: string; nombre: string; bloque: string; desc: string };
type Rol = { id: string; nombre: string; descripcion: string | null; predefinido: boolean; permisos: Record<string, "ver" | "gestionar">; enUso: number };

const NIVELES: { v: Nivel; texto: string; color: string }[] = [
  { v: "", texto: "Sin acceso", color: "#6b727b" },
  { v: "ver", texto: "Ver", color: "#B8752B" },
  { v: "gestionar", texto: "Gestionar", color: "#2F6F5E" },
];
const btnSec = { background: "white", color: "#163A5C", border: "1px solid #163A5C" } as const;
const chico = { padding: "0.35rem 0.7rem", fontSize: "0.8rem" } as const;

export default function RolesPage() {
  const [modulos, setModulos] = useState<Modulo[]>([]);
  const [roles, setRoles] = useState<Rol[] | null>(null);
  const [selId, setSelId] = useState("");
  const [borrador, setBorrador] = useState<{ nombre: string; descripcion: string; permisos: Record<string, Nivel> } | null>(null);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [guardando, setGuardando] = useState(false);

  async function cargar(mantener?: string) {
    const res = await fetch("/api/roles");
    const d = await res.json().catch(() => ({ error: "El servidor no devolvió una respuesta válida — mirá la terminal donde corre npm run dev." }));
    if (!res.ok || d.error) { setError(d.error ?? "No se pudo cargar."); return; }
    setModulos(d.modulos);
    setRoles(d.roles);
    const id = mantener && d.roles.some((r: Rol) => r.id === mantener) ? mantener : d.roles[0]?.id ?? "";
    elegir(d.roles.find((r: Rol) => r.id === id) ?? null);
  }
  useEffect(() => { cargar(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  function elegir(r: Rol | null) {
    setSelId(r?.id ?? "");
    setBorrador(r ? { nombre: r.nombre, descripcion: r.descripcion ?? "", permisos: { ...r.permisos } } : null);
    setAviso("");
    setError("");
  }

  const sel = roles?.find((r) => r.id === selId) ?? null;
  const cambiado = !!sel && !!borrador && (borrador.nombre !== sel.nombre || borrador.descripcion !== (sel.descripcion ?? "") || modulos.some((m) => (borrador.permisos[m.clave] ?? "") !== (sel.permisos[m.clave] ?? "")));

  async function pedir(url: string, metodo: string, cuerpo?: any) {
    setError("");
    setGuardando(true);
    const res = await fetch(url, { method: metodo, headers: { "Content-Type": "application/json" }, body: cuerpo ? JSON.stringify(cuerpo) : undefined });
    const d = await res.json().catch(() => ({ error: "El servidor no devolvió una respuesta válida." }));
    setGuardando(false);
    if (!res.ok) { setError(d.error ?? "Error inesperado."); return null; }
    return d;
  }

  async function guardar() {
    if (!sel || !borrador) return;
    if (sel.enUso > 0 && !confirm(`"${sel.nombre}" está asignado a ${sel.enUso} usuario(s). El cambio les llega en unos minutos, sin que vuelvan a entrar. ¿Guardar?`)) return;
    if (await pedir(`/api/roles/${sel.id}`, "PATCH", borrador)) { await cargar(sel.id); setAviso("Guardado."); }
  }
  async function crear(base?: Rol) {
    const nombre = prompt(base ? `Nombre para la copia de "${base.nombre}":` : "Nombre del rol nuevo:", base ? `${base.nombre} (copia)` : "");
    if (!nombre?.trim()) return;
    const d = await pedir("/api/roles", "POST", { nombre, descripcion: base?.descripcion ?? "", permisos: base?.permisos ?? {} });
    if (d) await cargar(d.id);
  }
  async function eliminar() {
    if (!sel || !confirm(`¿Eliminar el rol "${sel.nombre}"? No se puede deshacer.`)) return;
    if (await pedir(`/api/roles/${sel.id}`, "DELETE")) await cargar();
  }
  function ponerTodos(bloque: string, nivel: Nivel) {
    if (!borrador) return;
    const p = { ...borrador.permisos };
    for (const m of modulos.filter((x) => x.bloque === bloque)) p[m.clave] = nivel;
    setBorrador({ ...borrador, permisos: p });
  }

  const bloques = [...new Set(modulos.map((m) => m.bloque))];

  return (
    <main>
      <h1>Roles y permisos</h1>
      <p style={{ maxWidth: "860px" }}>
        Un rol dice qué módulos se <strong>ven</strong> y cuáles se pueden <strong>gestionar</strong> (crear, editar, aprobar, borrar). Los roles se asignan en{" "}
        <a href="/usuarios">Usuarios</a>, <strong>empresa por empresa</strong>: la misma persona puede ser Liquidador en un cliente y Solo lectura en otro. Los
        usuarios <em>admin</em> no usan roles: ven todo. Usuarios, roles y empresas no se pueden delegar.
      </p>

      {error && <p style={{ color: "#B23A3A", background: "#f8e4e4", padding: "0.6rem 0.8rem", maxWidth: "900px" }}>{error}</p>}
      {roles === null && !error && <p>Cargando…</p>}

      {roles !== null && (
        <div style={{ display: "flex", gap: "1.5rem", alignItems: "flex-start", flexWrap: "wrap" }}>
          <div style={{ width: "250px" }}>
            {roles.map((r) => (
              <button key={r.id} onClick={() => (cambiado && !confirm("Tenés cambios sin guardar en este rol. ¿Descartarlos?") ? null : elegir(r))}
                style={{ display: "block", width: "100%", textAlign: "left", marginBottom: "0.4rem", padding: "0.6rem 0.75rem", background: r.id === selId ? "#e8f0f6" : "white", color: "#163A5C", border: `1px solid ${r.id === selId ? "#163A5C" : "#dfe4e8"}`, fontWeight: r.id === selId ? 700 : 500 }}>
                {r.nombre}
                <div style={{ fontSize: "0.74rem", fontWeight: 400, color: "#6b727b" }}>{r.enUso === 0 ? "sin asignar" : `${r.enUso} asignación${r.enUso === 1 ? "" : "es"}`}{r.predefinido ? " · predefinido" : ""}</div>
              </button>
            ))}
            <button onClick={() => crear()} disabled={guardando} style={{ ...btnSec, width: "100%", marginTop: "0.3rem" }}>+ Rol nuevo</button>
          </div>

          {sel && borrador && (
            <div style={{ flex: 1, minWidth: "520px", maxWidth: "820px", background: "white", border: "1px solid #dfe4e8", padding: "1rem 1.2rem" }}>
              <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                <label style={{ flex: "1 1 220px" }}>Nombre<input value={borrador.nombre} maxLength={60} onChange={(e) => setBorrador({ ...borrador, nombre: e.target.value })} style={{ display: "block", width: "100%", padding: "0.45rem", marginTop: "0.2rem" }} /></label>
                <label style={{ flex: "2 1 320px" }}>Para qué es<input value={borrador.descripcion} maxLength={200} onChange={(e) => setBorrador({ ...borrador, descripcion: e.target.value })} style={{ display: "block", width: "100%", padding: "0.45rem", marginTop: "0.2rem" }} /></label>
              </div>

              {bloques.map((b) => (
                <div key={b} style={{ marginTop: "1.1rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: "0.5rem", borderBottom: "2px solid #7FA8C6", paddingBottom: "0.25rem" }}>
                    <strong style={{ color: "#163A5C" }}>{b}</strong>
                    <span style={{ fontSize: "0.78rem" }}>
                      Todo el bloque:{" "}
                      {NIVELES.map((n) => <button key={n.v} onClick={() => ponerTodos(b, n.v)} style={{ ...chico, ...btnSec, border: "none", padding: "0.1rem 0.4rem", textDecoration: "underline" }}>{n.texto.toLowerCase()}</button>)}
                    </span>
                  </div>
                  {modulos.filter((m) => m.bloque === b).map((m) => (
                    <div key={m.clave} style={{ display: "flex", alignItems: "center", gap: "1rem", padding: "0.5rem 0", borderBottom: "1px solid #EEF1F4" }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, color: "#163A5C" }}>{m.nombre}</div>
                        <div style={{ fontSize: "0.78rem", color: "#6b727b" }}>{m.desc}</div>
                      </div>
                      <div role="radiogroup" aria-label={m.nombre} style={{ display: "flex", border: "1px solid #cfd6dc", borderRadius: "6px", overflow: "hidden", flexShrink: 0 }}>
                        {NIVELES.map((n) => {
                          const activo = (borrador.permisos[m.clave] ?? "") === n.v;
                          return (
                            <button key={n.v} role="radio" aria-checked={activo} onClick={() => setBorrador({ ...borrador, permisos: { ...borrador.permisos, [m.clave]: n.v } })}
                              style={{ ...chico, borderRadius: 0, minWidth: "86px", background: activo ? n.color : "white", color: activo ? "white" : "#4A4F58", fontWeight: activo ? 700 : 400 }}>
                              {n.texto}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ))}

              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap", marginTop: "1.1rem" }}>
                <button onClick={guardar} disabled={guardando || !cambiado}>{guardando ? "Guardando…" : "Guardar cambios"}</button>
                <button onClick={() => crear({ ...sel, permisos: Object.fromEntries(Object.entries(borrador.permisos).filter(([, v]) => v)) as any })} disabled={guardando} style={btnSec}>Copiar como rol nuevo</button>
                {!sel.predefinido && <button onClick={eliminar} disabled={guardando} style={{ background: "white", color: "#B23A3A", border: "1px solid #B23A3A" }}>Eliminar</button>}
                {aviso && !cambiado && <span style={{ color: "#2F6F5E", fontWeight: 600 }}>{aviso}</span>}
                {cambiado && <span style={{ color: "#B8752B", fontSize: "0.85rem" }}>Hay cambios sin guardar</span>}
              </div>
              <p style={{ fontSize: "0.78rem", color: "#6b727b", marginBottom: 0 }}>
                «Ver» deja consultar, descargar y exportar. «Gestionar» suma todo lo que modifica datos. Las listas para elegir período, convenio, sector o empleado las ve cualquier rol.
              </p>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
