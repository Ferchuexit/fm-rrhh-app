"use client";
import { useState, useEffect, Fragment } from "react";

const ROLES = ["admin", "operador", "lectura"];
const ROL_DESC: Record<string, string> = {
  admin: "Acceso total a todas las empresas, incluida esta pantalla, los roles y la configuración",
  operador: "Usuario normal. Lo que puede hacer en cada empresa lo define el rol que le asignes en «Ver / asignar»; sin rol, hace el trabajo diario sin tocar la configuración",
  lectura: "Igual que operador, pero en las empresas donde no tenga un rol asignado solo puede mirar",
};

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [nuevo, setNuevo] = useState({ email: "", nombre: "", password: "", rol: "operador" });
  const [editando, setEditando] = useState<Record<string, { nombre: string; rol: string; password: string }>>({});
  const [empresasPanel, setEmpresasPanel] = useState<string | null>(null); // id del usuario cuyo panel de empresas está abierto
  const [empresasDelUsuario, setEmpresasDelUsuario] = useState<any[]>([]);
  const [roles, setRoles] = useState<{ id: string; nombre: string }[]>([]);

  async function abrirPanelEmpresas(id: string) {
    if (empresasPanel === id) { setEmpresasPanel(null); return; }
    const res = await fetch(`/api/usuarios/${id}/empresas`);
    setEmpresasDelUsuario(await res.json());
    setEmpresasPanel(id);
  }

  function toggleSector(empresaId: string, sectorId: string) {
    setEmpresasDelUsuario((prev) => prev.map((e) => (e.id !== empresaId ? e : { ...e, sectores: (e.sectores ?? []).includes(sectorId) ? e.sectores.filter((x: string) => x !== sectorId) : [...(e.sectores ?? []), sectorId] })));
  }

  function cambiarRol(empresaId: string, rolId: string) {
    setEmpresasDelUsuario((prev) => prev.map((e) => (e.id === empresaId ? { ...e, rolId: rolId || null } : e)));
  }

  function toggleEmpresa(empresaId: string) {
    setEmpresasDelUsuario((prev) => prev.map((e) => (e.id === empresaId ? { ...e, asignada: !e.asignada } : e)));
  }

  async function guardarEmpresas(id: string) {
    const asignaciones = empresasDelUsuario.filter((e) => e.asignada).map((e) => ({ empresaId: e.id, rolId: e.rolId ?? null, sectores: e.sectores ?? [] }));
    const res = await fetch(`/api/usuarios/${id}/empresas`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ asignaciones }),
    });
    if (!res.ok) { const d = await res.json().catch(() => ({})); setError(d.error ?? "No se pudo guardar."); return; }
    setEmpresasPanel(null);
  }

  async function cargar() {
    const res = await fetch("/api/usuarios");
    if (res.ok) setUsuarios(await res.json());
  }

  useEffect(() => {
    cargar();
    fetch("/api/roles").then((r) => r.json()).then((d) => setRoles(d.roles ?? [])).catch(() => {});
  }, []);

  async function crear() {
    setError("");
    const res = await fetch("/api/usuarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(nuevo),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error);
      return;
    }
    setNuevo({ email: "", nombre: "", password: "", rol: "operador" });
    cargar();
  }

  function empezarEdicion(u: any) {
    setEditando({ ...editando, [u.id]: { nombre: u.nombre, rol: u.rol, password: "" } });
  }

  async function guardarEdicion(id: string) {
    setError("");
    const e = editando[id];
    const res = await fetch(`/api/usuarios/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: e.nombre, rol: e.rol, password: e.password || undefined }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error);
      return;
    }
    const copia = { ...editando };
    delete copia[id];
    setEditando(copia);
    cargar();
  }

  async function eliminar(id: string, email: string) {
    if (!confirm(`¿Eliminar el usuario "${email}"? Esto no se puede deshacer.`)) return;
    setError("");
    const res = await fetch(`/api/usuarios/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error);
      return;
    }
    cargar();
  }

  return (
    <main>
      <h1>Usuarios</h1>
      <p>Solo los administradores ven esta pantalla — está protegido a nivel de servidor, no es solo un link escondido.</p>

      <div style={{ background: "white", border: "1px solid #dfe4e8", padding: "1rem", marginBottom: "1.5rem", maxWidth: "600px" }}>
        <h3 style={{ marginTop: 0 }}>Nuevo usuario</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", maxWidth: "320px" }}>
          <input placeholder="Email" value={nuevo.email} onChange={(e) => setNuevo({ ...nuevo, email: e.target.value })} />
          <input placeholder="Nombre" value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} />
          <input placeholder="Contraseña (mínimo 6 caracteres)" type="password" value={nuevo.password} onChange={(e) => setNuevo({ ...nuevo, password: e.target.value })} />
          <select value={nuevo.rol} onChange={(e) => setNuevo({ ...nuevo, rol: e.target.value })}>
            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <p style={{ fontSize: "0.75rem", opacity: 0.6, maxWidth: "500px" }}>{ROL_DESC[nuevo.rol]}</p>
        <button onClick={crear}>Crear usuario</button>
        {error && <p style={{ color: "#B23A3A" }}>{error}</p>}
      </div>

      <table>
        <thead>
          <tr><th>Email</th><th>Nombre</th><th>Rol</th><th>Empresas</th><th>Creado</th><th></th></tr>
        </thead>
        <tbody>
          {usuarios.map((u) => (
            <Fragment key={u.id}>
            <tr>
              <td>{u.email}</td>
              <td>
                {editando[u.id] ? (
                  <input value={editando[u.id].nombre} onChange={(e) => setEditando({ ...editando, [u.id]: { ...editando[u.id], nombre: e.target.value } })} style={{ width: "140px" }} />
                ) : (
                  u.nombre
                )}
              </td>
              <td>
                {editando[u.id] ? (
                  <select value={editando[u.id].rol} onChange={(e) => setEditando({ ...editando, [u.id]: { ...editando[u.id], rol: e.target.value } })}>
                    {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                ) : (
                  u.rol
                )}
              </td>
              <td>
                {u.rol === "admin" ? (
                  <span style={{ fontSize: "0.78rem", opacity: 0.6 }}>Todas (admin)</span>
                ) : (
                  <button onClick={() => abrirPanelEmpresas(u.id)} style={{ fontSize: "0.75rem" }}>
                    {empresasPanel === u.id ? "Cerrar" : "Ver / asignar"}
                  </button>
                )}
              </td>
              <td style={{ fontSize: "0.8rem", opacity: 0.7 }}>{u.createdAt.slice(0, 10)}</td>
              <td>
                {editando[u.id] ? (
                  <>
                    <input
                      type="password"
                      placeholder="nueva contraseña (opcional)"
                      value={editando[u.id].password}
                      onChange={(e) => setEditando({ ...editando, [u.id]: { ...editando[u.id], password: e.target.value } })}
                      style={{ width: "160px", fontSize: "0.75rem", marginRight: "0.3rem" }}
                    />
                    <button onClick={() => guardarEdicion(u.id)} style={{ fontSize: "0.75rem" }}>Guardar</button>
                  </>
                ) : (
                  <>
                    <button onClick={() => empezarEdicion(u)} style={{ fontSize: "0.75rem", marginRight: "0.3rem" }}>Editar</button>
                    <button onClick={() => eliminar(u.id, u.email)} style={{ fontSize: "0.75rem", background: "white", color: "#B23A3A", border: "1px solid #B23A3A" }}>
                      Eliminar
                    </button>
                  </>
                )}
              </td>
            </tr>
            {empresasPanel === u.id && (
              <tr>
                <td colSpan={6} style={{ background: "var(--gris-claro)", padding: "0.8rem" }}>
                  <p style={{ margin: "0 0 0.5rem", fontSize: "0.8rem", maxWidth: "760px" }}>
                    Empresas a las que entra <strong>{u.nombre}</strong>, y con qué rol en cada una. Sin marcar, la empresa no le aparece. El rol define
                    qué módulos ve y cuáles puede modificar — se arman en <a href="/roles">Roles y permisos</a>. El cambio le llega en unos minutos, sin
                    que tenga que volver a entrar.
                    Con <strong>sectores</strong> marcados, solo ve a la gente de esos centros de costo; requiere un rol de Gestión Humana (por ejemplo, Supervisor).
                  </p>
                  {empresasDelUsuario.map((e) => (
                    <div key={e.id} style={{ display: "flex", alignItems: "baseline", gap: "0.75rem", fontSize: "0.85rem", marginBottom: "0.5rem", flexWrap: "wrap" }}>
                      <label style={{ minWidth: "260px" }}>
                        <input type="checkbox" checked={e.asignada} onChange={() => toggleEmpresa(e.id)} style={{ marginRight: "0.4rem" }} />
                        {e.nombreFantasia || e.razonSocial}
                      </label>
                      {e.asignada && (
                        <select value={e.rolId ?? ""} onChange={(ev) => cambiarRol(e.id, ev.target.value)} style={{ padding: "0.25rem" }}>
                          <option value="">Sin rol — como antes ({u.rol === "lectura" ? "solo lectura" : "operador"})</option>
                          {roles.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
                        </select>
                      )}
                      {e.asignada && (e.centrosCosto ?? []).length > 0 && (
                        <span style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", alignItems: "baseline" }}>
                          <span style={{ color: "#6b727b" }}>Sectores:</span>
                          {e.centrosCosto.map((c: any) => (
                            <label key={c.id}>
                              <input type="checkbox" checked={(e.sectores ?? []).includes(c.id)} onChange={() => toggleSector(e.id, c.id)} style={{ marginRight: "0.25rem" }} />
                              {c.nombre}
                            </label>
                          ))}
                          <em style={{ color: "#6b727b" }}>{(e.sectores ?? []).length === 0 ? "ninguno marcado = ve toda la empresa" : "solo ve y gestiona gente de los marcados"}</em>
                        </span>
                      )}
                    </div>
                  ))}
                  {empresasDelUsuario.length === 0 && <p style={{ fontSize: "0.8rem", opacity: 0.6 }}>No hay ninguna empresa cargada todavía.</p>}
                  <button onClick={() => guardarEmpresas(u.id)} style={{ marginTop: "0.5rem", fontSize: "0.8rem" }}>Guardar accesos</button>
                </td>
              </tr>
            )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </main>
  );
}
