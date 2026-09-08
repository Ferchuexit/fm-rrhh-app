import { prisma } from "@/lib/prisma";
import { obtenerEmpresaActual } from "@/lib/empresa-actual";
import { armarDatosRecibo } from "@/lib/armar-recibo";
import { CODIGOS_SAC, CODIGO_GANANCIAS, CODIGOS_EMBARGO } from "@/lib/liquidacion-individual-recalculo";
import IndividualNavegacion from "./IndividualNavegacion";
import FilaHaberEditable from "./FilaHaberEditable";
import AgregarConcepto from "./AgregarConcepto";
import AccionesLiquidacion from "./AccionesLiquidacion";

// FM RRHH — app/liquidacion-individual/page.tsx
// Pantalla de trabajo detallado sobre UN legajo — separada de
// /liquidacion-masiva (que procesa toda la nómina de una) — ver "Rediseño
// del módulo de Liquidaciones".
//
// ESTADO (08/09/2026, cuarta etapa): además de todo lo anterior, ahora se
// puede liquidar, volver a liquidar y eliminar la liquidación de ESTE
// legajo puntual sin salir de la pantalla (antes había que ir a
// Liquidación Masiva) — ver AccionesLiquidacion.tsx, que reusa el mismo
// /api/liquidar de siempre con el filtro "por legajo".
//
// Reutiliza armarDatosRecibo() solo para la columna "Cantidad/%"
// (heurística que ya existía ahí) y para la sección de Deducciones, que
// queda de solo lectura por ahora — forzar/excluir se puede sobre
// Haberes; una Deducción calculada mal se corrige revisando su fórmula en
// /reglas, no forzándola acá.
//
// CASO BORDE DE EMBARGO COMERCIAL: cada cuota se aplica una única vez en
// la vida (ver el comentario largo en liquidacion-individual-recalculo.ts)
// — un recálculo posterior no la vuelve a "pedir", reusa la que ya se
// aplicó. Si tenés dudas sobre un caso puntual, revisá el historial de
// abajo antes de confiar ciegamente en el número.

function money(n: number) {
  return n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default async function LiquidacionIndividualPage({
  searchParams,
}: {
  searchParams: { periodoId?: string; legajoId?: string; q?: string };
}) {
  const empresa = await obtenerEmpresaActual();
  if (!empresa) {
    return (
      <main>
        <h1>No hay ninguna empresa cargada</h1>
      </main>
    );
  }

  const periodos = await prisma.periodo.findMany({ where: { empresaId: empresa.id }, orderBy: { fechaDesde: "desc" } });
  const periodo = searchParams.periodoId ? periodos.find((p) => p.id === searchParams.periodoId) ?? periodos[0] : periodos[0];

  if (!periodo) {
    return (
      <main>
        <h1>Liquidación Individual</h1>
        <p>
          No hay ningún período creado todavía. <a href="/periodos">Creá uno en /periodos</a>.
        </p>
      </main>
    );
  }

  // ── Elegir el legajo a mostrar: por búsqueda, por id directo, o el primero de la empresa ──
  const q = searchParams.q?.trim();
  let legajo = null as Awaited<ReturnType<typeof buscarPrimerLegajo>> | null;
  let sinCoincidencias = false;

  if (q) {
    legajo = await buscarPrimerLegajo(empresa.id, q);
    if (!legajo) sinCoincidencias = true;
  }
  if (!legajo && searchParams.legajoId) {
    legajo = await prisma.legajo.findFirst({
      where: { id: searchParams.legajoId, empresaId: empresa.id },
      include: { convenio: true, categoria: true },
    });
  }
  if (!legajo) {
    legajo = await prisma.legajo.findFirst({
      where: { empresaId: empresa.id, condicion: { notIn: ["inactivo", "baja"] } },
      orderBy: { numeroLegajo: "asc" },
      include: { convenio: true, categoria: true },
    });
  }

  if (!legajo) {
    return (
      <main>
        <h1>Liquidación Individual</h1>
        <p>
          Esta empresa todavía no tiene legajos cargados. <a href="/legajos/nuevo">Cargá uno primero</a>.
        </p>
      </main>
    );
  }

  const [datosRecibo, liquidacionCompleta] = await Promise.all([
    armarDatosRecibo(legajo.id, periodo.id),
    prisma.liquidacion.findFirst({
      where: { periodoId: periodo.id, legajoId: legajo.id, vigente: true },
      select: {
        id: true,
        bruto: true,
        neto: true,
        version: true,
        fechaCalculo: true,
        detalle: {
          include: { concepto: true, ediciones: { include: { usuario: true }, orderBy: { fecha: "desc" } } },
        },
      },
    }),
  ]);

  const periodoAbierto = periodo.estado !== "cerrada";
  const totalDeducciones = datosRecibo ? datosRecibo.deducciones.reduce((a, d) => a + d.importe, 0) : 0;

  // "Cantidad/%" se calcula con la heurística de armar-recibo.ts (lee la
  // fórmula) — se une por el número ARCA del concepto, que es @unique.
  const cantPorNumero: Record<string, string> = Object.fromEntries((datosRecibo?.haberes ?? []).map((h) => [h.codigo, h.cant]));

  const filasHaberes = liquidacionCompleta
    ? liquidacionCompleta.detalle
        .filter((d) => d.concepto.tipo === "remunerativo" || d.concepto.tipo === "no_remunerativo")
        .map((d) => {
          const codigo = d.concepto.numero != null ? String(d.concepto.numero) : "";
          return {
            detalleId: d.id,
            codigo,
            conceptoCodigo: d.concepto.codigo,
            convenioId: legajo.convenioId,
            nombre: d.concepto.nombre,
            cant: cantPorNumero[codigo] ?? "",
            importe: d.importe,
            importeCalculado: d.importeCalculado,
            forzado: d.forzado,
            excluido: d.excluido,
            origen: d.origen,
            tipo: d.concepto.tipo as "remunerativo" | "no_remunerativo",
          };
        })
        .sort((a, b) => (Number(a.codigo) || 999999) - (Number(b.codigo) || 999999))
    : [];

  // ── Conceptos disponibles para "Agregar concepto" (punto 3): solo los
  // que NO tienen una fórmula en este convenio (esos se calculan solos) y
  // que todavía no están en el detalle de esta liquidación ──
  let conceptosDisponibles: { codigo: string; numero: number | null; nombre: string; tipo: string }[] = [];
  if (liquidacionCompleta && periodoAbierto) {
    const [reglasDelConvenio, todosLosConceptos] = await Promise.all([
      prisma.reglaConcepto.findMany({
        where: {
          convenioId: legajo.convenioId,
          vigenciaDesde: { lte: periodo.fechaDesde },
          OR: [{ vigenciaHasta: null }, { vigenciaHasta: { gte: periodo.fechaDesde } }],
        },
        select: { concepto: { select: { codigo: true } } },
      }),
      prisma.concepto.findMany({ where: { tipo: { in: ["remunerativo", "no_remunerativo"] } }, orderBy: { numero: "asc" } }),
    ]);
    const codigosConRegla = new Set(reglasDelConvenio.map((r) => r.concepto.codigo));
    const codigosYaEnDetalle = new Set(liquidacionCompleta.detalle.map((d) => d.concepto.codigo));
    const codigosEspeciales = new Set([...CODIGOS_SAC, CODIGO_GANANCIAS, ...CODIGOS_EMBARGO]);
    conceptosDisponibles = todosLosConceptos
      .filter((c) => !codigosConRegla.has(c.codigo) && !codigosYaEnDetalle.has(c.codigo) && !codigosEspeciales.has(c.codigo))
      .map((c) => ({ codigo: c.codigo, numero: c.numero, nombre: c.nombre, tipo: c.tipo }));
  }

  const historial = liquidacionCompleta
    ? liquidacionCompleta.detalle
        .flatMap((d) => d.ediciones.map((e) => ({ ...e, conceptoNombre: d.concepto.nombre })))
        .sort((a, b) => b.fecha.getTime() - a.fecha.getTime())
    : [];

  return (
    <main>
      <h1>Liquidación Individual</h1>
      <p>
        Trabajo detallado sobre un único legajo — separado de <a href="/liquidacion-masiva">Liquidación Masiva</a>.
        Forzar/excluir un concepto acá no toca la fórmula ni al resto de los legajos.
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", alignItems: "center", marginBottom: "1rem" }}>
        <form method="get" style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
          <input type="hidden" name="legajoId" value={legajo.id} />
          <label>
            Período:{" "}
            <select name="periodoId" defaultValue={periodo.id}>
              {periodos.map((p) => (
                <option key={p.id} value={p.id}>{p.nombre} ({p.estado})</option>
              ))}
            </select>
          </label>
          <button type="submit">Ver</button>
        </form>

        <form method="get" style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
          <input type="hidden" name="periodoId" value={periodo.id} />
          <input type="text" name="q" defaultValue={q ?? ""} placeholder="Buscar por legajo, apellido, nombre o CUIL" style={{ width: "260px", padding: "0.35rem" }} />
          <button type="submit">Buscar</button>
        </form>
      </div>

      {sinCoincidencias && (
        <p style={{ background: "#fdf2ea", border: "1px solid #B8752B", padding: "0.5rem 0.75rem", fontSize: "0.85rem", maxWidth: "700px" }}>
          Ningún legajo coincide con "{q}" — mostrando {legajo.numeroLegajo} ({legajo.apellido}, {legajo.nombre}) en su lugar.
        </p>
      )}

      <div style={{ background: "white", border: "1px solid #dfe4e8", padding: "1rem", marginBottom: "1rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
          <div>
            <strong style={{ fontSize: "1.1rem" }}>
              Legajo {legajo.numeroLegajo} — {legajo.apellido}, {legajo.nombre}
            </strong>
            <div style={{ fontSize: "0.85rem", opacity: 0.7 }}>
              CUIL {legajo.cuil} · {legajo.convenio.codigo} — {legajo.categoria.nombre}
            </div>
          </div>
          <IndividualNavegacion legajoId={legajo.id} periodoId={periodo.id} />
        </div>
        <div style={{ fontSize: "0.85rem", opacity: 0.7 }}>{periodo.nombre}</div>
      </div>

      {!periodoAbierto && (
        <p style={{ background: "#fdf2ea", border: "1px solid #B8752B", padding: "0.5rem 0.75rem", fontSize: "0.85rem", maxWidth: "700px" }}>
          Este período está cerrado — no se puede editar. <a href="/auditoria">Reabrilo en /auditoria</a> si necesitás corregir algo a propósito.
        </p>
      )}

      {liquidacionCompleta && liquidacionCompleta.detalle.some((d) => [...CODIGOS_SAC, CODIGO_GANANCIAS, ...CODIGOS_EMBARGO].includes(d.concepto.codigo)) && (
        <p style={{ background: "#EEF1F4", border: "1px solid #163A5C", padding: "0.5rem 0.75rem", fontSize: "0.85rem", maxWidth: "700px" }}>
          📌 Este legajo tiene SAC, Retención de Ganancias o Embargo — se recalculan solos con cada cambio que hagas
          acá, salvo que los hayas forzado o excluido vos.
        </p>
      )}

      <AccionesLiquidacion
        legajoId={legajo.id}
        numeroLegajo={legajo.numeroLegajo}
        periodoId={periodo.id}
        yaLiquidado={!!liquidacionCompleta}
        periodoAbierto={periodoAbierto}
      />

      {!liquidacionCompleta ? (
        <p style={{ opacity: 0.6 }}>
          Este legajo todavía no está liquidado en "{periodo.nombre}". Usá el botón de arriba, o desde{" "}
          <a href={`/liquidacion-masiva?periodoId=${periodo.id}`}>Liquidación Masiva</a> si querés liquidar varios a la vez.
        </p>
      ) : (
        <>
          <table style={{ width: "100%", maxWidth: "900px", fontSize: "0.9rem", marginBottom: "1rem" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #163A5C" }}>
                <th style={{ textAlign: "left" }}>Nº</th>
                <th style={{ textAlign: "left" }}>Concepto</th>
                <th style={{ textAlign: "left" }}>Cant. / %</th>
                <th style={{ textAlign: "right" }}>Remunerativo</th>
                <th style={{ textAlign: "right" }}>No remunerativo</th>
                <th style={{ textAlign: "left" }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filasHaberes.map((f) => (
                <FilaHaberEditable key={f.detalleId} {...f} periodoAbierto={periodoAbierto} />
              ))}
            </tbody>
          </table>

          {periodoAbierto && <AgregarConcepto liquidacionId={liquidacionCompleta.id} conceptosDisponibles={conceptosDisponibles} />}

          {datosRecibo && datosRecibo.deducciones.length > 0 && (
            <table style={{ width: "100%", maxWidth: "900px", fontSize: "0.9rem", marginBottom: "1rem" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #163A5C" }}>
                  <th style={{ textAlign: "left" }}>Nº</th>
                  <th style={{ textAlign: "left" }}>Deducción</th>
                  <th style={{ textAlign: "left" }}>%</th>
                  <th style={{ textAlign: "right" }}>Importe</th>
                </tr>
              </thead>
              <tbody>
                {datosRecibo.deducciones.map((d, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #eee" }}>
                    <td>{d.codigo}</td>
                    <td>{d.nombre}</td>
                    <td style={{ opacity: 0.7 }}>{d.pct}</td>
                    <td style={{ textAlign: "right" }}>{money(d.importe)}</td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={3} style={{ textAlign: "right", fontWeight: "bold" }}>Total deducciones</td>
                  <td style={{ textAlign: "right", fontWeight: "bold" }}>{money(totalDeducciones)}</td>
                </tr>
              </tbody>
            </table>
          )}

          <div style={{ maxWidth: "900px", display: "flex", justifyContent: "flex-end", gap: "2rem", fontSize: "1rem", padding: "0.75rem 0", borderTop: "2px solid #163A5C" }}>
            <div>Bruto: <strong>{money(liquidacionCompleta.bruto)}</strong></div>
            <div>Neto: <strong style={{ color: "#2F6F5E" }}>{money(liquidacionCompleta.neto)}</strong></div>
          </div>
          {liquidacionCompleta.version > 1 && (
            <p style={{ fontSize: "0.8rem", opacity: 0.6, marginTop: "0.5rem" }}>
              Versión {liquidacionCompleta.version} de esta liquidación — calculada el{" "}
              {liquidacionCompleta.fechaCalculo.toLocaleDateString("es-AR")}.
            </p>
          )}

          {historial.length > 0 && (
            <details style={{ marginTop: "1.5rem", maxWidth: "900px" }}>
              <summary style={{ cursor: "pointer", fontSize: "0.9rem", fontWeight: "bold" }}>
                Historial de modificaciones ({historial.length})
              </summary>
              <table style={{ width: "100%", fontSize: "0.8rem", marginTop: "0.5rem" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #ccc" }}>
                    <th style={{ textAlign: "left" }}>Fecha</th>
                    <th style={{ textAlign: "left" }}>Concepto</th>
                    <th style={{ textAlign: "left" }}>Acción</th>
                    <th style={{ textAlign: "right" }}>Valor anterior</th>
                    <th style={{ textAlign: "right" }}>Valor nuevo</th>
                    <th style={{ textAlign: "left" }}>Usuario</th>
                  </tr>
                </thead>
                <tbody>
                  {historial.map((e) => (
                    <tr key={e.id} style={{ borderBottom: "1px solid #eee" }}>
                      <td>{e.fecha.toLocaleString("es-AR")}</td>
                      <td>{e.conceptoNombre}</td>
                      <td>{e.tipoAccion}</td>
                      <td style={{ textAlign: "right" }}>{e.valorAnterior != null ? money(e.valorAnterior) : "—"}</td>
                      <td style={{ textAlign: "right" }}>{e.valorNuevo != null ? money(e.valorNuevo) : "—"}</td>
                      <td>{e.usuario.nombre}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          )}

          <p style={{ marginTop: "1rem" }}>
            <a href={`/preliquidacion?periodoId=${periodo.id}`} style={{ fontSize: "0.85rem" }}>
              ← Ver tabla completa de todos los legajos
            </a>
          </p>
        </>
      )}
    </main>
  );
}

async function buscarPrimerLegajo(empresaId: string, q: string) {
  const esNumero = /^\d+$/.test(q);
  return prisma.legajo.findFirst({
    where: {
      empresaId,
      ...(esNumero
        ? { numeroLegajo: Number(q) }
        : {
            OR: [
              { apellido: { contains: q, mode: "insensitive" } },
              { nombre: { contains: q, mode: "insensitive" } },
              { cuil: { contains: q } },
            ],
          }),
    },
    orderBy: { numeroLegajo: "asc" },
    include: { convenio: true, categoria: true },
  });
}
