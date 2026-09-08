"use client";
import { useState, useEffect, Fragment } from "react";

const ROLES = ["admin", "operador", "lectura"];
const ROL_DESC: Record<string, string> = {
  admin: "Acceso total, incluida esta pantalla y la configuración (conceptos, reglas, parámetros)",
  operador: "Trabajo diario: legajos, novedades, liquidar, auditar, vacaciones, exportar — sin tocar la configuración",
  lectura: "Solo puede ver — cualquier acción que modifique algo queda bloqueada",
};

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [nuevo, setNuevo] = useState({ email: "", nombre: "", password: "", rol: "operador" });
  const [editando, setEditando] = useState<Record<string, { nombre: string; rol: string; password: string }>>({});
  const [empresasPanel, setEmpresasPanel] = useState<string | null>(null); // id del usuario cuyo panel de empresas está abierto
  const [empresasDelUsuario, setEmpresasDelUsuario] = useState<any[]>([]);

  async function abrirPanelEmpresas(id: string) {
    if (empresasPanel === id) { setEmpresasPanel(null); return; }
    const res = await fetch(`/api/usuarios/${id}/empresas`);
    setEmpresasDelUsuario(await res.json());
    setEmpresasPanel(id);
  }

  function toggleEmpresa(empresaId: string) {
    setEmpresasDelUsuario((prev) => prev.map((e) => (e.id === empresaId ? { ...e, asignada: !e.asignada } : e)));
  }

  async function guardarEmpresas(id: string) {
    const empresaIds = empresasDelUsuario.filter((e) => e.asignada).map((e) => e.id);
    await fetch(`/api/usuarios/${id}/empresas`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ empresaIds }),
    });
    setEmpresasPanel(null);
  }

  async function cargar() {
    const res = await fetch("/api/usuarios");
    if (res.ok) setUsuarios(await res.json());
  }

  useEffect(() => {
    cargar();
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
                  <p style={{ margin: "0 0 0.5rem", fontSize: "0.8rem" }}>
                    Empresas que <strong>{u.nombre}</strong> puede ver (sin marcar acá, no le aparecen en el selector aunque existan en el sistema):
                  </p>
                  {empresasDelUsuario.map((e) => (
                    <label key={e.id} style={{ display: "block", fontSize: "0.85rem", marginBottom: "0.2rem" }}>
                      <input type="checkbox" checked={e.asignada} onChange={() => toggleEmpresa(e.id)} style={{ marginRight: "0.4rem" }} />
                      {e.nombreFantasia || e.razonSocial}
                    </label>
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
