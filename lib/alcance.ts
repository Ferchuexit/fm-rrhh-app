// FM RRHH — lib/alcance.ts
// Aplica el alcance por sector a TODAS las consultas del panel, desde el
// cliente de Prisma. Se hace acá y no ruta por ruta a propósito: si
// dependiera de acordarse de filtrar en cada pantalla, la primera ruta
// nueva que se olvide mostraría la nómina completa a quien no corresponde.
//
// Para un usuario limitado a sectores, en la empresa donde está limitado:
//   - toda lectura de legajos (y de lo que cuelga de un legajo: vacaciones,
//     fichadas, documentos, solicitudes…) trae solo gente de sus sectores;
//   - no puede modificar ni dar de alta nada de alguien de otro sector.
// El portal del empleado y la terminal de fichadas no pasan por acá: ahí
// no hay un usuario del panel.
//
// Lo que NO cubre: datos anidados con `include` desde un modelo que no es
// de personas (ej. Periodo → liquidaciones) y consultas SQL directas. Por
// eso un usuario con sectores solo puede tener roles de Gestión Humana
// (ver rolAdmiteSectores en lib/permisos.ts): nunca llega a esas pantallas.
import { Prisma } from "@prisma/client";
import { cookies, headers } from "next/headers";
import { NOMBRE_COOKIE, verificarSesion } from "./auth-edge";
import { RUTAS_PUBLICAS } from "./permisos";
import { caminosAlLegajo, decidir, sumarFiltro, legajosDelAlta, MENSAJE_FUERA_DE_ALCANCE } from "./alcance-reglas";

const COOKIE_EMPRESA = "empresaActual"; // = NOMBRE_COOKIE_EMPRESA (no se importa de empresa-actual: ese archivo importa a prisma)
const SEGUNDOS_CACHE = 10;

export class FueraDeAlcance extends Error {
  constructor() { super(MENSAJE_FUERA_DE_ALCANCE); this.name = "FueraDeAlcance"; }
}

type ClienteBase = {
  usuarioEmpresa: { findMany(args: any): Promise<{ empresaId: string; sectores: string[] }[]> };
  legajo: { count(args: any): Promise<number> };
};

export function extensionDeAlcance(base: ClienteBase) {
  const caminos = caminosAlLegajo(Prisma.dmmf.datamodel.models as any);
  const cache = new Map<string, { sectores: string[] | null; vence: number }>();

  // Los sectores a los que está limitado quien hace ESTE pedido, o null si
  // no hay límite (admin, usuario sin sectores, portal, terminal, o código
  // que corre fuera de un pedido web).
  async function sectoresDelPedido(): Promise<string[] | null> {
    let ruta: string, token: string | undefined, empresaCookie: string | undefined;
    try {
      ruta = headers().get("x-pathname") ?? "";
      token = cookies().get(NOMBRE_COOKIE)?.value;
      empresaCookie = cookies().get(COOKIE_EMPRESA)?.value;
    } catch {
      return null; // fuera de un pedido (scripts, build)
    }
    if (ruta === "/portal" || ruta.startsWith("/portal/") || ruta.startsWith("/api/portal/") || RUTAS_PUBLICAS.includes(ruta)) return null;
    if (!token) return null;

    const clave = `${token}|${empresaCookie ?? ""}`;
    const guardado = cache.get(clave);
    if (guardado && guardado.vence > Date.now()) return guardado.sectores;

    const sesion = await verificarSesion(token);
    let sectores: string[] | null = null;
    if (sesion && sesion.rol !== "admin") {
      // Mismo criterio que obtenerEmpresaActual(): la de la cookie si la
      // tiene asignada; si no, la primera por razón social.
      const asignaciones = await base.usuarioEmpresa.findMany({ where: { usuarioId: sesion.id }, select: { empresaId: true, sectores: true }, orderBy: { empresa: { razonSocial: "asc" } } });
      const actual = asignaciones.find((a) => a.empresaId === empresaCookie) ?? asignaciones[0];
      if (actual && actual.sectores.length > 0) sectores = actual.sectores;
    }
    if (cache.size > 500) cache.clear();
    cache.set(clave, { sectores, vence: Date.now() + SEGUNDOS_CACHE * 1000 });
    return sectores;
  }

  return {
    sectoresDelPedido,
    extension: Prisma.defineExtension({
      name: "alcance-por-sector",
      query: {
        $allModels: {
          async $allOperations({ model, operation, args, query }: any) {
            const sectores = await sectoresDelPedido();
            if (!sectores) return query(args);

            const d = decidir(model, operation, sectores, caminos);
            if (d.accion === "pasar") return query(args);
            if (d.accion === "negar") throw new FueraDeAlcance();
            if (d.accion === "filtrar") {
              // "No encontrado" con el filtro puesto: lo más probable es que
              // exista pero sea de otro sector. Mensaje que se entienda, en
              // vez del "No Legajo found" de Prisma. (En los ...OrThrow Prisma
              // tira el error recién DESPUÉS de esta función, cuando ve el
              // null: por eso se revisan las dos formas.)
              try {
                const resultado = await query({ ...(args ?? {}), where: sumarFiltro(args?.where, d.where) });
                if (resultado === null && operation.endsWith("OrThrow")) throw new FueraDeAlcance();
                return resultado;
              } catch (e: any) {
                if (e?.code === "P2025") throw new FueraDeAlcance();
                throw e;
              }
            }

            // Altas: el destinatario tiene que estar en alcance.
            if (model === "Noticia") {
              const sector = args?.data?.centroCostoId ?? args?.data?.centroCosto?.connect?.id;
              if (typeof sector !== "string" || !sectores.includes(sector)) throw new FueraDeAlcance();
              return query(args);
            }
            const ids = legajosDelAlta(operation, args);
            if (!ids) throw new FueraDeAlcance();
            const unicos = [...new Set(ids)];
            const enAlcance = await base.legajo.count({ where: { id: { in: unicos }, centroCostoId: { in: sectores } } });
            if (enAlcance !== unicos.length) throw new FueraDeAlcance();
            return query(args);
          },
        },
      },
    }),
  };
}
