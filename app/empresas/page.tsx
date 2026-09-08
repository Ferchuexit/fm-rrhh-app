"use client";
import { useState, useEffect } from "react";

export default function EmpresasPage() {
  const [empresas, setEmpresas] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [nueva, setNueva] = useState({ cuit: "", razonSocial: "", nombreFantasia: "" });
  const [editando, setEditando] = useState<Record<string, { cuit: string; razonSocial: string; nombreFantasia: string }>>({});

  async function cargar() {
    const res = await fetch("/api/empresas");
    setEmpresas(await res.json());
  }

  useEffect(() => {
    cargar();
  }, []);

  async function crear() {
    setError("");
    const res = await fetch("/api/empresas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(nueva),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error);
      return;
    }
    setNueva({ cuit: "", razonSocial: "", nombreFantasia: "" });
    cargar();
  }

  function empezarEdicion(e: any) {
    setEditando({ ...editando, [e.id]: { cuit: e.cuit, razonSocial: e.razonSocial, nombreFantasia: e.nombreFantasia ?? "" } });
  }

  async function guardarEdicion(id: string) {
    setError("");
    const res = await fetch(`/api/empresas/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editando[id]),
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

  async function usarEsta(id: string) {
    await fetch("/api/empresa-actual", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ empresaId: id }),
    });
    window.location.href = "/";
  }

  return (
    <main>
      <h1>Empresas</h1>
      <p>
        Cada empresa tiene sus propios legajos, períodos, centros de costo y vacaciones — los convenios, categorías y
        conceptos son catálogos compartidos (los mismos para todas, como corresponde a un CCT real).
      </p>

      <div style={{ background: "white", border: "1px solid #dfe4e8", padding: "1rem", marginBottom: "1.5rem", maxWidth: "500px" }}>
        <h3 style={{ marginTop: 0 }}>Nueva empresa</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <input placeholder="CUIT (ej. 30-64523406-1)" value={nueva.cuit} onChange={(e) => setNueva({ ...nueva, cuit: e.target.value })} />
          <input placeholder="Razón social" value={nueva.razonSocial} onChange={(e) => setNueva({ ...nueva, razonSocial: e.target.value })} />
          <input placeholder="Nombre de fantasía (opcional)" value={nueva.nombreFantasia} onChange={(e) => setNueva({ ...nueva, nombreFantasia: e.target.value })} />
        </div>
        <button onClick={crear} style={{ marginTop: "0.5rem" }}>Crear empresa</button>
        {error && <p style={{ color: "#B23A3A" }}>{error}</p>}
      </div>

      <table>
        <thead>
          <tr><th>CUIT</th><th>Razón social</th><th>Fantasía</th><th>Legajos</th><th>Períodos</th><th></th></tr>
        </thead>
        <tbody>
          {empresas.map((e) => (
            <tr key={e.id}>
              {editando[e.id] ? (
                <>
                  <td><input value={editando[e.id].cuit} onChange={(ev) => setEditando({ ...editando, [e.id]: { ...editando[e.id], cuit: ev.target.value } })} style={{ width: "110px" }} /></td>
                  <td><input value={editando[e.id].razonSocial} onChange={(ev) => setEditando({ ...editando, [e.id]: { ...editando[e.id], razonSocial: ev.target.value } })} style={{ width: "200px" }} /></td>
                  <td><input value={editando[e.id].nombreFantasia} onChange={(ev) => setEditando({ ...editando, [e.id]: { ...editando[e.id], nombreFantasia: ev.target.value } })} style={{ width: "120px" }} /></td>
                  <td colSpan={2}></td>
                  <td><button onClick={() => guardarEdicion(e.id)} style={{ fontSize: "0.75rem" }}>Guardar</button></td>
                </>
              ) : (
                <>
                  <td>{e.cuit}</td>
                  <td>{e.razonSocial}</td>
                  <td>{e.nombreFantasia ?? "—"}</td>
                  <td>{e._count.legajos}</td>
                  <td>{e._count.periodos}</td>
                  <td>
                    <button onClick={() => usarEsta(e.id)} style={{ fontSize: "0.75rem", marginRight: "0.3rem" }}>Trabajar con esta</button>
                    <button onClick={() => empezarEdicion(e)} style={{ fontSize: "0.75rem" }}>Editar</button>
                  </td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
