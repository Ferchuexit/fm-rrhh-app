"use client";
import { useState, useEffect } from "react";

export default function ConveniosPage() {
  const [convenios, setConvenios] = useState<any[]>([]);
  const [codigo, setCodigo] = useState("");
  const [nombre, setNombre] = useState("");
  const [error, setError] = useState("");
  const [creando, setCreando] = useState(false);

  async function cargar() {
    const res = await fetch("/api/convenios");
    setConvenios(await res.json());
  }

  useEffect(() => { cargar(); }, []);

  async function crear() {
    setError("");
    if (!codigo.trim() || !nombre.trim()) {
      setError("Completá el código y el nombre.");
      return;
    }
    setCreando(true);
    const res = await fetch("/api/convenios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ codigo, nombre }),
    });
    const data = await res.json();
    setCreando(false);
    if (!res.ok) {
      setError(data.error);
      return;
    }
    setCodigo("");
    setNombre("");
    cargar();
  }

  return (
    <main>
      <h1>Convenios</h1>
      <p>
        Los convenios colectivos que liquidás — cada uno con sus propias categorías, escalas y fórmulas. Pensado para
        cuando un cliente se expanda a un rubro nuevo, sin tener que tocar código ni scripts.
      </p>

      <div style={{ background: "white", border: "1px solid #dfe4e8", padding: "1rem", marginBottom: "1.5rem", maxWidth: "600px" }}>
        <h3 style={{ marginTop: 0 }}>Agregar convenio</h3>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
          <input placeholder="Código (ej. 0130/75)" value={codigo} onChange={(e) => setCodigo(e.target.value)} style={{ width: "160px" }} />
          <input placeholder="Nombre (ej. Comercio — FAECYS)" value={nombre} onChange={(e) => setNombre(e.target.value)} style={{ flex: 1, minWidth: "220px" }} />
          <button onClick={crear} disabled={creando}>{creando ? "Creando..." : "Agregar"}</button>
        </div>
        {error && <p style={{ color: "#B23A3A", fontSize: "0.85rem" }}>{error}</p>}
        <p style={{ fontSize: "0.75rem", opacity: 0.6, marginTop: "0.5rem" }}>
          Después de crear el convenio, hace falta cargar sus categorías (en <a href="/categorias">/categorias</a>),
          escalas y fórmulas (en <a href="/reglas">/reglas</a>) — crear el convenio es solo el primer paso.
        </p>
      </div>

      <table>
        <thead>
          <tr>
            <th>Código</th>
            <th>Nombre</th>
            <th>Categorías</th>
            <th>Legajos</th>
          </tr>
        </thead>
        <tbody>
          {convenios.map((c) => (
            <tr key={c.id}>
              <td>{c.codigo}</td>
              <td>{c.nombre}</td>
              <td><a href={`/categorias?convenioId=${c.id}`}>{c._count?.categorias ?? 0}</a></td>
              <td>{c._count?.legajos ?? 0}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
