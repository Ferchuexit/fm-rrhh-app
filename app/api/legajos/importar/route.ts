// FM RRHH — app/api/legajos/importar/route.ts
// Carga de legajos desde una planilla de Excel.
//   GET  → la planilla modelo (.xlsx), con una hoja de Referencias con los
//          convenios, categorías, sectores y puestos válidos
//   POST { filas, confirmar } → analiza las filas (el Excel lo lee el
//          navegador) y devuelve qué se crearía, qué se actualizaría y qué
//          está mal. Con confirmar: true y sin errores, guarda.
import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { obtenerEmpresaActual } from "@/lib/empresa-actual";
import { hoyArgentina } from "@/lib/ausencias-reglas";
import { analizar, plano, COLUMNAS, MAX_FILAS, type Contexto } from "@/lib/importar-legajos-reglas";

export const dynamic = "force-dynamic";

async function contexto(empresaId: string): Promise<Contexto> {
  const [convenios, sectores, puestos, legajos] = await Promise.all([
    prisma.convenio.findMany({ select: { id: true, codigo: true, nombre: true, categorias: { select: { id: true, codigo: true, nombre: true }, orderBy: { nombre: "asc" } } }, orderBy: { nombre: "asc" } }),
    prisma.centroCosto.findMany({ where: { empresaId }, select: { id: true, nombre: true }, orderBy: { nombre: "asc" } }),
    prisma.puesto.findMany({ where: { empresaId }, select: { id: true, nombre: true }, orderBy: { nombre: "asc" } }),
    prisma.legajo.findMany({ where: { empresaId }, select: { id: true, numeroLegajo: true, cuil: true, jefeId: true, condicion: true, convenioId: true } }),
  ]);
  // Si toda la gente activa está en un mismo convenio, ese es el de la empresa.
  const usados = [...new Set(legajos.filter((l) => l.condicion === "activo").map((l) => l.convenioId))];
  return { convenios, convenioPorDefecto: usados.length === 1 ? usados[0] : null, sectores, puestos, existentes: legajos.map((l) => ({ id: l.id, numeroLegajo: l.numeroLegajo, cuil: l.cuil, jefeId: l.jefeId, activo: l.condicion === "activo" })), hoy: hoyArgentina() };
}

export async function GET() {
  try {
    const empresa = await obtenerEmpresaActual();
    if (!empresa) return NextResponse.json({ error: "No hay una empresa seleccionada." }, { status: 400 });
    const c = await contexto(empresa.id);
    const libro = XLSX.utils.book_new();
    const hoja = XLSX.utils.aoa_to_sheet([COLUMNAS.map((x) => x.titulo), COLUMNAS.map((x) => x.ejemplo)]);
    hoja["!cols"] = COLUMNAS.map((x) => ({ wch: Math.max(14, x.titulo.length + 2) }));
    XLSX.utils.book_append_sheet(libro, hoja, "Legajos");
    const porDefecto = c.convenios.find((x) => x.id === c.convenioPorDefecto);
    const ayuda = XLSX.utils.aoa_to_sheet([
      ["CÓMO COMPLETAR LA HOJA \"Legajos\""], ["Una fila por persona. Borrá la fila de ejemplo. No cambies los títulos de las columnas."],
      ["Si el CUIL ya está cargado en el sistema, de esa fila solo se toman Sector, Puesto y Reporta a (sirve para acomodar la estructura sin cargar a nadie de nuevo)."],
      [porDefecto ? `Convenio de la empresa: ${porDefecto.nombre}. Podés dejar esa columna vacía.` : "La columna Convenio es obligatoria: usá el código de abajo."], [],
      ["COLUMNA", "¿OBLIGATORIA?", "CÓMO VA"], ...COLUMNAS.map((x) => [x.titulo, x.obligatoria ? "Sí" : "No", x.ayuda]), [],
      ["CONVENIOS Y CATEGORÍAS VÁLIDOS"], ["Código de convenio", "Convenio", "Categoría"],
      ...c.convenios.filter((x) => x.categorias.length > 0 && (!porDefecto || x.id === porDefecto.id)).flatMap((x) => x.categorias.map((k) => [x.codigo, x.nombre, k.nombre])), [],
      ["SECTORES QUE YA EXISTEN"], ...c.sectores.map((s) => [s.nombre]), [], ["PUESTOS QUE YA EXISTEN"], ...c.puestos.map((p) => [p.nombre]),
    ]);
    ayuda["!cols"] = [{ wch: 34 }, { wch: 46 }, { wch: 60 }];
    XLSX.utils.book_append_sheet(libro, ayuda, "Referencias");
    const buffer = XLSX.write(libro, { type: "buffer", bookType: "xlsx" }) as Buffer;
    return new NextResponse(new Uint8Array(buffer), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": 'attachment; filename="Planilla_carga_de_legajos.xlsx"' } });
  } catch (e) {
    console.error("Error en GET /api/legajos/importar:", e);
    return NextResponse.json({ error: "No se pudo armar la planilla." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const empresa = await obtenerEmpresaActual();
    if (!empresa) return NextResponse.json({ error: "No hay una empresa seleccionada." }, { status: 400 });
    const body = await req.json().catch(() => ({}));
    const crudas = Array.isArray(body.filas) ? body.filas : [];
    if (crudas.length === 0) return NextResponse.json({ error: "La planilla no tiene filas con datos." }, { status: 400 });
    if (crudas.length > MAX_FILAS) return NextResponse.json({ error: `La planilla tiene más de ${MAX_FILAS} filas: partila en dos.` }, { status: 400 });
    const c = await contexto(empresa.id);
    const a = analizar(crudas, c);
    const salida = { ...a, filas: a.filas.map((f) => ({ fila: f.fila, accion: f.accion, errores: f.errores, avisos: f.avisos, legajo: f.datos.numeroLegajo, nombre: [f.datos.apellido, f.datos.nombre].filter(Boolean).join(", "), cuil: f.datos.cuil, sector: f.datos.sector, puesto: f.datos.puesto, jefe: f.jefeTexto })) };
    if (body.confirmar !== true) return NextResponse.json(salida);
    if (a.resumen.errores > 0) return NextResponse.json({ ...salida, error: "Hay filas con errores: corregilas en el Excel y volvé a subirlo. No se guardó nada." }, { status: 400 });

    // 1. Sectores y puestos que faltan.
    const sectorId = new Map(c.sectores.map((s) => [plano(s.nombre), s.id]));
    for (const nombre of a.crearSectores) sectorId.set(plano(nombre), (await prisma.centroCosto.create({ data: { empresaId: empresa.id, nombre } })).id);
    const puestoId = new Map(c.puestos.map((p) => [plano(p.nombre), p.id]));
    for (const nombre of a.crearPuestos) puestoId.set(plano(nombre), (await prisma.puesto.create({ data: { empresaId: empresa.id, nombre } })).id);
    const deSector = (n: string | null) => (n ? sectorId.get(plano(n)) ?? null : null);
    const dePuesto = (n: string | null) => (n ? puestoId.get(plano(n)) ?? null : null);

    // 2. Las personas (todavía sin jefe: puede ser alguien de más abajo en la planilla).
    const idDe = new Map<string, string>();
    let creados = 0, actualizados = 0;
    for (const f of a.filas) {
      if (f.existenteId) {
        idDe.set(f.ref, f.existenteId);
        const data = { ...(f.datos.sector ? { centroCostoId: deSector(f.datos.sector) } : {}), ...(f.datos.puesto ? { puestoId: dePuesto(f.datos.puesto) } : {}) };
        if (Object.keys(data).length) { await prisma.legajo.update({ where: { id: f.existenteId }, data }); actualizados++; }
        else if (f.jefeRef) actualizados++;
        continue;
      }
      const d = f.datos;
      const l = await prisma.legajo.create({ data: { empresaId: empresa.id, numeroLegajo: d.numeroLegajo!, cuil: d.cuil, apellido: d.apellido, nombre: d.nombre, fechaIngreso: d.fechaIngreso!, convenioId: d.convenioId!, categoriaId: d.categoriaId!, tipoDocumento: "DNI", numeroDocumento: String(Number(d.cuil.slice(2, 10))), fechaNacimiento: d.fechaNacimiento, email: d.email, telefono: d.telefono, domicilio: d.domicilio, localidad: d.localidad, provincia: d.provincia, centroCostoId: deSector(d.sector), puestoId: dePuesto(d.puesto) } });
      idDe.set(f.ref, l.id);
      creados++;
    }
    // 3. Los jefes, ahora que todos existen.
    for (const f of a.filas) {
      if (!f.jefeRef) continue;
      const jefeId = f.jefeRef.startsWith("id:") ? f.jefeRef.slice(3) : idDe.get(f.jefeRef);
      if (jefeId) await prisma.legajo.update({ where: { id: idDe.get(f.ref)! }, data: { jefeId } });
    }
    return NextResponse.json({ ok: true, creados, actualizados, sectores: a.crearSectores.length, puestos: a.crearPuestos.length });
  } catch (e: any) {
    console.error("Error en POST /api/legajos/importar:", e);
    if (e?.code === "P2002") return NextResponse.json({ error: "Mientras se guardaba, alguien cargó un legajo con el mismo número. Volvé a subir la planilla: lo ya guardado va a figurar como existente." }, { status: 409 });
    return NextResponse.json({ error: e?.name === "FueraDeAlcance" ? "Dar de alta legajos es tarea de RR.HH. (tu usuario está limitado a algunos sectores)." : "No se pudo completar la carga. Volvé a subir la planilla: lo que ya se guardó va a figurar como existente." }, { status: e?.name === "FueraDeAlcance" ? 403 : 500 });
  }
}
