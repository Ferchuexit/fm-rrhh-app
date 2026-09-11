import { prisma } from "@/lib/prisma";
import { obtenerEmpresaActual } from "@/lib/empresa-actual";

export default async function LegajosPage({ searchParams }: { searchParams: { q?: string; mostrarInactivos?: string } }) {
  const empresa = await obtenerEmpresaActual();
  if (!empresa) {
    return (
      <main>
        <h1>No hay ninguna empresa cargada</h1>
        <p>
          Andá a <a href="/empresas">/empresas</a> y creá una primero.
        </p>
      </main>
    );
  }

  const q = searchParams.q?.trim();
  const esNumero = q && /^\d+$/.test(q);
  const mostrarInactivos = searchParams.mostrarInactivos === "true";

  const legajos = await prisma.legajo.findMany({
    where: {
      empresaId: empresa.id,
      // Por defecto, ocultos los inactivos/dados de baja — para no
      // confundirlos con la nómina activa ni arriesgar tocarlos sin
      // querer. Un link los muestra cuando de verdad hacen falta.
      ...(mostrarInactivos ? {} : { condicion: { notIn: ["inactivo", "baja"] } }),
      ...(q
        ? esNumero
          ? { numeroLegajo: Number(q) }
          : { OR: [{ apellido: { contains: q, mode: "insensitive" } }, { nombre: { contains: q, mode: "insensitive" } }] }
        : {}),
    },
    include: { convenio: true, categoria: true },
    orderBy: { numeroLegajo: "asc" },
  });

  const totalConInactivos = await prisma.legajo.count({ where: { empresaId: empresa.id } });
  const ocultos = mostrarInactivos ? 0 : totalConInactivos - (await prisma.legajo.count({ where: { empresaId: empresa.id, condicion: { notIn: ["inactivo", "baja"] } } }));

  return (
    <main>
      <h1>{empresa.razonSocial}</h1>
      <p>
        CUIT {empresa.cuit} — {legajos.length} legajo{legajos.length !== 1 ? "s" : ""}{q ? ` que coinciden con "${q}"` : ""}.
        {ocultos > 0 && (
          <>
            {" "}<span style={{ opacity: 0.6 }}>({ocultos} inactivo{ocultos !== 1 ? "s" : ""}/baja oculto{ocultos !== 1 ? "s" : ""} —</span>{" "}
            <a href={`?mostrarInactivos=true${q ? `&q=${q}` : ""}`}>mostrarlos</a><span style={{ opacity: 0.6 }}>)</span>
          </>
        )}
        {mostrarInactivos && (
          <>
            {" "}<a href={q ? `?q=${q}` : "?"}>ocultar inactivos/bajas de nuevo</a>
          </>
        )}
      </p>

      <form method="get" style={{ margin: "0.75rem 0" }}>
        <input
          type="text"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Buscar por N° de legajo o apellido..."
          style={{ width: "280px", padding: "0.4rem" }}
        />
        <button type="submit" style={{ marginLeft: "0.4rem" }}>Buscar</button>
        {q && (
          <a href="/legajos" style={{ marginLeft: "0.6rem", fontSize: "0.85rem" }}>
            × Limpiar
          </a>
        )}
      </form>

      <p>
        <a href="/legajos/nuevo">
          <button>+ Nuevo empleado</button>
        </a>
      </p>

      {legajos.length === 0 ? (
        <p style={{ opacity: 0.6 }}>
          {q ? `Ningún legajo coincide con "${q}".` : "No hay legajos cargados todavía."}
        </p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Legajo</th>
              <th>Apellido y Nombre</th>
              <th>Convenio</th>
              <th>Categoría</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {legajos.map((l) => (
              <tr key={l.id}>
                <td>{l.numeroLegajo}</td>
                <td>{l.apellido}, {l.nombre}</td>
                <td>{l.convenio.codigo}</td>
                <td>{l.categoria.nombre}</td>
                <td>
                  <a href={`/legajos/${l.id}/editar`}>Editar</a>{" "}
                  <a href={`/legajos/${l.id}/biometria`} title="Ir directo al registro biométrico, sin pasar por el formulario grande">📷</a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <p style={{ fontSize: "0.85rem", opacity: 0.7, marginTop: "1rem" }}>
        Para descargar recibos, andá a <a href="/recibos">/recibos</a> — ahí elegís el período y el filtro de empleados.
      </p>
    </main>
  );
}
