// FM RRHH — lib/alcance.ts
// Aplica el alcance de cada usuario (empresas asignadas y, si tiene,
// sectores) a TODAS las consultas del panel, desde el cliente de Prisma.
// Se hace acá y no ruta por ruta a propósito: si dependiera de acordarse
// de filtrar en cada pantalla, la primera ruta que se olvide dejaría leer
// o modificar datos de otra empresa a quien conozca un id.
//
// Para un usuario que NO es administrador:
//   - toda lectura o modificación de legajos, de lo que cuelga de un legajo
//     (vacaciones, fichadas, documentos, liquidaciones…) y de lo que es de
//     una empresa (períodos, sectores, noticias, terminales…) queda
//     limitada a sus empresas asignadas;
//   - si además tiene sectores, a la gente de esos centros de costo;
//   - no puede dar de alta nada para un legajo o una empresa fuera de eso.
// El administrador, el portal del empleado y la terminal de fichadas no
// pasan por acá.
//
// Lo que NO cubre: datos anidados con `include` desde una tabla general
// (ej. Convenio → legajos) y SQL directo. Ver 83-alcance-empresa-y-sector.md.
import { Prisma } from "@prisma/client";
import { cookies, headers } from "next/headers";
import { NOMBRE_COOKIE, verificarSesion } from "./auth-edge";
import { esRutaPublica } from "./permisos";
import { caminos as deducirCaminos, decidir, sumarFiltro, legajosDelAlta, empresasDelAlta, MENSAJE_FUERA_DE_ALCANCE, type Alcance } from "./alcance-reglas";

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
  const caminos = deducirCaminos(Prisma.dmmf.datamodel.models as any);
  const cache = new Map<string, { alcance: Alcance | null; vence: number }>();

  // El alcance de quien hace ESTE pedido, o null si no hay límite (admin,
  // portal, terminal, o código que corre fuera de un pedido web).
  async function alcanceDelPedido(): Promise<Alcance | null> {
    let ruta: string, token: string | undefined, empresaCookie: string | undefined;
    try {
      ruta = headers().get("x-pathname") ?? "";
      token = cookies().get(NOMBRE_COOKIE)?.value;
      empresaCookie = cookies().get(COOKIE_EMPRESA)?.value;
    } catch {
      return null; // fuera de un pedido (scripts, build)
    }
    if (ruta === "/portal" || ruta.startsWith("/portal/") || ruta.startsWith("/api/portal/") || esRutaPublica(ruta)) return null;
    if (!token) return null; // sin sesión del panel: el middleware ya lo frenó, salvo login

    const clave = `${token}|${empresaCookie ?? ""}`;
    const guardado = cache.get(clave);
    if (guardado && guardado.vence > Date.now()) return guardado.alcance;

    const sesion = await verificarSesion(token);
    let alcance: Alcance | null = null;
    if (!sesion) {
      alcance = { empresas: [], sectores: null }; // token inválido: no ve nada
    } else if (sesion.rol !== "admin") {
      // Mismo criterio que obtenerEmpresaActual(): la de la cookie si la
      // tiene asignada; si no, la primera por razón social.
      const asignaciones = await base.usuarioEmpresa.findMany({ where: { usuarioId: sesion.id }, select: { empresaId: true, sectores: true }, orderBy: { empresa: { razonSocial: "asc" } } });
      const actual = asignaciones.find((a) => a.empresaId === empresaCookie) ?? asignaciones[0];
      alcance = { empresas: asignaciones.map((a) => a.empresaId), sectores: actual && actual.sectores.length > 0 ? actual.sectores : null };
    }
    if (cache.size > 500) cache.clear();
    cache.set(clave, { alcance, vence: Date.now() + SEGUNDOS_CACHE * 1000 });
    return alcance;
  }

  return {
    sectoresDelPedido: async () => (await alcanceDelPedido())?.sectores ?? null,
    extension: Prisma.defineExtension({
      name: "alcance-por-empresa-y-sector",
      query: {
        $allModels: {
          async $allOperations({ model, operation, args, query }: any) {
            const alcance = await alcanceDelPedido();
            if (!alcance) return query(args);

            const d = decidir(model, operation, alcance, caminos);
            if (d.accion === "pasar") return query(args);
            if (d.accion === "negar") throw new FueraDeAlcance();
            if (d.accion === "filtrar") {
              // "No encontrado" con el filtro puesto: lo más probable es que
              // exista pero sea de otra empresa o sector. Mensaje que se
              // entienda, en vez del "No Legajo found" de Prisma.
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
            if (d.de === "noticia") {
              const fila = operation === "upsert" ? args?.create : args?.data;
              const sector = fila?.centroCostoId ?? fila?.centroCosto?.connect?.id;
              const empresa = fila?.empresaId ?? fila?.empresa?.connect?.id;
              if (typeof sector !== "string" || !alcance.sectores!.includes(sector) || !alcance.empresas.includes(empresa)) throw new FueraDeAlcance();
              return query(args);
            }
            if (d.de === "empresa") {
              const ids = empresasDelAlta(operation, args);
              if (!ids || ids.some((id) => !alcance.empresas.includes(id))) throw new FueraDeAlcance();
              return query(args);
            }
            const ids = legajosDelAlta(operation, args);
            if (!ids) throw new FueraDeAlcance();
            const unicos = [...new Set(ids)];
            const enAlcance = await base.legajo.count({
              where: { id: { in: unicos }, empresaId: { in: alcance.empresas }, ...(alcance.sectores ? { centroCostoId: { in: alcance.sectores } } : {}) },
            });
            if (enAlcance !== unicos.length) throw new FueraDeAlcance();
            return query(args);
          },
        },
      },
    }),
  };
}
