"use client";
import { useState, useEffect } from "react";

const seccionStyle: React.CSSProperties = { background: "white", border: "1px solid #dfe4e8", padding: "1.25rem", marginBottom: "1.25rem", maxWidth: "700px" };
const campoStyle: React.CSSProperties = { display: "flex", flexDirection: "column", marginBottom: "0.6rem" };
const labelStyle: React.CSSProperties = { fontSize: "0.78rem", color: "#4A4F58", marginBottom: "0.15rem" };
const filaStyle: React.CSSProperties = { display: "flex", gap: "1rem", flexWrap: "wrap" };

function Campo({ label, children, width = "220px" }: { label: string; children: React.ReactNode; width?: string }) {
  return (
    <div style={{ ...campoStyle, width }}>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

export default function LegajoForm({ legajoId }: { legajoId?: string }) {
  const esEdicion = !!legajoId;
  const [convenios, setConvenios] = useState<any[]>([]);
  const [categorias, setCategorias] = useState<any[]>([]);
  const [centros, setCentros] = useState<any[]>([]);
  const [nuevoCentro, setNuevoCentro] = useState("");
  const [sucursales, setSucursales] = useState<any[]>([]);
  const [nuevaSucursal, setNuevaSucursal] = useState("");
  const [error, setError] = useState("");
  const [guardado, setGuardado] = useState(false);

  const [f, setF] = useState<any>({
    numeroLegajo: "", cuil: "", apellido: "", nombre: "", fechaIngreso: "", convenioId: "", categoriaId: "",
    condicion: "activo", obraSocialId: "", cbu: "", bancoId: "", afiliadoSindicato: true,
    fechaEgreso: "", motivoBaja: "",
    tipoDocumento: "DNI", numeroDocumento: "", fechaNacimiento: "", sexo: "", estadoCivil: "",
    nivelEducativo: "", tituloObtenido: "", talleRopa: "", talleCalzado: "",
    domicilio: "", telefono: "", email: "", fotoBase64: "",
    localidad: "", provincia: "", partido: "",
    centroCostoId: "", sucursalId: "", antiguedadReconocida: "",
    modalidadContrato: "Tiempo completo", codigoArcaModalidad: "", artNombre: "", artPoliza: "",
  });

  useEffect(() => {
    fetch("/api/convenios").then((r) => r.json()).then(setConvenios);
    fetch("/api/centros-costo").then((r) => r.json()).then(setCentros);
    fetch("/api/sucursales").then((r) => r.json()).then(setSucursales);
    if (!esEdicion) {
      fetch("/api/legajos?proximoNumero=1").then((r) => r.json()).then((d) => setF((prev: any) => ({ ...prev, numeroLegajo: d.proximoNumero })));
    } else {
      fetch(`/api/legajos/${legajoId}`).then((r) => r.json()).then((d) => {
        setF({
          ...d,
          fechaIngreso: d.fechaIngreso?.slice(0, 10) ?? "",
          fechaEgreso: d.fechaEgreso?.slice(0, 10) ?? "",
          motivoBaja: d.motivoBaja ?? "",
          fechaNacimiento: d.fechaNacimiento?.slice(0, 10) ?? "",
          antiguedadReconocida: d.antiguedadReconocida?.slice(0, 10) ?? "",
          obraSocialId: d.obraSocialId ?? "", cbu: d.cbu ?? "", bancoId: d.bancoId ?? "",
          afiliadoSindicato: d.afiliadoSindicato ?? true,
          tipoDocumento: d.tipoDocumento ?? "DNI", numeroDocumento: d.numeroDocumento ?? "",
          sexo: d.sexo ?? "", estadoCivil: d.estadoCivil ?? "", domicilio: d.domicilio ?? "",
          nivelEducativo: d.nivelEducativo ?? "", tituloObtenido: d.tituloObtenido ?? "",
          talleRopa: d.talleRopa ?? "", talleCalzado: d.talleCalzado ?? "",
          localidad: d.localidad ?? "", provincia: d.provincia ?? "", partido: d.partido ?? "",
          telefono: d.telefono ?? "", email: d.email ?? "", fotoBase64: d.fotoBase64 ?? "",
          centroCostoId: d.centroCostoId ?? "", sucursalId: d.sucursalId ?? "", modalidadContrato: d.modalidadContrato ?? "Tiempo completo",
          codigoArcaModalidad: d.codigoArcaModalidad ?? "", artNombre: d.artNombre ?? "", artPoliza: d.artPoliza ?? "",
        });
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (f.convenioId) fetch(`/api/categorias?convenioId=${f.convenioId}`).then((r) => r.json()).then(setCategorias);
  }, [f.convenioId]);

  function set(campo: string, valor: any) {
    setF((prev: any) => ({ ...prev, [campo]: valor }));
  }

  const [errorFoto, setErrorFoto] = useState("");

  // Redimensiona y recomprime la foto ANTES de guardarla — dos problemas
  // reales que esto evita: 1) una foto de celular sin comprimir (varios MB)
  // puede hacer fallar el guardado sin ningún aviso claro; 2) el formato
  // HEIC (default en iPhone) no se puede mostrar en un <img> de la mayoría
  // de los navegadores — al pasarlo por un canvas, si el navegador no lo
  // puede decodificar, avisamos con un error claro en vez de fallar en
  // silencio, y si SÍ lo puede decodificar, sale convertido a JPG liviano.
  function onFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorFoto("");
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const ANCHO_MAX = 500;
        const escala = Math.min(1, ANCHO_MAX / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = img.width * escala;
        canvas.height = img.height * escala;
        const ctx = canvas.getContext("2d");
        if (!ctx) { setErrorFoto("No se pudo procesar la imagen en este navegador."); return; }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        set("fotoBase64", canvas.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = () => {
        setErrorFoto('No se pudo leer esta imagen — si es un .heic de iPhone, convertila a .jpg o .png primero (desde "Compartir" → "Guardar como JPG", o sacándole una captura de pantalla).');
      };
      img.src = reader.result as string;
    };
    reader.onerror = () => setErrorFoto("No se pudo leer el archivo.");
    reader.readAsDataURL(file);
  }

  async function crearCentro() {
    if (!nuevoCentro.trim()) return;
    const res = await fetch("/api/centros-costo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: nuevoCentro }),
    });
    const data = await res.json();
    setCentros([...centros, data]);
    set("centroCostoId", data.id);
    setNuevoCentro("");
  }

  async function crearSucursal() {
    if (!nuevaSucursal.trim()) return;
    const res = await fetch("/api/sucursales", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: nuevaSucursal }),
    });
    const data = await res.json();
    setSucursales([...sucursales, data]);
    set("sucursalId", data.id);
    setNuevaSucursal("");
  }

  async function guardar() {
    setError("");
    const url = esEdicion ? `/api/legajos/${legajoId}` : "/api/legajos";
    try {
      const res = await fetch(url, {
        method: esEdicion ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(f),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? `No se pudo guardar (error ${res.status}). Si acabás de subir una foto muy pesada, probá con otra más chica.`);
        return;
      }
      setGuardado(true);
      if (!esEdicion) window.location.href = "/legajos";
    } catch (e: any) {
      setError("No se pudo conectar con el servidor. Revisá tu conexión e intentá de nuevo.");
    }
  }

  return (
    <div style={{ display: "flex", gap: "1.5rem", alignItems: "flex-start" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
      {/* ── Principal / Datos personales ── */}
      <div style={seccionStyle}>
        <h3 style={{ marginTop: 0 }}>Datos personales</h3>
        <div style={filaStyle}>
          <Campo label="N° Legajo" width="100px">
            <input type="number" value={f.numeroLegajo} onChange={(e) => set("numeroLegajo", e.target.value)} disabled={esEdicion} />
          </Campo>
          <Campo label="Apellido">
            <input value={f.apellido} onChange={(e) => set("apellido", e.target.value)} />
          </Campo>
          <Campo label="Nombre">
            <input value={f.nombre} onChange={(e) => set("nombre", e.target.value)} />
          </Campo>
          <Campo label="Foto" width="180px">
            <input type="file" accept="image/*" onChange={onFoto} />
            {errorFoto && <p style={{ color: "var(--rojo)", fontSize: "0.72rem", margin: "0.3rem 0 0" }}>{errorFoto}</p>}
          </Campo>
        </div>
        <div style={filaStyle}>
          <Campo label="Tipo de documento" width="130px">
            <select value={f.tipoDocumento} onChange={(e) => set("tipoDocumento", e.target.value)}>
              <option>DNI</option><option>LC</option><option>LE</option><option>Pasaporte</option>
            </select>
          </Campo>
          <Campo label="N° Documento">
            <input value={f.numeroDocumento} onChange={(e) => set("numeroDocumento", e.target.value)} />
          </Campo>
          <Campo label="CUIL">
            <input value={f.cuil} onChange={(e) => set("cuil", e.target.value)} placeholder="20171871817" />
          </Campo>
          <Campo label="Fecha de nacimiento" width="150px">
            <input type="date" value={f.fechaNacimiento} onChange={(e) => set("fechaNacimiento", e.target.value)} />
          </Campo>
        </div>
        <div style={filaStyle}>
          <Campo label="Sexo" width="130px">
            <select value={f.sexo} onChange={(e) => set("sexo", e.target.value)}>
              <option value="">—</option><option>Femenino</option><option>Masculino</option><option>Otro</option>
            </select>
          </Campo>
          <Campo label="Estado civil" width="150px">
            <select value={f.estadoCivil} onChange={(e) => set("estadoCivil", e.target.value)}>
              <option value="">—</option><option>Soltero/a</option><option>Casado/a</option><option>Divorciado/a</option><option>Viudo/a</option>
            </select>
          </Campo>
          <Campo label="Teléfono" width="150px">
            <input value={f.telefono} onChange={(e) => set("telefono", e.target.value)} />
          </Campo>
          <Campo label="Email">
            <input value={f.email} onChange={(e) => set("email", e.target.value)} />
          </Campo>
        </div>
        <div style={filaStyle}>
          <Campo label="Nivel educativo" width="170px">
            <select value={f.nivelEducativo} onChange={(e) => set("nivelEducativo", e.target.value)}>
              <option value="">—</option>
              <option>Primario</option><option>Secundario</option><option>Terciario</option>
              <option>Universitario</option><option>Posgrado</option>
            </select>
          </Campo>
          <Campo label="Título obtenido" width="240px">
            <input value={f.tituloObtenido} onChange={(e) => set("tituloObtenido", e.target.value)} placeholder="Ej: Técnico Mecánico" />
          </Campo>
          <Campo label="Talle de ropa" width="130px">
            <select value={f.talleRopa} onChange={(e) => set("talleRopa", e.target.value)}>
              <option value="">—</option>
              <option>XS</option><option>S</option><option>M</option><option>L</option><option>XL</option><option>XXL</option>
            </select>
          </Campo>
          <Campo label="Talle de calzado" width="130px">
            <input value={f.talleCalzado} onChange={(e) => set("talleCalzado", e.target.value)} placeholder="Ej: 42" />
          </Campo>
        </div>
        <Campo label="Domicilio" width="100%">
          <input value={f.domicilio} onChange={(e) => set("domicilio", e.target.value)} />
        </Campo>
        <div style={filaStyle}>
          <Campo label="Localidad" width="180px">
            <input value={f.localidad} onChange={(e) => set("localidad", e.target.value)} />
          </Campo>
          <Campo label="Partido" width="180px">
            <input value={f.partido} onChange={(e) => set("partido", e.target.value)} />
          </Campo>
          <Campo label="Provincia" width="180px">
            <input value={f.provincia} onChange={(e) => set("provincia", e.target.value)} />
          </Campo>
        </div>
      </div>

      {/* ── Laboral ── */}
      <div style={seccionStyle}>
        <h3 style={{ marginTop: 0 }}>Datos laborales</h3>
        <div style={filaStyle}>
          <Campo label="Convenio">
            <select value={f.convenioId} onChange={(e) => set("convenioId", e.target.value)}>
              <option value="">Elegir...</option>
              {convenios.map((c) => <option key={c.id} value={c.id}>{c.codigo} — {c.nombre}</option>)}
            </select>
          </Campo>
          <Campo label="Categoría">
            <select value={f.categoriaId} onChange={(e) => set("categoriaId", e.target.value)}>
              <option value="">Elegir...</option>
              {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </Campo>
          <Campo label="Centro de costo / Departamento" width="260px">
            <div style={{ display: "flex", gap: "0.3rem" }}>
              <select value={f.centroCostoId} onChange={(e) => set("centroCostoId", e.target.value)} style={{ flex: 1 }}>
                <option value="">—</option>
                {centros.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
            <div style={{ display: "flex", gap: "0.3rem", marginTop: "0.3rem" }}>
              <input placeholder="nuevo..." value={nuevoCentro} onChange={(e) => setNuevoCentro(e.target.value)} style={{ flex: 1, fontSize: "0.8rem" }} />
              <button onClick={crearCentro} style={{ fontSize: "0.75rem", padding: "0.3rem 0.6rem" }}>+</button>
            </div>
          </Campo>
          <Campo label="Sucursal" width="260px">
            <div style={{ display: "flex", gap: "0.3rem" }}>
              <select value={f.sucursalId} onChange={(e) => set("sucursalId", e.target.value)} style={{ flex: 1 }}>
                <option value="">—</option>
                {sucursales.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
            </div>
            <div style={{ display: "flex", gap: "0.3rem", marginTop: "0.3rem" }}>
              <input placeholder="nueva..." value={nuevaSucursal} onChange={(e) => setNuevaSucursal(e.target.value)} style={{ flex: 1, fontSize: "0.8rem" }} />
              <button onClick={crearSucursal} style={{ fontSize: "0.75rem", padding: "0.3rem 0.6rem" }}>+</button>
            </div>
          </Campo>
        </div>
        <div style={filaStyle}>
          <Campo label="Fecha de ingreso" width="150px">
            <input type="date" value={f.fechaIngreso} onChange={(e) => set("fechaIngreso", e.target.value)} />
          </Campo>
          <Campo label="Antigüedad reconocida" width="180px">
            <input type="date" value={f.antiguedadReconocida} onChange={(e) => set("antiguedadReconocida", e.target.value)} />
          </Campo>
          <Campo label="Condición" width="130px">
            <select value={f.condicion} onChange={(e) => set("condicion", e.target.value)}>
              <option value="activo">Activo</option>
              <option value="inactivo">Inactivo</option>
              <option value="baja">Baja</option>
              <option value="licencia">Licencia</option>
            </select>
          </Campo>
        </div>
        {(f.condicion === "baja" || f.condicion === "inactivo") && (
          <div style={{ display: "flex", gap: "1rem", marginTop: "0.75rem" }}>
            <Campo label="Fecha de baja/inactivación" width="180px">
              <input type="date" value={f.fechaEgreso} onChange={(e) => set("fechaEgreso", e.target.value)} />
            </Campo>
            <Campo label="Motivo" width="320px">
              <input
                value={f.motivoBaja}
                onChange={(e) => set("motivoBaja", e.target.value)}
                placeholder="ej. sin CBU real cargado — legajo de prueba"
              />
            </Campo>
          </div>
        )}
        <p style={{ fontSize: "0.75rem", opacity: 0.6, marginTop: "0.5rem" }}>
          <strong>"Antigüedad reconocida"</strong> es la fecha real que se usa para calcular los años de antigüedad
          en liquidación y vacaciones — como si hubiera empezado a trabajar ese día, aunque la fecha de ingreso a
          esta empresa sea otra (traspasos, acuerdos de convenio). Dejala vacía si su antigüedad arranca con la
          fecha de ingreso normal, sin nada especial que reconocer. <strong>Este es el campo que hace efecto</strong> —
          la lista de "Períodos anteriores" de abajo es solo para dejar registrado por qué se reconoce esa fecha,
          el sistema no la suma sola.
        </p>

        <p style={{ fontSize: "0.75rem", opacity: 0.6, marginTop: "0.5rem" }}>
          "Inactivo" saca al legajo de liquidaciones y de las alertas de auditoría sin marcarlo como baja real
          (útil para legajos de prueba, o mientras se completan sus datos).
        </p>

        {esEdicion && <PeriodosAnteriores legajoId={legajoId!} />}
      </div>

      {/* ── Contratación / ART / Pago ── */}
      <div style={seccionStyle}>
        <h3 style={{ marginTop: 0 }}>Contratación, ART y datos de pago</h3>
        <div style={filaStyle}>
          <Campo label="Modalidad de contratación" width="200px">
            <select value={f.modalidadContrato} onChange={(e) => set("modalidadContrato", e.target.value)}>
              <option>Tiempo completo</option><option>Tiempo parcial</option><option>Plazo fijo</option><option>Eventual</option>
            </select>
          </Campo>
          <Campo label="Código ARCA (situación de revista)" width="260px">
            <input value={f.codigoArcaModalidad} onChange={(e) => set("codigoArcaModalidad", e.target.value)} placeholder="sin confirmar contra instructivo vigente" />
          </Campo>
        </div>
        <div style={filaStyle}>
          <Campo label="ART">
            <input value={f.artNombre} onChange={(e) => set("artNombre", e.target.value)} />
          </Campo>
          <Campo label="N° de póliza ART">
            <input value={f.artPoliza} onChange={(e) => set("artPoliza", e.target.value)} />
          </Campo>
        </div>
        <div style={filaStyle}>
          <Campo label="Obra social">
            <input value={f.obraSocialId} onChange={(e) => set("obraSocialId", e.target.value)} />
          </Campo>
          <Campo label="Banco">
            <input value={f.bancoId} onChange={(e) => set("bancoId", e.target.value)} />
          </Campo>
          <Campo label="CBU" width="260px">
            <input value={f.cbu} onChange={(e) => set("cbu", e.target.value)} />
          </Campo>
          <Campo label="Sindicato" width="160px">
            <select value={f.afiliadoSindicato ? "si" : "no"} onChange={(e) => set("afiliadoSindicato", e.target.value === "si")}>
              <option value="si">Afiliado</option>
              <option value="no">No afiliado</option>
            </select>
          </Campo>
        </div>
      </div>

      <button onClick={guardar}>{esEdicion ? "Guardar cambios" : "Crear legajo"}</button>
      {error && <p style={{ color: "#B23A3A" }}>{error}</p>}
      {guardado && esEdicion && <p style={{ color: "#2F6F5E" }}>✔ Guardado.</p>}
      </div>

      {/* ── Documentos del legajo — panel lateral, solo con legajo ya creado ── */}
      {esEdicion && (
        <div style={{ width: "320px", flexShrink: 0, position: "sticky", top: "1rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
          <TarjetaCarnet foto={f.fotoBase64} numeroLegajo={f.numeroLegajo} apellido={f.apellido} nombre={f.nombre} categoria={categorias.find((c) => c.id === f.categoriaId)?.nombre} />
          <CargasFamiliaGanancias legajoId={legajoId!} />
          <EmbargosLegajo legajoId={legajoId!} />
          <DocumentosLegajo legajoId={legajoId!} />
        </div>
      )}
    </div>
  );
}

// Foto del legajo, estilo carnet — vive en el panel lateral, no en el
// formulario, para que se vea como una credencial (retrato, marco, nombre y
// legajo debajo) en vez de una miniatura perdida entre los campos.
function TarjetaCarnet({ foto, numeroLegajo, apellido, nombre, categoria }: { foto?: string; numeroLegajo?: string | number; apellido?: string; nombre?: string; categoria?: string }) {
  return (
    <div style={{ background: "white", border: "1px solid #dfe4e8", padding: "1rem", textAlign: "center" }}>
      <div
        style={{
          width: "160px", height: "200px", margin: "0 auto 0.7rem", borderRadius: "6px",
          border: "2px solid var(--azul-oscuro)", overflow: "hidden", background: "var(--gris-claro)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        {foto ? (
          <img src={foto} alt="Foto del legajo" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <span style={{ fontSize: "2.5rem", opacity: 0.3 }}>👤</span>
        )}
      </div>
      <p style={{ margin: 0, fontWeight: 700, fontSize: "0.95rem" }}>{apellido}, {nombre}</p>
      <p style={{ margin: "0.1rem 0 0", fontSize: "0.8rem", opacity: 0.65 }}>Legajo N° {numeroLegajo}</p>
      {categoria && <p style={{ margin: "0.1rem 0 0", fontSize: "0.75rem", opacity: 0.55 }}>{categoria}</p>}
    </div>
  );
}

// Legajo digital — documentación que hoy vive en la carpeta física
// (DNI, DDJJ domicilio, notas firmadas, certificados, cartas documento,
// apercibimientos...). Agrupado por categoría para que no sea una lista
// plana imposible de escanear con la vista.
const CATEGORIAS_DOC: { valor: string; etiqueta: string }[] = [
  { valor: "personal", etiqueta: "Documentación personal" },
  { valor: "laboral", etiqueta: "Documentación laboral" },
  { valor: "novedades", etiqueta: "Novedades y licencias" },
  { valor: "disciplinario_legal", etiqueta: "Disciplinario / legal" },
];

// Cargas de familia para el cálculo de Ganancias 4ta categoría (cónyuge,
// hijos, hijos incapacitados) — alimenta directo al motor de Ganancias
// (ver motor-ganancias.mjs). No se borra al dar de baja: se cierra con
// una fecha (vigenciaHasta), para no perder el histórico de "esta persona
// FUE carga de familia hasta tal fecha" si hay que auditar un período viejo.
const TIPOS_CARGA: { valor: string; etiqueta: string }[] = [
  { valor: "conyuge", etiqueta: "Cónyuge" },
  { valor: "hijo", etiqueta: "Hijo/a" },
  { valor: "hijo_incapacitado", etiqueta: "Hijo/a incapacitado/a" },
];

function CargasFamiliaGanancias({ legajoId }: { legajoId: string }) {
  const [cargas, setCargas] = useState<any[]>([]);
  const [tipo, setTipo] = useState("conyuge");
  const [descripcion, setDescripcion] = useState("");
  const [vigenciaDesde, setVigenciaDesde] = useState("");
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  function cargar() {
    fetch(`/api/legajos/${legajoId}/cargas-familia`).then((r) => r.json()).then(setCargas);
  }
  useEffect(() => { cargar(); }, [legajoId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function agregar() {
    setError("");
    if (!vigenciaDesde) { setError("Falta la fecha desde cuándo es carga de familia."); return; }
    setGuardando(true);
    try {
      const res = await fetch(`/api/legajos/${legajoId}/cargas-familia`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo, descripcion, vigenciaDesde }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setDescripcion(""); setVigenciaDesde("");
      cargar();
    } catch {
      setError("El servidor no devolvió una respuesta válida.");
    } finally {
      setGuardando(false);
    }
  }

  async function cerrarCarga(id: string) {
    if (!confirm("¿Marcar que esta persona dejó de ser carga de familia? Queda el histórico, no se borra.")) return;
    await fetch(`/api/cargas-familia/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    cargar();
  }

  const vigentes = cargas.filter((c) => !c.vigenciaHasta);
  const cerradas = cargas.filter((c) => c.vigenciaHasta);

  return (
    <div style={{ background: "white", border: "1px solid #dfe4e8", padding: "1rem" }}>
      <h4 style={{ marginTop: 0, marginBottom: "0.3rem" }}>👪 Cargas de familia (Ganancias)</h4>
      <p style={{ fontSize: "0.72rem", opacity: 0.6, marginTop: 0, marginBottom: "0.8rem" }}>
        Cónyuge e hijos a cargo — se usan para calcular la Retención de Ganancias de este legajo.
      </p>

      <div style={{ background: "var(--gris-claro)", padding: "0.6rem", marginBottom: "0.8rem" }}>
        <select value={tipo} onChange={(e) => setTipo(e.target.value)} style={{ width: "100%", marginBottom: "0.4rem", fontSize: "0.8rem" }}>
          {TIPOS_CARGA.map((t) => <option key={t.valor} value={t.valor}>{t.etiqueta}</option>)}
        </select>
        <input type="text" placeholder="Nombre (opcional)" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} style={{ width: "100%", marginBottom: "0.4rem", fontSize: "0.8rem" }} />
        <label style={{ fontSize: "0.72rem", opacity: 0.7 }}>Carga de familia desde:</label>
        <input type="date" value={vigenciaDesde} onChange={(e) => setVigenciaDesde(e.target.value)} style={{ width: "100%", marginBottom: "0.4rem" }} />
        <button onClick={agregar} disabled={guardando} style={{ width: "100%", fontSize: "0.8rem" }}>
          {guardando ? "Guardando..." : "Agregar"}
        </button>
        {error && <p style={{ color: "var(--rojo)", fontSize: "0.75rem", marginTop: "0.3rem" }}>{error}</p>}
      </div>

      {vigentes.length === 0 && <p style={{ fontSize: "0.78rem", opacity: 0.5 }}>Sin cargas de familia vigentes.</p>}
      {vigentes.map((c) => (
        <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.8rem", padding: "0.3rem 0", borderBottom: "1px solid #eee" }}>
          <span>{TIPOS_CARGA.find((t) => t.valor === c.tipo)?.etiqueta}{c.descripcion ? ` — ${c.descripcion}` : ""}</span>
          <button onClick={() => cerrarCarga(c.id)} style={{ background: "white", color: "var(--rojo)", border: "1px solid var(--rojo)", fontSize: "0.7rem", padding: "0.1rem 0.4rem" }}>
            Dar de baja
          </button>
        </div>
      ))}

      {cerradas.length > 0 && (
        <details style={{ marginTop: "0.6rem" }}>
          <summary style={{ fontSize: "0.72rem", opacity: 0.6, cursor: "pointer" }}>Histórico ({cerradas.length})</summary>
          {cerradas.map((c) => (
            <div key={c.id} style={{ fontSize: "0.75rem", opacity: 0.5, padding: "0.2rem 0" }}>
              {TIPOS_CARGA.find((t) => t.valor === c.tipo)?.etiqueta}{c.descripcion ? ` — ${c.descripcion}` : ""} (hasta {new Date(c.vigenciaHasta).toISOString().slice(0, 10)})
            </div>
          ))}
        </details>
      )}
    </div>
  );
}

const MESES_NOMBRE = ["", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

function EmbargosLegajo({ legajoId }: { legajoId: string }) {
  const [embargos, setEmbargos] = useState<any[]>([]);
  const [documentos, setDocumentos] = useState<any[]>([]);

  const [tipo, setTipo] = useState("judicial");
  const [descripcion, setDescripcion] = useState("");
  const [fechaInicio, setFechaInicio] = useState("");
  const [porcentaje, setPorcentaje] = useState("");
  const [montoTotal, setMontoTotal] = useState("");
  const [documentoId, setDocumentoId] = useState("");
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  // Para agregar una cuota a un embargo comercial puntual
  const [cuotaAbierta, setCuotaAbierta] = useState<string | null>(null);
  const [cuotaAnio, setCuotaAnio] = useState(new Date().getFullYear());
  const [cuotaMes, setCuotaMes] = useState(new Date().getMonth() + 1);
  const [cuotaImporte, setCuotaImporte] = useState("");
  const [errorCuota, setErrorCuota] = useState("");

  function cargar() {
    fetch(`/api/legajos/${legajoId}/embargos`).then((r) => r.json()).then(setEmbargos);
  }
  useEffect(() => {
    cargar();
    fetch(`/api/legajos/${legajoId}/documentos`).then((r) => r.json()).then((docs) => setDocumentos(docs.filter((d: any) => d.categoria === "disciplinario_legal")));
  }, [legajoId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function agregar() {
    setError("");
    if (!descripcion.trim() || !fechaInicio) { setError("Falta la descripción o la fecha de inicio."); return; }
    if (tipo === "judicial" && !porcentaje) { setError("Falta el porcentaje dictado por el juez."); return; }
    if (tipo === "comercial" && !montoTotal) { setError("Falta el monto total de la deuda."); return; }
    setGuardando(true);
    try {
      const res = await fetch(`/api/legajos/${legajoId}/embargos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo, descripcion, fechaInicio, porcentaje, montoTotal, documentoId: documentoId || null }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setDescripcion(""); setFechaInicio(""); setPorcentaje(""); setMontoTotal(""); setDocumentoId("");
      cargar();
    } catch {
      setError("El servidor no devolvió una respuesta válida.");
    } finally {
      setGuardando(false);
    }
  }

  async function darDeBaja(id: string) {
    if (!confirm("¿Dar de baja este embargo? Deja de descontarse en las próximas liquidaciones. Queda el histórico.")) return;
    await fetch(`/api/embargos/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
    cargar();
  }

  async function agregarCuota(embargoId: string) {
    setErrorCuota("");
    if (!cuotaImporte) { setErrorCuota("Falta el importe."); return; }
    const res = await fetch(`/api/embargos/${embargoId}/cuotas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ anio: cuotaAnio, mes: cuotaMes, importe: cuotaImporte }),
    });
    const data = await res.json();
    if (!res.ok) { setErrorCuota(data.error); return; }
    if (data.advertencia) alert(data.advertencia);
    setCuotaImporte("");
    cargar();
  }

  async function borrarCuota(id: string) {
    const res = await fetch(`/api/cuotas-embargo/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) { alert(data.error); return; }
    cargar();
  }

  const vigentes = embargos.filter((e) => e.activo);
  const dadosDeBaja = embargos.filter((e) => !e.activo);

  return (
    <div style={{ background: "white", border: "1px solid #dfe4e8", padding: "1rem" }}>
      <h4 style={{ marginTop: 0, marginBottom: "0.3rem" }}>⚖️ Embargos</h4>
      <p style={{ fontSize: "0.72rem", opacity: 0.6, marginTop: 0, marginBottom: "0.8rem" }}>
        Judicial (alimentos): % fijo, sin tope legal. Comercial: cargás mes a mes hasta completar la deuda, con aviso si te pasás del tope del Decreto 484/87.
      </p>

      <div style={{ background: "var(--gris-claro)", padding: "0.6rem", marginBottom: "0.8rem" }}>
        <select value={tipo} onChange={(e) => setTipo(e.target.value)} style={{ width: "100%", marginBottom: "0.4rem", fontSize: "0.8rem" }}>
          <option value="judicial">Judicial (alimentos / litis expensas)</option>
          <option value="comercial">Comercial (deuda común)</option>
        </select>
        <input type="text" placeholder='Descripción (ej. "Juzgado de Familia N°3, Expte. 12345")' value={descripcion} onChange={(e) => setDescripcion(e.target.value)} style={{ width: "100%", marginBottom: "0.4rem", fontSize: "0.8rem" }} />
        <label style={{ fontSize: "0.72rem", opacity: 0.7 }}>Vigente desde:</label>
        <input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} style={{ width: "100%", marginBottom: "0.4rem" }} />

        {tipo === "judicial" ? (
          <input type="number" step="0.01" placeholder="% dictado por el juez (ej. 20)" value={porcentaje} onChange={(e) => setPorcentaje(e.target.value)} style={{ width: "100%", marginBottom: "0.4rem" }} />
        ) : (
          <input type="number" step="0.01" placeholder="Monto total de la deuda" value={montoTotal} onChange={(e) => setMontoTotal(e.target.value)} style={{ width: "100%", marginBottom: "0.4rem" }} />
        )}

        <select value={documentoId} onChange={(e) => setDocumentoId(e.target.value)} style={{ width: "100%", marginBottom: "0.4rem", fontSize: "0.75rem" }}>
          <option value="">Sin notificación legal adjunta</option>
          {documentos.map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
        </select>
        {documentos.length === 0 && (
          <p style={{ fontSize: "0.68rem", opacity: 0.5, marginTop: "-0.2rem", marginBottom: "0.4rem" }}>
            (Subí la notificación primero en "Documentos del legajo", categoría "Disciplinario / legal", si querés poder linkearla acá.)
          </p>
        )}

        <button onClick={agregar} disabled={guardando} style={{ width: "100%", fontSize: "0.8rem" }}>
          {guardando ? "Guardando..." : "Agregar embargo"}
        </button>
        {error && <p style={{ color: "var(--rojo)", fontSize: "0.75rem", marginTop: "0.3rem" }}>{error}</p>}
      </div>

      {vigentes.length === 0 && <p style={{ fontSize: "0.78rem", opacity: 0.5 }}>Sin embargos vigentes.</p>}

      {vigentes.map((e) => {
        const totalCargado = e.cuotas?.reduce((a: number, c: any) => a + c.importe, 0) ?? 0;
        return (
          <div key={e.id} style={{ marginBottom: "0.8rem", borderBottom: "1px solid #eee", paddingBottom: "0.6rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <strong style={{ fontSize: "0.8rem" }}>{e.tipo === "judicial" ? "Judicial" : "Comercial"}</strong>
                <p style={{ margin: "0.1rem 0", fontSize: "0.78rem" }}>{e.descripcion}</p>
                {e.tipo === "judicial" ? (
                  <p style={{ margin: 0, fontSize: "0.75rem", opacity: 0.7 }}>{e.porcentaje}% sobre el neto</p>
                ) : (
                  <p style={{ margin: 0, fontSize: "0.75rem", opacity: 0.7 }}>
                    ${totalCargado.toLocaleString("es-AR")} cargado de ${e.montoTotal?.toLocaleString("es-AR")}
                  </p>
                )}
                {e.documento && <p style={{ margin: "0.1rem 0 0", fontSize: "0.68rem", opacity: 0.5 }}>📎 {e.documento.nombre}</p>}
              </div>
              <button onClick={() => darDeBaja(e.id)} style={{ background: "white", color: "var(--rojo)", border: "1px solid var(--rojo)", fontSize: "0.68rem", padding: "0.1rem 0.4rem" }}>
                Dar de baja
              </button>
            </div>

            {e.tipo === "comercial" && (
              <div style={{ marginTop: "0.4rem" }}>
                {e.cuotas?.length > 0 && (
                  <table style={{ fontSize: "0.72rem", width: "100%" }}>
                    <tbody>
                      {e.cuotas.map((c: any) => (
                        <tr key={c.id}>
                          <td>{MESES_NOMBRE[c.mes]} {c.anio}</td>
                          <td style={{ textAlign: "right" }}>${c.importe.toLocaleString("es-AR")}</td>
                          <td>{c.aplicado ? <span style={{ color: "var(--verde)" }}>✔ liquidada</span> : "pendiente"}</td>
                          <td>
                            {!c.aplicado && (
                              <button onClick={() => borrarCuota(c.id)} style={{ background: "white", color: "var(--rojo)", border: "none", fontSize: "0.68rem" }}>✕</button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {cuotaAbierta === e.id ? (
                  <div style={{ display: "flex", gap: "0.3rem", marginTop: "0.4rem", alignItems: "center" }}>
                    <select value={cuotaMes} onChange={(ev) => setCuotaMes(Number(ev.target.value))} style={{ fontSize: "0.72rem" }}>
                      {MESES_NOMBRE.slice(1).map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
                    </select>
                    <input type="number" value={cuotaAnio} onChange={(ev) => setCuotaAnio(Number(ev.target.value))} style={{ width: "60px", fontSize: "0.72rem" }} />
                    <input type="number" placeholder="Importe" value={cuotaImporte} onChange={(ev) => setCuotaImporte(ev.target.value)} style={{ width: "80px", fontSize: "0.72rem" }} />
                    <button onClick={() => agregarCuota(e.id)} style={{ fontSize: "0.7rem" }}>✔</button>
                    <button onClick={() => { setCuotaAbierta(null); setErrorCuota(""); }} style={{ fontSize: "0.7rem" }}>✕</button>
                  </div>
                ) : (
                  <button onClick={() => setCuotaAbierta(e.id)} style={{ fontSize: "0.7rem", marginTop: "0.3rem" }}>+ Cargar cuota de un mes</button>
                )}
                {cuotaAbierta === e.id && errorCuota && <p style={{ color: "var(--rojo)", fontSize: "0.7rem" }}>{errorCuota}</p>}
              </div>
            )}
          </div>
        );
      })}

      {dadosDeBaja.length > 0 && (
        <details style={{ marginTop: "0.6rem" }}>
          <summary style={{ fontSize: "0.72rem", opacity: 0.6, cursor: "pointer" }}>Dados de baja ({dadosDeBaja.length})</summary>
          {dadosDeBaja.map((e) => (
            <div key={e.id} style={{ fontSize: "0.75rem", opacity: 0.5, padding: "0.2rem 0" }}>
              {e.tipo === "judicial" ? "Judicial" : "Comercial"} — {e.descripcion} (hasta {new Date(e.fechaFin).toISOString().slice(0, 10)})
            </div>
          ))}
        </details>
      )}
    </div>
  );
}

function DocumentosLegajo({ legajoId }: { legajoId: string }) {
  const [documentos, setDocumentos] = useState<any[]>([]);
  const [categoria, setCategoria] = useState("personal");
  const [nombre, setNombre] = useState("");
  const [archivo, setArchivo] = useState<{ base64: string; nombreOriginal: string; tipoMime: string } | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState("");

  function cargar() {
    fetch(`/api/legajos/${legajoId}/documentos`).then((r) => r.json()).then(setDocumentos);
  }
  useEffect(() => { cargar(); }, [legajoId]); // eslint-disable-line react-hooks/exhaustive-deps

  function onArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setArchivo({ base64: reader.result as string, nombreOriginal: file.name, tipoMime: file.type });
      if (!nombre.trim()) setNombre(file.name.replace(/\.[^.]+$/, ""));
    };
    reader.readAsDataURL(file);
  }

  async function subir() {
    setError("");
    if (!archivo) { setError("Elegí un archivo primero."); return; }
    if (!nombre.trim()) { setError("Ponele un nombre descriptivo (ej. \"DNI frente\")."); return; }
    setSubiendo(true);
    try {
      const res = await fetch(`/api/legajos/${legajoId}/documentos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoria, nombre: nombre.trim(),
          nombreArchivoOriginal: archivo.nombreOriginal, tipoMime: archivo.tipoMime,
          contenidoBase64: archivo.base64,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setNombre(""); setArchivo(null);
      cargar();
    } catch {
      setError("El servidor no devolvió una respuesta válida.");
    } finally {
      setSubiendo(false);
    }
  }

  async function eliminar(id: string) {
    if (!confirm("¿Eliminar este documento? No se puede deshacer.")) return;
    await fetch(`/api/documentos/${id}`, { method: "DELETE" });
    cargar();
  }

  return (
    <div style={{ background: "white", border: "1px solid #dfe4e8", padding: "1rem" }}>
      <h4 style={{ marginTop: 0, marginBottom: "0.3rem" }}>📎 Documentos del legajo</h4>
      <p style={{ fontSize: "0.72rem", opacity: 0.6, marginTop: 0, marginBottom: "0.8rem" }}>
        Lo que hoy va en la carpeta física: DNI, DDJJ domicilio, notas firmadas, certificados médicos, apercibimientos, cartas documento.
      </p>

      {/* Subir nuevo */}
      <div style={{ background: "var(--gris-claro)", padding: "0.6rem", marginBottom: "0.8rem" }}>
        <select value={categoria} onChange={(e) => setCategoria(e.target.value)} style={{ width: "100%", marginBottom: "0.4rem", fontSize: "0.8rem" }}>
          {CATEGORIAS_DOC.map((c) => <option key={c.valor} value={c.valor}>{c.etiqueta}</option>)}
        </select>
        <input type="text" placeholder="Nombre (ej. DNI frente)" value={nombre} onChange={(e) => setNombre(e.target.value)} style={{ width: "100%", marginBottom: "0.4rem", fontSize: "0.8rem" }} />
        <input type="file" onChange={onArchivo} style={{ width: "100%", fontSize: "0.75rem", marginBottom: "0.4rem" }} />
        <button onClick={subir} disabled={subiendo || !archivo} style={{ width: "100%", fontSize: "0.8rem" }}>
          {subiendo ? "Subiendo..." : "Subir documento"}
        </button>
        {error && <p style={{ color: "var(--rojo)", fontSize: "0.75rem", marginTop: "0.3rem" }}>{error}</p>}
      </div>

      {/* Lista agrupada por categoría */}
      {CATEGORIAS_DOC.map((cat) => {
        const docsDeCategoria = documentos.filter((d) => d.categoria === cat.valor);
        if (docsDeCategoria.length === 0) return null;
        return (
          <div key={cat.valor} style={{ marginBottom: "0.8rem" }}>
            <p style={{ fontSize: "0.72rem", fontWeight: 600, opacity: 0.7, margin: "0 0 0.3rem", textTransform: "uppercase" }}>{cat.etiqueta}</p>
            {docsDeCategoria.map((d) => (
              <div key={d.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.8rem", padding: "0.3rem 0", borderBottom: "1px solid #eee" }}>
                <a href={`/api/documentos/${d.id}`} target="_blank" rel="noreferrer" style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={d.nombreArchivoOriginal}>
                  {d.nombre}
                </a>
                <button onClick={() => eliminar(d.id)} style={{ background: "white", color: "var(--rojo)", border: "1px solid var(--rojo)", fontSize: "0.7rem", padding: "0.1rem 0.4rem", marginLeft: "0.4rem" }}>
                  Quitar
                </button>
              </div>
            ))}
          </div>
        );
      })}
      {documentos.length === 0 && <p style={{ fontSize: "0.78rem", opacity: 0.5 }}>Todavía no hay documentos cargados.</p>}
    </div>
  );
}

// Períodos anteriores trabajados — registro documental de por qué se
// reconoce una antigüedad distinta a la fecha de ingreso. No calcula nada
// por sí solo (ver el texto de arriba, en el formulario principal) — es
// respaldo para justificar la fecha de "Antigüedad reconocida".
function PeriodosAnteriores({ legajoId }: { legajoId: string }) {
  const [periodos, setPeriodos] = useState<any[]>([]);
  const [empleador, setEmpleador] = useState("");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState("");

  function cargar() {
    fetch(`/api/legajos/${legajoId}/periodos-anteriores`).then((r) => r.json()).then(setPeriodos);
  }
  useEffect(() => { cargar(); }, [legajoId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function agregar() {
    setError("");
    if (!empleador.trim() || !fechaDesde) {
      setError("Completá al menos el empleador y la fecha desde.");
      return;
    }
    const res = await fetch(`/api/legajos/${legajoId}/periodos-anteriores`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ empleador, fechaDesde, fechaHasta: fechaHasta || null, motivo }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error); return; }
    setEmpleador(""); setFechaDesde(""); setFechaHasta(""); setMotivo("");
    cargar();
  }

  async function eliminar(id: string) {
    if (!confirm("¿Eliminar este período?")) return;
    await fetch(`/api/periodos-anteriores/${id}`, { method: "DELETE" });
    cargar();
  }

  return (
    <div style={{ marginTop: "1rem", background: "#EEF1F4", padding: "0.75rem" }}>
      <strong style={{ fontSize: "0.85rem" }}>Períodos anteriores trabajados</strong>
      <p style={{ fontSize: "0.75rem", opacity: 0.6, margin: "0.25rem 0 0.5rem" }}>
        Solo documental — cargá acá dónde trabajó antes, como respaldo de por qué se reconoce cierta antigüedad.
      </p>
      {periodos.length > 0 && (
        <table style={{ fontSize: "0.8rem", marginBottom: "0.5rem" }}>
          <thead>
            <tr><th>Empleador</th><th>Desde</th><th>Hasta</th><th>Motivo</th><th></th></tr>
          </thead>
          <tbody>
            {periodos.map((p) => (
              <tr key={p.id}>
                <td>{p.empleador}</td>
                <td>{p.fechaDesde.slice(0, 10)}</td>
                <td>{p.fechaHasta ? p.fechaHasta.slice(0, 10) : "—"}</td>
                <td>{p.motivo ?? "—"}</td>
                <td><button onClick={() => eliminar(p.id)} style={{ background: "white", color: "#B23A3A", border: "1px solid #B23A3A", fontSize: "0.75rem" }}>Quitar</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", alignItems: "center" }}>
        <input placeholder="Empleador" value={empleador} onChange={(e) => setEmpleador(e.target.value)} style={{ width: "160px" }} />
        <input type="date" placeholder="Desde" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} />
        <input type="date" placeholder="Hasta" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} />
        <input placeholder="Motivo (opcional)" value={motivo} onChange={(e) => setMotivo(e.target.value)} style={{ width: "200px" }} />
        <button onClick={agregar} style={{ fontSize: "0.8rem" }}>+ Agregar</button>
      </div>
      {error && <p style={{ color: "#B23A3A", fontSize: "0.8rem" }}>{error}</p>}
    </div>
  );
}
