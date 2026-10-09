// Portal del empleado — reglas del PIN e identificación (lib/portal-pin.ts).
import { describe, it, expect } from "vitest";
import { esPinTrivial, validarPinNuevo, generarPinTemporal, interpretarIdentificacion, coincideIdentificacion, soloDigitos } from "../lib/portal-pin.ts";

const CUIL = "20171871817"; // DNI 17187181

describe("PIN del portal", () => {
  it("rechaza los PIN que cualquiera probaría primero", () => {
    for (const pin of ["000000", "111111", "999999", "123456", "654321", "012345", "987654"]) {
      expect(esPinTrivial(pin), pin).toBe(true);
      expect(validarPinNuevo(pin, CUIL), pin).not.toBeNull();
    }
  });

  it("acepta un PIN normal", () => {
    for (const pin of ["482915", "120934", "909172"]) expect(validarPinNuevo(pin, CUIL), pin).toBeNull();
  });

  it("exige exactamente 6 números", () => {
    for (const pin of ["", "4829", "48291", "4829155", "48a915", " 82915"]) expect(validarPinNuevo(pin, CUIL), JSON.stringify(pin)).not.toBeNull();
  });

  it("no deja usar un pedazo del propio CUIL/DNI", () => {
    expect(validarPinNuevo("171871", CUIL)).not.toBeNull(); // arranque del DNI
    expect(validarPinNuevo("187181", CUIL)).not.toBeNull(); // medio del DNI
    expect(validarPinNuevo("871817", "20-17187181-7")).not.toBeNull(); // CUIL con guiones
  });

  it("el PIN temporal siempre cumple las mismas reglas que se le exigen al empleado", () => {
    const vistos = new Set();
    for (let i = 0; i < 2000; i++) {
      const pin = generarPinTemporal(CUIL);
      expect(pin).toMatch(/^\d{6}$/);
      expect(validarPinNuevo(pin, CUIL)).toBeNull();
      vistos.add(pin);
    }
    expect(vistos.size).toBeGreaterThan(1950); // no repite: es al azar de verdad
  });
});

describe("Identificación en el login (CUIL o DNI)", () => {
  it("entiende CUIL con y sin guiones, y DNI de 7 u 8 dígitos", () => {
    expect(interpretarIdentificacion("20-17187181-7")).toEqual({ tipo: "cuil", valor: CUIL });
    expect(interpretarIdentificacion(" 20171871817 ")).toEqual({ tipo: "cuil", valor: CUIL });
    expect(interpretarIdentificacion("17.187.181")).toEqual({ tipo: "dni", valor: "17187181" });
    expect(interpretarIdentificacion("5123456")).toEqual({ tipo: "dni", valor: "05123456" });
  });

  it("rechaza lo que no es ni CUIL ni DNI", () => {
    for (const t of ["", "abc", "123", "123456", "123456789", "2017187181712", null, undefined]) expect(interpretarIdentificacion(t), String(t)).toBeNull();
  });

  it("compara contra el CUIL guardado, tenga guiones o no", () => {
    const cuil = interpretarIdentificacion(CUIL);
    const dni = interpretarIdentificacion("17187181");
    for (const guardado of ["20171871817", "20-17187181-7"]) {
      expect(coincideIdentificacion(guardado, cuil)).toBe(true);
      expect(coincideIdentificacion(guardado, dni)).toBe(true);
    }
  });

  it("un DNI parecido NO entra: tiene que coincidir entero", () => {
    // 1718718 está contenido en 17187181 — la búsqueda por 'contains' de la
    // base lo trae como candidato, y este filtro es el que lo descarta.
    expect(coincideIdentificacion(CUIL, interpretarIdentificacion("1718718"))).toBe(false);
    expect(coincideIdentificacion(CUIL, interpretarIdentificacion("27171871817"))).toBe(false);
    expect(coincideIdentificacion("2017187181", interpretarIdentificacion("17187181"))).toBe(false); // CUIL guardado incompleto
  });

  it("soloDigitos aguanta cualquier cosa", () => {
    expect(soloDigitos(null)).toBe("");
    expect(soloDigitos(123456)).toBe("123456");
    expect(soloDigitos("1 2-3.4")).toBe("1234");
  });
});
