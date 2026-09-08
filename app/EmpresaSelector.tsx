"use client";
import { useState, useEffect } from "react";

export default function EmpresaSelector() {
  const [empresas, setEmpresas] = useState<any[]>([]);
  const [actualId, setActualId] = useState("");

  useEffect(() => {
    fetch("/api/empresa-actual").then((r) => r.json()).then((d) => {
      setEmpresas(d.empresas);
      setActualId(d.actualId ?? "");
    });
  }, []);

  async function cambiar(id: string) {
    setActualId(id);
    await fetch("/api/empresa-actual", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ empresaId: id }),
    });
    window.location.reload(); // recarga para que las páginas server-side tomen la nueva cookie
  }

  if (empresas.length <= 1) return null; // con una sola empresa cargada, no hace falta mostrar el selector

  return (
    <select
      value={actualId}
      onChange={(e) => cambiar(e.target.value)}
      style={{ fontSize: "0.8rem", background: "#0f2941", color: "white", border: "1px solid #7FA8C6" }}
    >
      {empresas.map((e) => (
        <option key={e.id} value={e.id}>{e.nombreFantasia || e.razonSocial}</option>
      ))}
    </select>
  );
}
