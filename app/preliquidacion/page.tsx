import { prisma } from "@/lib/prisma";
import { obtenerEmpresaActual } from "@/lib/empresa-actual";
import { obtenerPreliquidacion } from "@/lib/preliquidacion-data";
import CeldaComoSeCalculo from "./CeldaComoSeCalculo";

function money(n: number) {
  return n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default async function PreliquidacionPage({ searchParams }: { searchParams: { periodoId?: string } }) {
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
        <h1>Preliquidación</h1>
        <p>
          No hay ningún período creado todavía. <a href="/periodos">Creá uno en /periodos</a>.
        </p>
      </main>
    );
  }

  const { columnas, filas } = await obtenerPreliquidacion(periodo.id);

  const totalBruto = filas.reduce((a, f) => a + f.bruto, 0);
  const totalNeto = filas.reduce((a, f) => a + f.neto, 0);

  return (
    <main>
      <h1>Preliquidación</h1>
      <p>
        Resumen legible del período liquidado — pensado para revisar antes de cerrar, o para mandarle a un cliente y
        que apruebe antes de generar los recibos definitivos. Hacé click en cualquier importe para ver cómo se calculó.
      </p>

      <form method="get" style={{ marginBottom: "1rem" }}>
        <label>
          Período:{" "}
          <select name="periodoId" defaultValue={periodo.id}>
            {periodos.map((p) => (
              <option key={p.id} value={p.id}>{p.nombre} ({p.estado})</option>
            ))}
          </select>
        </label>{" "}
        <button type="submit">Ver</button>
      </form>

      {filas.length === 0 ? (
        <p style={{ opacity: 0.6 }}>
          Este período todavía no tiene ninguna liquidación calculada. Andá a{" "}
          <a href={`/legajos?periodoId=${periodo.id}`}>/legajos</a> y liquidalo primero.
        </p>
      ) : (
        <>
          <p>
            <strong>{periodo.nombre}</strong> — {filas.length} legajo{filas.length !== 1 ? "s" : ""} liquidado{filas.length !== 1 ? "s" : ""} ·{" "}
            <a href={`/api/preliquidacion/exportar?periodoId=${periodo.id}`}>⬇ Exportar a Excel/CSV</a>
          </p>

          <div style={{ overflowX: "auto" }}>
            <table style={{ fontSize: "0.8rem" }}>
              <thead>
                <tr>
                  <th>Legajo</th>
                  <th>Apellido y Nombre</th>
                  <th>Conv.</th>
                  {columnas.map((c) => (
                    <th key={c.codigo} style={{ textAlign: "right" }}>{c.nombre}</th>
                  ))}
                  <th style={{ textAlign: "right" }}>Bruto</th>
                  <th style={{ textAlign: "right" }}>Neto</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((f) => (
                  <tr key={f.numeroLegajo}>
                    <td>{f.numeroLegajo}</td>
                    <td>{f.apellido}, {f.nombre}</td>
                    <td>{f.convenio}</td>
                    {columnas.map((c) => (
                      <td key={c.codigo} style={{ textAlign: "right" }}>
                        {f.porConcepto[c.codigo] !== undefined ? (
                          <CeldaComoSeCalculo detalleId={f.porConceptoId[c.codigo]} importe={f.porConcepto[c.codigo]} />
                        ) : (
                          "—"
                        )}
                      </td>
                    ))}
                    <td style={{ textAlign: "right", fontWeight: "bold" }}>{money(f.bruto)}</td>
                    <td style={{ textAlign: "right", fontWeight: "bold" }}>{money(f.neto)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ fontWeight: "bold", borderTop: "2px solid #163A5C" }}>
                  <td colSpan={3 + columnas.length}>Totales</td>
                  <td style={{ textAlign: "right" }}>{money(totalBruto)}</td>
                  <td style={{ textAlign: "right" }}>{money(totalNeto)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </main>
  );
}
