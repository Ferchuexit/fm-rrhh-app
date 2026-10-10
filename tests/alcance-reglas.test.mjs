// Alcance por sector: qué se filtra y cómo (lib/alcance-reglas.ts), y qué roles lo admiten.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { caminosAlLegajo, decidir, sumarFiltro, legajosDelAlta } from "../lib/alcance-reglas.ts";
import { modulosIncompatiblesConSectores, ROLES_PREDEFINIDOS } from "../lib/permisos.ts";

// Un esquema mínimo con la misma forma que entrega Prisma.
const obj = (name, type, extra = {}) => ({ name, kind: "object", type, isList: false, relationFromFields: [name + "Id"], ...extra });
const modelos = [
  { name: "Legajo", fields: [obj("jefe", "Legajo"), obj("equipo", "Legajo", { isList: true, relationFromFields: [] })] },
  { name: "Vacacion", fields: [obj("legajo", "Legajo")] },
  { name: "SolicitudAusencia", fields: [obj("legajo", "Legajo"), obj("solicitadoPor", "Legajo")] },
  { name: "Embargo", fields: [obj("legajo", "Legajo")] },
  { name: "CuotaEmbargo", fields: [obj("embargo", "Embargo")] },
  { name: "Empresa", fields: [obj("legajos", "Legajo", { isList: true, relationFromFields: [] })] },
  { name: "Periodo", fields: [] },
];
const caminos = caminosAlLegajo(modelos);
const S = ["taller"];
const enSector = { centroCostoId: { in: S } };

describe("Qué modelos son 'de personas'", () => {
  it("lo deduce del esquema, directo y a un salto", () => {
    expect(caminos.get("Legajo")).toEqual([]);
    expect(caminos.get("Vacacion")).toEqual(["legajo"]);
    expect(caminos.get("SolicitudAusencia")).toEqual(["legajo"]); // no "solicitadoPor"
    expect(caminos.get("CuotaEmbargo")).toEqual(["embargo", "legajo"]);
    expect(caminos.has("Empresa")).toBe(false);
    expect(caminos.has("Periodo")).toBe(false);
  });

  it("en el esquema real, todo modelo con legajoId queda cubierto", () => {
    const esquema = readFileSync(new URL("../prisma/schema.prisma", import.meta.url), "utf8");
    const reales = [...esquema.matchAll(/^model (\w+) \{([\s\S]*?)^\}/gm)].map(([, name, cuerpo]) => ({
      name,
      fields: [...cuerpo.matchAll(/^\s+(\w+)\s+(\w+)(\[\])?\??\s.*@relation\(([^)]*)\)/gm)].map(([, campo, type, lista, rel]) => ({
        name: campo, kind: "object", type, isList: !!lista, relationFromFields: /fields:/.test(rel) ? ["x"] : [],
      })),
      conLegajoId: /^\s+legajoId\s/m.test(cuerpo),
    }));
    const reales_caminos = caminosAlLegajo(reales);
    const sinCubrir = reales.filter((m) => m.conLegajoId && !reales_caminos.has(m.name)).map((m) => m.name);
    expect(sinCubrir).toEqual([]);
    for (const m of ["Vacacion", "SolicitudAusencia", "Fichada", "AsistenciaDia", "DocumentoLegajo", "Liquidacion", "LiquidacionDetalle", "CuotaEmbargo", "AccesoPortal", "ReciboDigital"]) {
      expect(reales_caminos.has(m), m).toBe(true);
    }
  });
});

describe("Qué se hace con cada consulta", () => {
  it("lecturas y modificaciones con where: se filtra por sector", () => {
    expect(decidir("Legajo", "findMany", S, caminos)).toEqual({ accion: "filtrar", where: enSector });
    expect(decidir("Vacacion", "findUnique", S, caminos)).toEqual({ accion: "filtrar", where: { legajo: enSector } });
    expect(decidir("CuotaEmbargo", "count", S, caminos)).toEqual({ accion: "filtrar", where: { embargo: { legajo: enSector } } });
    expect(decidir("Vacacion", "deleteMany", S, caminos)).toEqual({ accion: "filtrar", where: { legajo: enSector } });
    expect(decidir("Legajo", "update", S, caminos)).toEqual({ accion: "filtrar", where: enSector });
  });
  it("altas: se revisa a quién corresponde; legajos nuevos e indirectos, no", () => {
    expect(decidir("Vacacion", "create", S, caminos)).toEqual({ accion: "revisar_alta", camino: ["legajo"] });
    expect(decidir("Vacacion", "upsert", S, caminos).accion).toBe("revisar_alta");
    expect(decidir("Legajo", "create", S, caminos).accion).toBe("negar");
    expect(decidir("CuotaEmbargo", "create", S, caminos).accion).toBe("negar");
  });
  it("lo que no es de personas pasa sin tocar", () => {
    expect(decidir("Periodo", "findMany", S, caminos).accion).toBe("pasar");
    expect(decidir("Empresa", "update", S, caminos).accion).toBe("pasar");
  });
  it("cosas de toda la empresa: mirar sí, tocar no", () => {
    expect(decidir("PeriodoAsistencia", "findMany", S, caminos).accion).toBe("pasar");
    expect(decidir("PeriodoAsistencia", "update", S, caminos).accion).toBe("negar");
    expect(decidir("DispositivoAsistencia", "create", S, caminos).accion).toBe("negar");
  });
  it("sectores: solo los propios", () => {
    expect(decidir("CentroCosto", "findMany", S, caminos)).toEqual({ accion: "filtrar", where: { id: { in: S } } });
    expect(decidir("CentroCosto", "create", S, caminos).accion).toBe("negar");
  });
  it("noticias: lee las generales y las suyas; modifica solo las suyas", () => {
    expect(decidir("Noticia", "findMany", S, caminos)).toEqual({ accion: "filtrar", where: { OR: [{ centroCostoId: null }, enSector] } });
    expect(decidir("Noticia", "update", S, caminos)).toEqual({ accion: "filtrar", where: enSector });
    expect(decidir("Noticia", "create", S, caminos).accion).toBe("revisar_alta");
  });
  it("una operación que no conocemos sobre datos de personas se niega", () => {
    expect(decidir("Vacacion", "algoNuevo", S, caminos).accion).toBe("negar");
  });
});

describe("Armado del filtro", () => {
  it("se suma al where sin pisar lo que ya había", () => {
    expect(sumarFiltro(undefined, enSector)).toEqual({ AND: [enSector] });
    expect(sumarFiltro({ id: "x" }, enSector)).toEqual({ id: "x", AND: [enSector] });
    expect(sumarFiltro({ AND: { a: 1 } }, enSector)).toEqual({ AND: [{ a: 1 }, enSector] });
    expect(sumarFiltro({ AND: [{ a: 1 }], OR: [{ b: 2 }] }, enSector)).toEqual({ AND: [{ a: 1 }, enSector], OR: [{ b: 2 }] });
  });
  it("de un alta saca a quién corresponde, o se niega", () => {
    expect(legajosDelAlta("create", { data: { legajoId: "a" } })).toEqual(["a"]);
    expect(legajosDelAlta("create", { data: { legajo: { connect: { id: "b" } } } })).toEqual(["b"]);
    expect(legajosDelAlta("createMany", { data: [{ legajoId: "a" }, { legajoId: "c" }] })).toEqual(["a", "c"]);
    expect(legajosDelAlta("upsert", { where: {}, create: { legajoId: "d" }, update: {} })).toEqual(["d"]);
    expect(legajosDelAlta("create", { data: { otraCosa: 1 } })).toBeNull();
    expect(legajosDelAlta("createMany", { data: [{ legajoId: "a" }, {}] })).toBeNull();
  });
});

describe("Qué roles se pueden combinar con sectores", () => {
  const rol = (id) => ROLES_PREDEFINIDOS.find((r) => r.id === id).permisos;
  it("Supervisor sí; los que tocan liquidación, no", () => {
    expect(modulosIncompatiblesConSectores(rol("rol-supervisor"))).toEqual([]);
    expect(modulosIncompatiblesConSectores(rol("rol-liquidador")).length).toBeGreaterThan(0);
    expect(modulosIncompatiblesConSectores(rol("rol-rrhh-completo")).length).toBeGreaterThan(0);
    expect(modulosIncompatiblesConSectores(rol("rol-solo-lectura")).length).toBeGreaterThan(0);
  });
  it("Legajos solo en 'ver'", () => {
    expect(modulosIncompatiblesConSectores({ legajos: "ver", vacaciones: "gestionar" })).toEqual([]);
    expect(modulosIncompatiblesConSectores({ legajos: "gestionar" })).toEqual(["Legajos"]);
    expect(modulosIncompatiblesConSectores({ reportes: "ver" })).toEqual(["Reportes"]);
  });
});
