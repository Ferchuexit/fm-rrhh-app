"use client";
import { useState, useEffect } from "react";

export default function EstadoImplementacionPage() {
  const [estados, setEstados] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    fetch("/api/estado-implementacion").then((r) => r.json()).then((d) => { setEstados(d); setCargando(false); });
  }, []);

  function barra(pct: number) {
    const llenos = Math.round(pct / 5);
    return "█".repeat(llenos) + "░".repeat(20 - llenos);
  }

  return (
    <main>
      <h1>Estado de implementación por convenio</h1>
      <p style={{ opacity: 0.7, fontSize: "0.9rem" }}>
        Qué tan preparado está cada convenio, con datos reales — para no ofrecer algo como completo cuando todavía
        tiene puntos pendientes.
      </p>

      {cargando && <p>Cargando...</p>}

      {estados.map((e) => (
        <div key={e.convenio.id} style={{ background: "white", border: "1px solid #dfe4e8", padding: "1.2rem", marginBottom: "1rem" }}>
          <h3 style={{ marginTop: 0 }}>{e.convenio.nombre} ({e.convenio.codigo})</h3>
          <div style={{ fontFamily: "monospace", fontSize: "1.1rem", marginBottom: "0.3rem" }}>
            {barra(e.porcentaje)} {e.porcentaje}%
          </div>

          <div style={{ display: "flex", gap: "2rem", flexWrap: "wrap", marginTop: "0.8rem" }}>
            <div>
              <strong style={{ fontSize: "0.85rem" }}>Obligatorio</strong>
              <ul style={{ fontSize: "0.85rem", paddingLeft: "1.2rem", marginTop: "0.3rem" }}>
                {e.itemsObligatorios.map((i: any) => (
                  <li key={i.clave} style={{ color: i.ok ? "#2F6F5E" : "#B23A3A" }}>
                    {i.ok ? "✔" : "⚠"} {i.etiqueta}
                    {!i.ok && i.detalleSiFalta?.length > 0 && (
                      <span style={{ opacity: 0.7 }}> ({i.detalleSiFalta.join(", ")})</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <strong style={{ fontSize: "0.85rem" }}>Específico de este CCT (no es una falla si no está)</strong>
              <ul style={{ fontSize: "0.85rem", paddingLeft: "1.2rem", marginTop: "0.3rem", opacity: 0.75 }}>
                {e.itemsOpcionales.map((i: any) => (
                  <li key={i.clave}>{i.cargado ? "✔" : "—"} {i.etiqueta}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ))}

      {estados.length > 0 && (
        <div style={{ background: "white", border: "1px solid #dfe4e8", padding: "1.2rem", fontSize: "0.85rem" }}>
          <strong>Capacidades del sistema (no son por convenio — cualquiera ya las usa):</strong>
          <ul style={{ paddingLeft: "1.2rem", marginTop: "0.3rem" }}>
            {estados[0].capacidadesDelSistema.map((c: any, i: number) => (
              <li key={i} style={{ color: "#2F6F5E" }}>✔ {c.etiqueta}</li>
            ))}
          </ul>
        </div>
      )}
    </main>
  );
}
