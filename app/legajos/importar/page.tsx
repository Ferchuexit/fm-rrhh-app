"use client";
// FM RRHH — app/legajos/importar/page.tsx
// Carga de legajos desde Excel, en tres pasos: bajar la planilla, subirla
// completa, y revisar ANTES de guardar qué se crea, qué se actualiza y qué
// está mal. Nada se guarda hasta confirmar, y con una sola fila con error
// no se guarda ninguna.
import { useState } from "react";
import * as XLSX from "xlsx";
import { columnaDe, COLUMNAS, MAX_FILAS } from "@/lib/importar-legajos-reglas";

type Fila = { fila: number; accion: "crear" | "actualizar" | "error"; errores: string[]; avisos: string[]; legajo: number | null; nombre: string; cuil: string; sector: string | null; puesto: string | null; jefe: string | null };
type Analisis = { filas: Fila[]; crearSectores: string[]; crearPuestos: string[]; resumen: { total: number; crear: number; actualizar: number; errores: number } };

const caja: React.CSSProperties = { background: "white", border: "1px solid #dfe4e8", padding: "1rem", marginBottom: "1rem", maxWidth: "1100px" };
const btnSec: React.CSSProperties = { background: "white", color: "#163A5C", border: "1px solid #163A5C" };
const VISTA = { crear: { color: "#0ca30c", icono: "●", texto: "Se crea" }, actualizar: { color: "#2a78d6", icono: "●", texto: "Se actualiza" }, error: { color: "#d03b3b", icono: "◆", texto: "Con error" } } as const;

export default function ImportarLegajosPage() {
  const [filas, setFilas] = useState<Record<string, unknown>[] | null>(null);
  const [archivo, setArchivo] = useState("");
  const [sinReconocer, setSinReconocer] = useState<string[]>([]);
  const [analisis, setAnalisis] = useState<Analisis | null>(null);
  const [error, setError] = useState("");
  const [listo, setListo] = useState<{ creados: number; actualizados: number; sectores: number; puestos: number } | null>(null);
  const [trabajando, setTrabajando] = useState(false);
  const [soloErrores, setSoloErrores] = useState(false);

  async function enviar(datos: Record<string, unknown>[], confirmar: boolean) {
    setTrabajando(true);
    setError("");
    const res = await fetch("/api/legajos/importar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ filas: datos, confirmar }) }).catch(() => null);
    const d = res ? await res.json().catch(() => ({ error: "El servidor no devolvió una respuesta válida." })) : { error: "No hay conexión." };
    setTrabajando(false);
    if (d.filas) setAnalisis(d);
    if (!res?.ok) { setError(d.error ?? "No se pudo procesar."); return; }
    if (confirmar) { setListo(d); setAnalisis(null); setFilas(null); }
  }

  async function elegir(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setError(""); setAnalisis(null); setListo(null); setFilas(null); setArchivo(f.name);
    try {
      const libro = XLSX.read(await f.arrayBuffer());
      // La hoja "Legajos" si está; si no, la primera.
      const hoja = libro.Sheets[libro.SheetNames.find((n) => n.toLowerCase() === "legajos") ?? libro.SheetNames[0]];
      const matriz = XLSX.utils.sheet_to_json<unknown[]>(hoja, { header: 1, raw: true, defval: "" });
      const encabezados = (matriz[0] ?? []).map((h) => String(h ?? ""));
      const claves = encabezados.map(columnaDe);
      const faltan = COLUMNAS.filter((c) => c.obligatoria && !claves.includes(c.clave)).map((c) => c.titulo);
      if (faltan.length) { setError(`A la planilla le faltan estas columnas: ${faltan.join(", ")}. Usá la planilla modelo sin cambiarle los títulos.`); return; }
      setSinReconocer(encabezados.filter((h, i) => h.trim() && !claves[i]));
      const datos = matriz.slice(1).map((r) => Object.fromEntries(claves.map((c, i) => [c, (r as unknown[])[i]]).filter(([c]) => c))).filter((r) => Object.values(r).some((v) => String(v ?? "").trim() !== ""));
      if (datos.length === 0) { setError("La planilla no tiene filas con datos."); return; }
      if (datos.length > MAX_FILAS) { setError(`La planilla tiene ${datos.length} filas y el máximo es ${MAX_FILAS}: partila en dos.`); return; }
      setFilas(datos);
      enviar(datos, false);
    } catch {
      setError("No se pudo leer el archivo. Tiene que ser un Excel (.xlsx).");
    }
  }

  const r = analisis?.resumen;
  const visibles = (analisis?.filas ?? []).filter((f) => !soloErrores || f.accion === "error");

  return (
    <main>
      <p style={{ margin: 0 }}><a href="/legajos">‹ Legajos</a></p>
      <h1>Cargar legajos desde Excel</h1>
      <p style={{ maxWidth: "900px" }}>
        Para dar de alta a mucha gente de una vez, o para acomodar la estructura (sector, puesto y jefe) de los que ya están. Se cargan los datos básicos; el resto de la ficha de cada uno
        (banco, obra social, cargas de familia) se completa después en su legajo.
      </p>

      <div style={caja}>
        <strong style={{ color: "#163A5C" }}>1. Bajá la planilla</strong>
        <p style={{ margin: "0.3rem 0 0.6rem" }}>Viene con los títulos de las columnas y una hoja "Referencias" con los convenios, categorías, sectores y puestos de esta empresa, escritos como hay que ponerlos.</p>
        <a href="/api/legajos/importar" download><button type="button">Descargar la planilla modelo</button></a>
      </div>

      <div style={caja}>
        <strong style={{ color: "#163A5C" }}>2. Subila completa</strong>
        <p style={{ margin: "0.3rem 0 0.6rem" }}>Una fila por persona. Si el CUIL ya existe en el sistema, de esa fila solo se toman <strong>Sector</strong>, <strong>Puesto</strong> y <strong>Reporta a</strong>.</p>
        <input type="file" accept=".xlsx,.xls" onChange={elegir} aria-label="Planilla de legajos" disabled={trabajando} />
        {archivo && <span style={{ marginLeft: 8, color: "#6b727b" }}>{archivo}</span>}
        {trabajando && <span style={{ marginLeft: 8 }}>Procesando…</span>}
        {sinReconocer.length > 0 && <p style={{ color: "#8a5413", margin: "0.5rem 0 0", fontSize: "0.9rem" }}>Estas columnas no se reconocen y se ignoran: {sinReconocer.join(", ")}.</p>}
      </div>

      {error && <p style={{ color: "#B23A3A", maxWidth: 1000, fontWeight: 600 }}>{error}</p>}
      {listo && (
        <div style={{ ...caja, borderLeft: "4px solid #0ca30c" }}>
          <strong style={{ color: "#163A5C" }}>Carga completa</strong>
          <p style={{ margin: "0.3rem 0 0.6rem" }}>{listo.creados} {listo.creados === 1 ? "legajo creado" : "legajos creados"} · {listo.actualizados} {listo.actualizados === 1 ? "actualizado" : "actualizados"}{listo.sectores > 0 && ` · ${listo.sectores} ${listo.sectores === 1 ? "sector nuevo" : "sectores nuevos"}`}{listo.puestos > 0 && ` · ${listo.puestos} ${listo.puestos === 1 ? "puesto nuevo" : "puestos nuevos"}`}.</p>
          <a href="/organigrama"><button type="button">Ver el organigrama</button></a> <a href="/legajos"><button type="button" style={btnSec}>Ir a Legajos</button></a>
        </div>
      )}

      {analisis && r && (
        <div style={{ ...caja, borderLeft: `4px solid ${r.errores ? VISTA.error.color : VISTA.crear.color}` }}>
          <strong style={{ color: "#163A5C" }}>3. Revisá y confirmá</strong>
          <p style={{ margin: "0.3rem 0 0.4rem" }}>
            {r.total} {r.total === 1 ? "fila" : "filas"}: <strong>{r.crear}</strong> {r.crear === 1 ? "legajo nuevo" : "legajos nuevos"}, <strong>{r.actualizar}</strong> {r.actualizar === 1 ? "que ya existe" : "que ya existen"}{r.errores > 0 && <>, <strong style={{ color: "#B23A3A" }}>{r.errores} con errores</strong></>}.
            {analisis.crearSectores.length > 0 && <> Se {analisis.crearSectores.length === 1 ? "crea el sector" : "crean los sectores"}: <strong>{analisis.crearSectores.join(", ")}</strong>.</>}
            {analisis.crearPuestos.length > 0 && <> Se {analisis.crearPuestos.length === 1 ? "crea el puesto" : "crean los puestos"}: <strong>{analisis.crearPuestos.join(", ")}</strong>.</>}
          </p>
          {r.errores > 0 ? <p style={{ color: "#B23A3A", margin: "0 0 0.6rem" }}>Corregí en el Excel las filas marcadas y volvé a subirlo. Mientras haya errores no se guarda ninguna fila (así no queda la carga por la mitad).</p>
            : <p style={{ margin: "0 0 0.6rem" }}><button onClick={() => filas && enviar(filas, true)} disabled={trabajando}>{trabajando ? "Guardando…" : `Confirmar y guardar (${r.crear + r.actualizar})`}</button> <span style={{ color: "#6b727b", fontSize: "0.88rem" }}>Hasta acá no se guardó nada.</span></p>}
          {r.errores > 0 && <label style={{ fontSize: "0.9rem" }}><input type="checkbox" checked={soloErrores} onChange={(e) => setSoloErrores(e.target.checked)} style={{ marginRight: 5 }} />Ver solo las filas con errores</label>}
          <div style={{ overflowX: "auto", marginTop: "0.5rem" }}>
            <table style={{ fontSize: "0.88rem" }}>
              <thead><tr><th>Fila</th><th>Qué pasa</th><th>Legajo</th><th>Persona</th><th>CUIL</th><th>Sector</th><th>Puesto</th><th>Reporta a</th><th>Detalle</th></tr></thead>
              <tbody>
                {visibles.map((f) => (
                  <tr key={f.fila} style={f.accion === "error" ? { background: "#fbefef" } : undefined}>
                    <td>{f.fila}</td>
                    <td style={{ whiteSpace: "nowrap" }}><span aria-hidden="true" style={{ color: VISTA[f.accion].color }}>{VISTA[f.accion].icono}</span> {VISTA[f.accion].texto}</td>
                    <td>{f.legajo ?? ""}</td><td>{f.nombre || <em style={{ color: "#6b727b" }}>(ya cargada)</em>}</td><td style={{ whiteSpace: "nowrap" }}>{f.cuil}</td><td>{f.sector ?? ""}</td><td>{f.puesto ?? ""}</td><td>{f.jefe ?? ""}</td>
                    <td style={{ minWidth: 240 }}>{f.errores.map((e, i) => <div key={i} style={{ color: "#B23A3A" }}>{e}</div>)}{f.avisos.map((e, i) => <div key={i} style={{ color: "#8a5413" }}>{e}</div>)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </main>
  );
}
