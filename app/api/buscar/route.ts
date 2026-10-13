// FM RRHH — app/api/buscar/route.ts
// El buscador de la barra de arriba. Busca en lo que el usuario puede ver:
//   - pantallas del menú (filtrado por su rol);
//   - personas de la empresa actual (si tiene Legajos; el alcance ya deja
//     solo las de sus sectores), por nombre, apellido, legajo, CUIL o DNI.
// Ruta "libre" en lib/permisos.ts: el filtro por permisos se hace acá.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerEmpresaActual } from "@/lib/empresa-actual";
import { permisosActuales } from "@/lib/permisos-servidor";
import { puedeVerModulo } from "@/lib/permisos";
import { menuFiltrado } from "@/lib/menu-estructura";
import { coincidencia } from "@/lib/buscador-reglas";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const acceso = await permisosActuales();
    if (!acceso) return NextResponse.json({ error: "Tu sesión venció." }, { status: 401 });
    const q = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 60);
    if (q.length < 2) return NextResponse.json({ pantallas: [], personas: [] });

    const pantallas = menuFiltrado(acceso.esAdmin, acceso.permisos)
      .flatMap((c) => c.items.map((i) => ({ href: i.href, label: i.label, icono: i.icono, categoria: c.categoria, puntos: coincidencia(i.label, q) * 3 + (q.length >= 3 ? coincidencia(`${c.categoria} ${i.desc ?? ""}`, q) : 0) })))
      .filter((p) => p.puntos > 0)
      .sort((a, b) => b.puntos - a.puntos)
      .slice(0, 6)
      .map(({ puntos, ...p }) => p);

    let personas: { id: string; nombre: string; legajo: number; sector: string; activo: boolean; href: string }[] = [];
    const empresa = await obtenerEmpresaActual();
    if (empresa && puedeVerModulo("legajos", acceso.esAdmin, acceso.permisos)) {
      const digitos = q.replace(/\D/g, "");
      const soloNumero = /^[\d\s.-]+$/.test(q);
      // Pocas centenas por empresa: se traen y se comparan acá, así la
      // búsqueda ignora tildes (Núñez = nunez) sin depender de la base.
      const legajos = await prisma.legajo.findMany({ where: { empresaId: empresa.id }, select: { id: true, numeroLegajo: true, apellido: true, nombre: true, cuil: true, condicion: true, centroCosto: { select: { nombre: true } } }, take: 5000 });
      personas = legajos
        .map((l) => {
          let puntos = 0;
          if (soloNumero && digitos) {
            if (String(l.numeroLegajo) === digitos) puntos = 10;
            else if (digitos.length >= 5 && l.cuil.replace(/\D/g, "").includes(digitos)) puntos = 6;
          } else puntos = coincidencia(`${l.apellido} ${l.nombre}`, q);
          return { l, puntos: puntos + (l.condicion === "activo" ? 0.5 : 0) };
        })
        .filter((x) => x.puntos >= 1)
        .sort((a, b) => b.puntos - a.puntos || a.l.apellido.localeCompare(b.l.apellido))
        .slice(0, 8)
        .map(({ l }) => ({ id: l.id, nombre: `${l.apellido}, ${l.nombre}`, legajo: l.numeroLegajo, sector: l.centroCosto?.nombre ?? "", activo: l.condicion === "activo", href: `/legajos/${l.id}` }));
    }
    return NextResponse.json({ pantallas, personas });
  } catch (e) {
    console.error("Error en GET /api/buscar:", e);
    return NextResponse.json({ error: "No se pudo buscar." }, { status: 500 });
  }
}
