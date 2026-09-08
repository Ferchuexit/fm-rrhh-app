"use client";
import { useState } from "react";
import LogoFM from "../LogoFM";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  async function entrar() {
    setError("");
    setCargando(true);
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    let data;
    try {
      data = await res.json();
    } catch {
      setError("El servidor no devolvió una respuesta válida — mirá la terminal donde corre npm run dev.");
      setCargando(false);
      return;
    }
    setCargando(false);
    if (!res.ok) {
      setError(data.error);
      return;
    }
    const params = new URLSearchParams(window.location.search);
    window.location.href = params.get("redirect") || "/";
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") entrar();
  }

  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "80vh" }}>
      <div style={{ background: "white", border: "1px solid #dfe4e8", padding: "2rem", width: "320px" }}>
        <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
          <LogoFM height={40} />
        </div>
        <label style={{ display: "block", marginBottom: "0.75rem" }}>
          Email
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={onKeyDown}
            style={{ width: "100%" }}
            autoFocus
          />
        </label>
        <label style={{ display: "block", marginBottom: "1rem" }}>
          Contraseña
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={onKeyDown}
            style={{ width: "100%" }}
          />
        </label>
        <button onClick={entrar} disabled={cargando} style={{ width: "100%" }}>
          {cargando ? "Entrando..." : "Entrar"}
        </button>
        {error && <p style={{ color: "#B23A3A", fontSize: "0.85rem" }}>{error}</p>}
      </div>
    </div>
  );
}
