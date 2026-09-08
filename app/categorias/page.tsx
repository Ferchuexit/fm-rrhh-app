"use client";
import { useState, useEffect } from "react";

export default function CategoriasPage() {
  const [convenios, setConvenios] = useState<any[]>([]);
  const [categorias, setCategorias] = useState<any[]>([]);
  const [filtroConvenio, setFiltroConvenio] = useState("");
  const [convenioNuevo, setConvenioNuevo] = useState("");
  const [nombre, setNombre] = useState("");
  const [error, setError] = useState("");
  const [creando, setCreando] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nombreEditado, setNombreEditado] = useState("");

  async function guardarNombre(id: string) {
    if (!nombreEditado.trim()) return;
    const res = await fetch(`/api/categorias/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: nombreEditado }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      alert(data?.error ?? "No se pudo renombrar.");
      return;
    }
    setEditandoId(null);
    cargar(filtroConvenio || undefined);
  }

  async function cargar(convenioId?: string) {
    const params = convenioId ? `?convenioId=${convenioId}` : "";
    const res = await fetch(`/api/categorias${params}`);
    setCategorias(await res.json());
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const cv = params.get("convenioId") ?? "";
    setFiltroConvenio(cv);
    setConvenioNuevo(cv);
    fetch("/api/convenios").then((r) => r.json()).then(setConvenios);
    cargar(cv || undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { cargar(filtroConvenio || undefined); }, [filtroConvenio]); // eslint-disable-line react-hooks/exhaustive-deps

  async function crear() {
    setError("");
    if (!convenioNuevo || !nombre.trim()) {
      setError("Elegí el convenio y completá el nombre.");
      return;
    }
    setCreando(true);
    const res = await fetch("/api/categorias", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ convenioId: convenioNuevo, nombre }),
    });
    const data = await res.json();
    setCreando(false);
    if (!res.ok) {
      setError(data.error);
      return;
    }
    setNombre("");
    cargar(filtroConvenio || undefined);
  }

  return (
    <main>
      <h1>Categorías</h1>
      <p>Las categorías de cada convenio — a cada una hay que cargarle después una escala (básico o valor hora) para poder liquidar.</p>

      <div style={{ background: "white", border: "1px solid #dfe4e8", padding: "1rem", marginBottom: "1.5rem", maxWidth: "600px" }}>
        <h3 style={{ marginTop: 0 }}>Agregar categoría</h3>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
          <select value={convenioNuevo} onChange={(e) => setConvenioNuevo(e.target.value)}>
            <option value="">Elegir convenio...</option>
            {convenios.map((c) => <option key={c.id} value={c.id}>{c.codigo} — {c.nombre}</option>)}
          </select>
          <input placeholder="Nombre (ej. OFICIAL GENERAL)" value={nombre} onChange={(e) => setNombre(e.target.value)} style={{ flex: 1, minWidth: "200px" }} />
          <button onClick={crear} disabled={creando}>{creando ? "Creando..." : "Agregar"}</button>
        </div>
        {error && <p style={{ color: "#B23A3A", fontSize: "0.85rem" }}>{error}</p>}
        <p style={{ fontSize: "0.75rem", opacity: 0.6, marginTop: "0.5rem" }}>
          Después de crear la categoría, todavía hace falta cargarle una escala — hoy eso se hace por script
          (ver <code>prisma/import-catalogo-real.ts</code> como ejemplo), no tiene pantalla propia todavía.
        </p>
      </div>

      <div style={{ marginBottom: "1rem" }}>
        <label>
          Filtrar por convenio:{" "}
          <select value={filtroConvenio} onChange={(e) => setFiltroConvenio(e.target.value)}>
            <option value="">Todos</option>
            {convenios.map((c) => <option key={c.id} value={c.id}>{c.codigo} — {c.nombre}</option>)}
          </select>
        </label>
      </div>

      <table>
        <thead>
          <tr>
            <th>Convenio</th>
            <th>Categoría</th>
            <th>Legajos</th>
            <th>Escalas cargadas</th>
          </tr>
        </thead>
        <tbody>
          {categorias.map((c) => (
            <tr key={c.id}>
              <td>{c.convenio?.codigo}</td>
              <td>
                {editandoId === c.id ? (
                  <span>
                    <input
                      value={nombreEditado}
                      onChange={(e) => setNombreEditado(e.target.value)}
                      style={{ fontSize: "0.85rem", width: "180px" }}
                      autoFocus
                    />
                    <button onClick={() => guardarNombre(c.id)} style={{ marginLeft: "0.3rem", fontSize: "0.75rem" }}>✔</button>
                    <button onClick={() => setEditandoId(null)} style={{ marginLeft: "0.2rem", fontSize: "0.75rem" }}>✕</button>
                  </span>
                ) : (
                  <span>
                    {c.nombre}{" "}
                    <button onClick={() => { setEditandoId(c.id); setNombreEditado(c.nombre); }} style={{ fontSize: "0.7rem", padding: "0.05rem 0.4rem" }}>
                      Renombrar
                    </button>
                  </span>
                )}
              </td>
              <td>{c._count?.legajos ?? 0}</td>
              <td style={{ color: (c._count?.escalas ?? 0) === 0 ? "#B23A3A" : undefined }}>
                <a href={`/escalas?categoriaId=${c.id}`}>
                  {c._count?.escalas ?? 0}{(c._count?.escalas ?? 0) === 0 && " — sin escala todavía"}
                </a>
              </td>
            </tr>
          ))}
          {categorias.length === 0 && (
            <tr><td colSpan={4} style={{ opacity: 0.6 }}>No hay categorías cargadas para este filtro.</td></tr>
          )}
        </tbody>
      </table>
    </main>
  );
}
