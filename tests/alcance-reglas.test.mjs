// Alcance por empresa y por sector: qué se filtra y cómo (lib/alcance-reglas.ts), y qué roles admiten sectores.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { caminos as deducir, decidir, sumarFiltro, legajosDelAlta, empresasDelAlta } from "../lib/alcance-reglas.ts";
import { modulosIncompatiblesConSectores, ROLES_PREDEFINIDOS } from "../lib/permisos.ts";

// Un esquema mínimo con la misma forma que entrega Prisma.
const obj = (name, type, extra = {}) => ({ name, kind: "object", type, isList: false, relationFromFields: [name + "Id"], ...extra });
const esc = (name) => ({ name, kind: "scalar", type: "String", isList: false });
const modelos = [
  { name: "Empresa", fields: [obj("legajos", "Legajo", { isList: true, relationFromFields: [] })] },
  { name: "Legajo", fields: [esc("empresaId"), obj("empresa", "Empresa"), obj("jefe", "Legajo"), obj("equipo", "Legajo", { isList: true, relationFromFields: [] })] },
  { name: "Vacacion", fields: [obj("legajo", "Legajo")] },
  { name: "SolicitudAusencia", fields: [obj("legajo", "Legajo"), obj("solicitadoPor", "Legajo")] },
  { name: "Embargo", fields: [obj("legajo", "Legajo")] },
  { name: "CuotaEmbargo", fields: [obj("embargo", "Embargo")] },
  { name: "Periodo", fields: [esc("empresaId"), obj("empresa", "Empresa")] },
  { name: "Salvedad", fields: [obj("periodo", "Periodo")] },
  { name: "CentroCosto", fields: [esc("empresaId"), obj("empresa", "Empresa")] },
  { name: "Noticia", fields: [esc("empresaId"), obj("empresa", "Empresa")] },
  { name: "PeriodoAsistencia", fields: [esc("empresaId")] },
  { name: "UsuarioEmpresa", fields: [esc("empresaId"), obj("empresa", "Empresa")] },
  { name: "Convenio", fields: [] },
];
const c = deducir(modelos);
const EMP = ["moras"];
const enEmp = { empresaId: { in: EMP } };
const soloEmpresa = { empresas: EMP, sectores: null };
const conSector = { empresas: EMP, sectores: ["taller"] };
const enSector = { centroCostoId: { in: ["taller"] } };

describe("Qué tablas se protegen", () => {
  it("lo deduce del esquema: de personas, de la empresa, y generales", () => {
    expect(c.legajo.get("Legajo")).toEqual([]);
    expect(c.legajo.get("Vacacion")).toEqual(["legajo"]);
    expect(c.legajo.get("SolicitudAusencia")).toEqual(["legajo"]); // no "solicitadoPor"
    expect(c.legajo.get("CuotaEmbargo")).toEqual(["embargo", "legajo"]);
    expect(c.empresa.get("Periodo")).toEqual([]);
    expect(c.empresa.get("Salvedad")).toEqual(["periodo"]);
    expect(c.empresa.has("Legajo")).toBe(false); // ya está como persona
    expect(c.empresa.has("UsuarioEmpresa")).toBe(false); // tabla de accesos
    expect(c.legajo.has("Convenio") || c.empresa.has("Convenio")).toBe(false);
  });

  it("en el esquema real, toda tabla con legajoId o empresaId queda cubierta", () => {
    const esquema = readFileSync(new URL("../prisma/schema.prisma", import.meta.url), "utf8");
    const reales = [...esquema.matchAll(/^model (\w+) \{([\s\S]*?)^\}/gm)].map(([, name, cuerpo]) => ({
      name,
      fields: [
        ...[...cuerpo.matchAll(/^\s+(\w+)\s+(\w+)(\[\])?\??\s.*@relation\(([^)]*)\)/gm)].map(([, campo, type, lista, rel]) => ({
          name: campo, kind: "object", type, isList: !!lista, relationFromFields: /fields:/.test(rel) ? ["x"] : [],
        })),
        ...(/^\s+empresaId\s/m.test(cuerpo) ? [esc("empresaId")] : []),
      ],
      conLegajoId: /^\s+legajoId\s/m.test(cuerpo),
      conEmpresaId: /^\s+empresaId\s/m.test(cuerpo),
    }));
    const r = deducir(reales);
    expect(reales.filter((m) => m.conLegajoId && !r.legajo.has(m.name)).map((m) => m.name)).toEqual([]);
    expect(reales.filter((m) => m.conEmpresaId && !r.legajo.has(m.name) && !r.empresa.has(m.name)).map((m) => m.name)).toEqual(["UsuarioEmpresa"]);
    for (const m of ["Vacacion", "SolicitudAusencia", "Fichada", "AsistenciaDia", "DocumentoLegajo", "Liquidacion", "LiquidacionDetalle", "CuotaEmbargo", "AccesoPortal", "ReciboDigital"]) expect(r.legajo.has(m), m).toBe(true);
    for (const m of ["Periodo", "CentroCosto", "Sucursal", "Noticia", "PeriodoAsistencia", "DispositivoAsistencia", "PresupuestoSalarial", "Salvedad", "AprobacionPeriodo"]) expect(r.empresa.has(m), m).toBe(true);
  });
});

describe("Límite por empresa (todo usuario que no es administrador)", () => {
  it("datos de personas: solo de sus empresas, también al modificar", () => {
    expect(decidir("Legajo", "findUnique", soloEmpresa, c)).toEqual({ accion: "filtrar", where: enEmp });
    expect(decidir("Legajo", "update", soloEmpresa, c)).toEqual({ accion: "filtrar", where: enEmp }); // el caso que motivó esto
    expect(decidir("Vacacion", "findMany", soloEmpresa, c)).toEqual({ accion: "filtrar", where: { legajo: enEmp } });
    expect(decidir("CuotaEmbargo", "delete", soloEmpresa, c)).toEqual({ accion: "filtrar", where: { embargo: { legajo: enEmp } } });
  });
  it("datos de la empresa: períodos, sectores, y lo que cuelga de ellos", () => {
    expect(decidir("Periodo", "findUnique", soloEmpresa, c)).toEqual({ accion: "filtrar", where: enEmp });
    expect(decidir("Salvedad", "findMany", soloEmpresa, c)).toEqual({ accion: "filtrar", where: { periodo: enEmp } });
    expect(decidir("CentroCosto", "update", soloEmpresa, c)).toEqual({ accion: "filtrar", where: enEmp });
    expect(decidir("PeriodoAsistencia", "update", soloEmpresa, c).accion).toBe("filtrar"); // sin sectores sí puede cerrar asistencia
  });
  it("altas: se revisa para quién o para qué empresa son", () => {
    expect(decidir("Legajo", "create", soloEmpresa, c)).toEqual({ accion: "revisar_alta", de: "empresa" });
    expect(decidir("Vacacion", "create", soloEmpresa, c)).toEqual({ accion: "revisar_alta", de: "legajo" });
    expect(decidir("Periodo", "create", soloEmpresa, c)).toEqual({ accion: "revisar_alta", de: "empresa" });
    expect(decidir("CuotaEmbargo", "create", soloEmpresa, c).accion).toBe("pasar");
  });
  it("la empresa misma: solo las asignadas, y no se crean ni se borran", () => {
    expect(decidir("Empresa", "findMany", soloEmpresa, c)).toEqual({ accion: "filtrar", where: { id: { in: EMP } } });
    expect(decidir("Empresa", "update", soloEmpresa, c).accion).toBe("filtrar");
    expect(decidir("Empresa", "create", soloEmpresa, c).accion).toBe("negar");
    expect(decidir("Empresa", "delete", soloEmpresa, c).accion).toBe("negar");
  });
  it("tablas generales y de accesos pasan sin tocar", () => {
    expect(decidir("Convenio", "findMany", soloEmpresa, c).accion).toBe("pasar");
    expect(decidir("UsuarioEmpresa", "findMany", soloEmpresa, c).accion).toBe("pasar");
  });
  it("sin ninguna empresa asignada no ve nada", () => {
    expect(decidir("Legajo", "findMany", { empresas: [], sectores: null }, c)).toEqual({ accion: "filtrar", where: { empresaId: { in: [] } } });
  });
});

describe("Límite por sector (además del de empresa)", () => {
  it("personas: de sus empresas Y de sus sectores", () => {
    expect(decidir("Legajo", "findMany", conSector, c)).toEqual({ accion: "filtrar", where: { ...enEmp, ...enSector } });
    expect(decidir("Vacacion", "findUnique", conSector, c)).toEqual({ accion: "filtrar", where: { legajo: { ...enEmp, ...enSector } } });
    expect(decidir("Vacacion", "deleteMany", conSector, c).accion).toBe("filtrar");
  });
  it("altas: se revisa a quién corresponde; legajos nuevos e indirectos, no", () => {
    expect(decidir("Vacacion", "create", conSector, c)).toEqual({ accion: "revisar_alta", de: "legajo" });
    expect(decidir("Vacacion", "upsert", conSector, c).accion).toBe("revisar_alta");
    expect(decidir("Legajo", "create", conSector, c).accion).toBe("negar");
    expect(decidir("CuotaEmbargo", "create", conSector, c).accion).toBe("negar");
  });
  it("cosas de toda la empresa: mirar sí, tocar no", () => {
    expect(decidir("PeriodoAsistencia", "findMany", conSector, c).accion).toBe("filtrar");
    expect(decidir("PeriodoAsistencia", "update", conSector, c).accion).toBe("negar");
    expect(decidir("PeriodoAsistencia", "create", conSector, c).accion).toBe("negar");
  });
  it("sectores: solo los propios", () => {
    expect(decidir("CentroCosto", "findMany", conSector, c)).toEqual({ accion: "filtrar", where: { ...enEmp, id: { in: ["taller"] } } });
    expect(decidir("CentroCosto", "create", conSector, c).accion).toBe("negar");
  });
  it("noticias: lee las generales y las suyas; modifica solo las suyas", () => {
    expect(decidir("Noticia", "findMany", conSector, c)).toEqual({ accion: "filtrar", where: { ...enEmp, OR: [{ centroCostoId: null }, enSector] } });
    expect(decidir("Noticia", "update", conSector, c)).toEqual({ accion: "filtrar", where: { ...enEmp, ...enSector } });
    expect(decidir("Noticia", "create", conSector, c)).toEqual({ accion: "revisar_alta", de: "noticia" });
  });
  it("una operación que no conocemos sobre datos protegidos se niega", () => {
    expect(decidir("Vacacion", "algoNuevo", conSector, c).accion).toBe("negar");
    expect(decidir("Periodo", "algoNuevo", soloEmpresa, c).accion).toBe("negar");
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
    expect(empresasDelAlta("create", { data: { empresaId: "moras" } })).toEqual(["moras"]);
    expect(empresasDelAlta("create", { data: { empresa: { connect: { id: "moras" } } } })).toEqual(["moras"]);
    expect(empresasDelAlta("create", { data: { nombre: "x" } })).toBeNull();
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
