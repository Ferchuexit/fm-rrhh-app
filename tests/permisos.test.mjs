// Roles y permisos por módulo (lib/permisos.ts).
import { describe, it, expect } from "vitest";
import { readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  MODULOS, CLAVES_MODULO, ROLES_PREDEFINIDOS, RUTAS_PUBLICAS, reglaDeRuta, puedeAcceder, permisosHeredados, limpiarPermisos,
  compactar, descompactar, armarPermisosToken, permisosEnEmpresa,
} from "../lib/permisos.ts";
import { ESTRUCTURA_MENU, menuFiltrado } from "../lib/menu-estructura.ts";

const rol = (nombre) => ROLES_PREDEFINIDOS.find((r) => r.nombre === nombre).permisos;
const puede = (ruta, metodo, permisos) => puedeAcceder(ruta, metodo, false, permisos);

// Todas las rutas reales del proyecto, leídas del disco.
function rutasDelProyecto() {
  const rutas = [];
  const andar = (dir, url) => {
    for (const n of readdirSync(dir)) {
      const p = join(dir, n);
      if (statSync(p).isDirectory()) andar(p, n.startsWith("(") ? url : `${url}/${n.replace(/\[.*?\]/g, "x1")}`);
      else if (n === "page.tsx" || n === "route.ts") rutas.push(url || "/");
    }
  };
  andar("app", "");
  return [...new Set(rutas)];
}

describe("Ninguna ruta queda sin clasificar", () => {
  const rutas = rutasDelProyecto().filter((r) => !r.startsWith("/portal") && !r.startsWith("/api/portal")); // el portal tiene su propia puerta

  it("encuentra las rutas del proyecto", () => expect(rutas.length).toBeGreaterThan(100));

  it("cada pantalla y cada API del panel tiene dueño (módulo, solo-admin, libre o pública)", () => {
    const sueltas = rutas.filter((r) => reglaDeRuta(r).tipo === "sin_clasificar");
    // Si esto falla, se agregó una ruta nueva: sumala a un módulo en lib/permisos.ts.
    expect(sueltas).toEqual([]);
  });

  it("una ruta inventada queda cerrada para todos menos admin", () => {
    expect(reglaDeRuta("/api/modulo-nuevo-sin-clasificar").tipo).toBe("sin_clasificar");
    expect(puede("/api/modulo-nuevo-sin-clasificar", "GET", rol("RR.HH. completo"))).toBe(false);
    expect(puedeAcceder("/api/modulo-nuevo-sin-clasificar", "GET", true, null)).toBe(true);
  });

  it("todo ítem del menú apunta a una pantalla clasificada, y cada módulo tiene alguna pantalla en el menú", () => {
    const items = ESTRUCTURA_MENU.flatMap((c) => c.items);
    for (const i of items) expect(reglaDeRuta(i.href).tipo, i.href).not.toBe("sin_clasificar");
    for (const m of MODULOS) expect(items.some((i) => { const r = reglaDeRuta(i.href); return r.tipo === "modulo" && r.modulos.includes(m.clave); }), m.clave).toBe(true);
  });

  it("las rutas de cada módulo existen de verdad (no quedó un prefijo viejo)", () => {
    for (const m of MODULOS) for (const r of m.rutas) {
      const base = r.startsWith("/api/") ? join("app", r) : join("app", r);
      expect(existsSync(base), `${m.clave}: ${r}`).toBe(true);
    }
  });
});

describe("Admin, público y solo-admin", () => {
  it("admin entra a todo", () => {
    for (const r of ["/usuarios", "/roles", "/api/empresas", "/reglas", "/api/liquidar"]) expect(puedeAcceder(r, "POST", true, null), r).toBe(true);
  });

  it("usuarios, roles y empresas no se delegan ni con el rol más amplio", () => {
    const todo = Object.fromEntries(CLAVES_MODULO.map((c) => [c, "gestionar"]));
    for (const r of ["/usuarios", "/api/usuarios", "/api/usuarios/x1/empresas", "/roles", "/api/roles", "/api/roles/x1", "/empresas", "/api/empresas", "/api/empresas/x1"]) {
      expect(puede(r, "GET", todo), r).toBe(false);
    }
  });

  it("la terminal de fichadas sigue entrando sin sesión, solo por sus rutas exactas", () => {
    for (const r of RUTAS_PUBLICAS) expect(reglaDeRuta(r).tipo, r).toBe("publica");
    expect(reglaDeRuta("/api/dispositivos/pin").tipo).toBe("modulo");
    expect(reglaDeRuta("/api/dispositivos").tipo).toBe("modulo");
  });

  it("sin empresa asignada no se entra a ningún módulo, pero sí al inicio", () => {
    expect(puede("/legajos", "GET", null)).toBe(false);
    expect(puede("/api/legajos", "GET", null)).toBe(false);
    expect(puede("/", "GET", null)).toBe(true);
    expect(puede("/api/empresa-actual", "GET", null)).toBe(true);
  });
});

describe("Ver vs. gestionar", () => {
  const ver = { vacaciones: "ver" };
  const gestionar = { vacaciones: "gestionar" };

  it("'ver' lee pero no modifica; 'gestionar' hace las dos cosas", () => {
    expect(puede("/vacaciones", "GET", ver)).toBe(true);
    expect(puede("/api/vacaciones", "GET", ver)).toBe(true);
    expect(puede("/api/vacaciones", "POST", ver)).toBe(false);
    expect(puede("/api/solicitudes/x1", "POST", ver)).toBe(false);
    expect(puede("/api/vacaciones", "POST", gestionar)).toBe(true);
    expect(puede("/api/solicitudes/x1", "POST", gestionar)).toBe(true);
  });

  it("sin el módulo, ni se ve", () => {
    expect(puede("/liquidacion-masiva", "GET", gestionar)).toBe(false);
    expect(puede("/api/recibo", "GET", gestionar)).toBe(false);
    expect(puede("/api/dashboard", "GET", gestionar)).toBe(false);
  });

  it("los POST que solo consultan (validar, probar, bajar el PDF) alcanzan con 'ver'", () => {
    expect(puede("/api/recibos/exportar", "POST", { liquidaciones: "ver" })).toBe(true);
    expect(puede("/api/auditar", "POST", { cierre: "ver" })).toBe(true);
    expect(puede("/api/cerrar", "POST", { cierre: "ver" })).toBe(false); // cerrar SÍ modifica
    expect(puede("/api/liquidar", "POST", { liquidaciones: "ver" })).toBe(false);
  });
});

describe("Consultas compartidas entre módulos", () => {
  const soloNoticias = { noticias: "gestionar" };

  it("las listas para elegir (período, convenio, sector, empleado) las lee cualquier rol", () => {
    for (const r of ["/api/legajos", "/api/periodos", "/api/convenios", "/api/categorias", "/api/centros-costo", "/api/conceptos"]) expect(puede(r, "GET", soloNoticias), r).toBe(true);
  });

  it("...pero solo leerlas, y solo la lista: ni modificar, ni la ficha de un empleado", () => {
    expect(puede("/api/periodos", "POST", soloNoticias)).toBe(false);
    expect(puede("/api/convenios", "POST", soloNoticias)).toBe(false);
    expect(puede("/api/conceptos/x1", "PATCH", soloNoticias)).toBe(false);
    expect(puede("/api/legajos", "POST", soloNoticias)).toBe(false);
    expect(puede("/api/legajos/x1", "GET", soloNoticias)).toBe(false);
    expect(puede("/api/legajos/x1/documentos", "GET", soloNoticias)).toBe(false);
  });

  it("Vacaciones deja MIRAR la ficha de un empleado, no editarla ni ver sus embargos", () => {
    const p = { vacaciones: "gestionar" };
    expect(puede("/api/legajos/x1", "GET", p)).toBe(true);
    expect(puede("/api/legajos/x1", "PATCH", p)).toBe(false);
    expect(puede("/api/legajos/x1", "DELETE", p)).toBe(false);
    expect(puede("/api/legajos/x1/embargos", "GET", p)).toBe(false);
    expect(puede("/api/legajos/x1/documentos", "POST", p)).toBe(false);
  });

  it("Legajo digital deja ABRIR un documento, no borrarlo", () => {
    const p = { legajo_digital: "gestionar" };
    expect(puede("/api/documentos/x1", "GET", p)).toBe(true);
    expect(puede("/api/documentos/x1", "DELETE", p)).toBe(false);
    expect(puede("/api/documentos/x1", "DELETE", { legajos: "gestionar" })).toBe(true);
  });

  it("el prefijo más largo gana: el logo de la terminal es de Dispositivos, no de Empresas", () => {
    expect(puede("/api/empresas/actual/logo", "POST", { dispositivos: "gestionar" })).toBe(true);
    expect(puede("/api/empresas", "GET", { dispositivos: "gestionar" })).toBe(false);
  });
});

describe("Los usuarios que ya existían no cambian", () => {
  const operador = permisosHeredados("operador");
  const lectura = permisosHeredados("lectura");

  it("operador: trabajo diario sí, configuración y dispositivos no (eran solo de admin)", () => {
    for (const r of ["/legajos", "/novedades", "/liquidacion-masiva", "/auditoria", "/exportar", "/dashboard", "/vacaciones", "/asistencia", "/legajo-digital", "/noticias"]) expect(puede(r, "GET", operador), r).toBe(true);
    for (const r of ["/api/liquidar", "/api/novedades/confirmar", "/api/cerrar", "/api/vacaciones", "/api/legajos/x1"]) expect(puede(r, "POST", operador), r).toBe(true);
    for (const r of ["/conceptos", "/reglas", "/parametros", "/convenios", "/escalas", "/dispositivos", "/usuarios", "/empresas", "/estado-implementacion"]) expect(puede(r, "GET", operador), r).toBe(false);
    for (const r of ["/api/reglas", "/api/parametros", "/api/dispositivos/pin", "/api/usuarios"]) expect(puede(r, "POST", operador), r).toBe(false);
  });

  it("lectura: ve lo mismo que el operador y no modifica nada", () => {
    for (const r of ["/legajos", "/liquidacion-masiva", "/dashboard", "/api/legajos/x1", "/api/vacaciones"]) expect(puede(r, "GET", lectura), r).toBe(true);
    for (const r of ["/api/liquidar", "/api/legajos", "/api/vacaciones", "/api/noticias", "/api/novedades/confirmar"]) expect(puede(r, "POST", lectura), r).toBe(false);
    expect(puede("/reglas", "GET", lectura)).toBe(false);
  });
});

describe("Roles que vienen armados", () => {
  it("Supervisor gestiona a la gente y no ve nada de sueldos", () => {
    const p = rol("Supervisor");
    for (const r of ["/asistencia", "/vacaciones", "/solicitudes", "/legajo-digital", "/noticias", "/accesos-portal", "/legajos"]) expect(puede(r, "GET", p), r).toBe(true);
    for (const r of ["/liquidacion-masiva", "/liquidacion-individual", "/recibos", "/preliquidacion", "/auditoria", "/exportar", "/dashboard", "/costo-laboral", "/novedades", "/reglas", "/firmas-recibos"]) expect(puede(r, "GET", p), r).toBe(false);
    for (const r of ["/api/recibo", "/api/recibos/exportar", "/api/liquidar/estado", "/api/dashboard", "/api/exportar/lsd", "/api/preliquidacion/exportar", "/api/liquidacion-detalle/x1/como-se-calculo"]) expect(puede(r, "GET", p), r).toBe(false);
    expect(puede("/api/legajos/x1", "PATCH", p)).toBe(false); // legajos: solo ver
    expect(puede("/api/solicitudes/x1", "POST", p)).toBe(true);
  });

  it("Liquidador liquida, y de Gestión Humana solo mira", () => {
    const p = rol("Liquidador");
    for (const r of ["/api/liquidar", "/api/novedades/confirmar", "/api/cerrar", "/api/legajos"]) expect(puede(r, "POST", p), r).toBe(true);
    expect(puede("/vacaciones", "GET", p)).toBe(true);
    expect(puede("/api/vacaciones", "POST", p)).toBe(false);
    expect(puede("/noticias", "GET", p)).toBe(false);
    expect(puede("/reglas", "GET", p)).toBe(false);
  });

  it("ningún rol armado toca la configuración del cálculo, y Solo lectura no modifica nada", () => {
    for (const r of ROLES_PREDEFINIDOS) expect(r.permisos.configuracion, r.nombre).toBeUndefined();
    const sl = rol("Solo lectura");
    expect(Object.values(sl).every((n) => n === "ver")).toBe(true);
    expect(puede("/api/noticias", "POST", sl)).toBe(false);
  });
});

describe("El menú muestra exactamente lo que se puede abrir", () => {
  it("para cada rol armado: todo link visible funciona, y todo link oculto está bloqueado", () => {
    const todos = ESTRUCTURA_MENU.flatMap((c) => c.items.map((i) => i.href));
    for (const r of ROLES_PREDEFINIDOS) {
      const visibles = menuFiltrado(false, r.permisos).flatMap((c) => c.items.map((i) => i.href));
      for (const h of todos) expect(visibles.includes(h), `${r.nombre} ${h}`).toBe(puede(h, "GET", r.permisos));
      expect(visibles).not.toContain("/usuarios");
      expect(visibles).not.toContain("/roles");
    }
  });
  it("admin ve todo; sin permisos no ve nada", () => {
    expect(menuFiltrado(true, null).flatMap((c) => c.items).length).toBe(ESTRUCTURA_MENU.flatMap((c) => c.items).length);
    expect(menuFiltrado(false, null)).toEqual([]);
    expect(menuFiltrado(false, {})).toEqual([]);
  });
});

describe("Lo que viaja en el token", () => {
  it("compactar y descompactar es ida y vuelta", () => {
    for (const r of ROLES_PREDEFINIDOS) expect(descompactar(compactar(r.permisos))).toEqual(r.permisos);
    expect(descompactar("legajos:g,inventado:g,novedades:x,,:")).toEqual({ legajos: "gestionar" });
  });

  it("cada empresa conserva SU rol, y el cambio de empresa cambia los permisos", () => {
    const pt = armarPermisosToken([{ empresaId: "a", permisos: rol("Liquidador") }, { empresaId: "b", permisos: rol("Solo lectura") }, { empresaId: "c", permisos: rol("Liquidador") }]);
    expect(pt.roles.length).toBe(2); // el rol repetido viaja una sola vez
    expect(permisosEnEmpresa(pt, "b")).toEqual(rol("Solo lectura"));
    expect(permisosEnEmpresa(pt, "c")).toEqual(rol("Liquidador"));
    expect(puede("/api/liquidar", "POST", permisosEnEmpresa(pt, "a"))).toBe(true);
    expect(puede("/api/liquidar", "POST", permisosEnEmpresa(pt, "b"))).toBe(false);
  });

  it("una cookie de empresa ajena o vacía cae a la primera empresa propia — nunca a más permisos", () => {
    const pt = armarPermisosToken([{ empresaId: "a", permisos: rol("Solo lectura") }, { empresaId: "b", permisos: rol("RR.HH. completo") }]);
    expect(permisosEnEmpresa(pt, "empresa-de-otro")).toEqual(rol("Solo lectura"));
    expect(permisosEnEmpresa(pt, undefined)).toEqual(rol("Solo lectura"));
    expect(permisosEnEmpresa({ roles: [], emp: [] }, "a")).toBeNull();
    expect(permisosEnEmpresa(null, "a")).toBeNull();
  });

  it("40 empresas entran cómodas en una cookie", () => {
    const pt = armarPermisosToken(Array.from({ length: 40 }, (_, i) => ({ empresaId: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`, permisos: i % 2 ? rol("Liquidador") : rol("RR.HH. completo") })));
    expect(JSON.stringify(pt).length * 1.4).toBeLessThan(3500); // +40% por la codificación del token; el límite de una cookie es ~4000
  });
});

describe("Lo que llega de un formulario", () => {
  it("se descartan módulos y niveles inventados", () => {
    expect(limpiarPermisos({ legajos: "gestionar", novedades: "ver", inventado: "gestionar", cierre: "admin", exportar: "", constructor: "gestionar", __proto__: { reportes: "gestionar" } })).toEqual({ legajos: "gestionar", novedades: "ver" });
    for (const x of [null, undefined, "texto", 7, []]) expect(limpiarPermisos(x)).toEqual({});
  });
});
