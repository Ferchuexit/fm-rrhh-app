"use client";
// FM RRHH — app/celebraciones/page.tsx
// Cumpleaños y aniversarios en la empresa: quién festeja hoy y en los
// próximos días, para que RR.HH. se anticipe (un saludo, un presente en un
// aniversario redondo).
import { useEffect, useState } from "react";

type Cel = { legajoId: string; nombre: string; sector: string | null; tipo: "cumple" | "aniversario"; fecha: string; anios: number | null; hito: boolean; faltan: number; reservado: boolean };
const caja: React.CSSProperties = { background: "white", border: "1px solid #dfe4e8", padding: "1rem", marginBottom: "1rem", maxWidth: "900px" };
const diaLargo = (iso: string) => new Date(iso).toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

export default function CelebracionesPage() {
  const [datos, setDatos] = useState<{ celebraciones: Cel[]; sinFecha: string[] } | null>(null);
  const [error, setError] = useState("");
  const [dias, setDias] = useState(60);
  const [soloHitos, setSoloHitos] = useState(false);

  useEffect(() => {
    fetch(`/api/celebraciones?dias=${dias}`).then(async (res) => {
      const d = await res.json().catch(() => ({ error: "El servidor no devolvió una respuesta válida." }));
      if (!res.ok) setError(d.error ?? "No se pudo cargar."); else { setError(""); setDatos(d); }
    });
  }, [dias]);

  const lista = (datos?.celebraciones ?? []).filter((c) => !soloHitos || c.hito);
  const hoy = lista.filter((c) => c.faltan === 0);
  const despues = lista.filter((c) => c.faltan > 0);
  const fila = (c: Cel) => (
    <tr key={c.legajoId + c.tipo}>
      <td style={{ whiteSpace: "nowrap" }}>{c.faltan === 0 ? <strong>Hoy</strong> : c.faltan === 1 ? "Mañana" : diaLargo(c.fecha)}</td>
      <td>{c.tipo === "cumple" ? "🎂" : "🏅"} <strong>{c.nombre}</strong>{c.sector && <span style={{ color: "#6b727b" }}> · {c.sector}</span>}</td>
      <td>{c.tipo === "cumple" ? <>Cumpleaños{c.reservado && <span style={{ color: "#8a5413" }}> — pidió no mostrarlo a los compañeros</span>}</> : <>{c.anios === 1 ? "1 año" : `${c.anios} años`} en la empresa{c.hito && <strong style={{ color: "#2F6F5E" }}> · aniversario redondo</strong>}</>}</td>
    </tr>
  );

  return (
    <main>
      <h1>Cumpleaños y aniversarios</h1>
      <p style={{ maxWidth: "860px" }}>
        Salen solos de la fecha de nacimiento y de ingreso del legajo. Ese día, la persona recibe un saludo y su jefe un aviso para que salude; los compañeros lo ven en el muro del portal.
        Nunca se muestra la edad.
      </p>
      {error && <p style={{ color: "#B23A3A" }}>{error}</p>}
      {!datos && !error && <p>Cargando…</p>}
      {datos && (
        <>
          <p>
            <label>Ver los próximos <select value={dias} onChange={(e) => setDias(Number(e.target.value))}><option value={30}>30 días</option><option value={60}>60 días</option><option value={120}>4 meses</option><option value={365}>12 meses</option></select></label>{" "}
            <label style={{ marginLeft: 12 }}><input type="checkbox" checked={soloHitos} onChange={(e) => setSoloHitos(e.target.checked)} style={{ marginRight: 5 }} />Solo aniversarios redondos (1, 5, 10, 15… años)</label>
          </p>
          <div style={{ ...caja, borderLeft: "4px solid #2F6F5E" }}>
            <strong style={{ color: "#163A5C" }}>Hoy</strong>
            {hoy.length === 0 ? <p style={{ margin: "0.3rem 0 0", color: "#6b727b" }}>Hoy no festeja nadie.</p> : <table style={{ marginTop: "0.4rem" }}><tbody>{hoy.map(fila)}</tbody></table>}
          </div>
          <div style={caja}>
            <strong style={{ color: "#163A5C" }}>Lo que viene ({despues.length})</strong>
            {despues.length === 0 ? <p style={{ margin: "0.3rem 0 0", color: "#6b727b" }}>Nada en ese plazo.</p> : <table style={{ marginTop: "0.4rem" }}><thead><tr><th>Cuándo</th><th>Quién</th><th>Qué</th></tr></thead><tbody>{despues.map(fila)}</tbody></table>}
          </div>
          {datos.sinFecha.length > 0 && <p style={{ maxWidth: 900, fontSize: "0.88rem", color: "#8a5413" }}><strong>{datos.sinFecha.length} {datos.sinFecha.length === 1 ? "persona no tiene" : "personas no tienen"} fecha de nacimiento en el legajo</strong> y no aparecen en los cumpleaños: {datos.sinFecha.slice(0, 15).join(" · ")}{datos.sinFecha.length > 15 && "…"}. Se carga en <a href="/legajos">Legajos</a>.</p>}
        </>
      )}
    </main>
  );
}
