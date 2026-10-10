// Legajo digital — checklist, constancias y cambios de datos (lib/legajo-digital-reglas.ts).
import { describe, it, expect } from "vitest";
import {
  contenidoFicha, contenidoDdjjDomicilio, contenidoNotifVacaciones, hashContenido, domicilioCompleto,
  armarCambios, validarTalles, estadoDocumento, estadoConstancia, resumenChecklist, esTipoDocumento,
} from "../lib/legajo-digital-reglas.ts";
import { mimeReal, bufferDesdeBase64 } from "../lib/almacen-documentos.ts";

const legajo = {
  numeroLegajo: 4, apellido: "Retamar", nombre: "Julián", cuil: "20171871817", fechaIngreso: new Date("2020-04-12"),
  tipoDocumento: "DNI", numeroDocumento: "17187181", fechaNacimiento: new Date("1965-03-02"), sexo: "M", estadoCivil: "Casado/a",
  nivelEducativo: "Secundario", tituloObtenido: null,
  domicilio: "Av. Siempre Viva 742", localidad: "Benavídez", partido: "Tigre", provincia: "Buenos Aires", telefono: "1144445555", email: null,
  talleRopa: "L", talleCalzado: "42", categoriaId: "x",
};

describe("Constancias: la firma vale mientras no cambie lo firmado", () => {
  it("la misma ficha da siempre la misma huella", () => {
    expect(hashContenido(contenidoFicha(legajo, "Moras SA"))).toBe(hashContenido(contenidoFicha({ ...legajo }, "Moras SA")));
    expect(hashContenido(contenidoFicha(legajo, "Moras SA"))).toMatch(/^[0-9a-f]{64}$/);
  });

  it("cambiar un dato personal invalida la ficha", () => {
    const h = hashContenido(contenidoFicha(legajo, "Moras SA"));
    expect(hashContenido(contenidoFicha({ ...legajo, telefono: "1100000000" }, "Moras SA"))).not.toBe(h);
    expect(hashContenido(contenidoFicha({ ...legajo, estadoCivil: "Divorciado/a" }, "Moras SA"))).not.toBe(h);
  });

  it("talles y categoría NO invalidan la ficha (cambian seguido y no son parte de lo firmado)", () => {
    const h = hashContenido(contenidoFicha(legajo, "Moras SA"));
    expect(hashContenido(contenidoFicha({ ...legajo, talleRopa: "XL", talleCalzado: "43", categoriaId: "otra" }, "Moras SA"))).toBe(h);
  });

  it("la DD.JJ. depende solo del domicilio, no del teléfono", () => {
    const h = hashContenido(contenidoDdjjDomicilio(legajo, "Moras SA"));
    expect(hashContenido(contenidoDdjjDomicilio({ ...legajo, telefono: "1100000000" }, "Moras SA"))).toBe(h);
    expect(hashContenido(contenidoDdjjDomicilio({ ...legajo, domicilio: "Otra calle 1" }, "Moras SA"))).not.toBe(h);
  });

  it("sin domicilio completo no hay DD.JJ. para firmar", () => {
    expect(domicilioCompleto(legajo)).toBe(true);
    expect(domicilioCompleto({ ...legajo, localidad: "  " })).toBe(false);
    expect(domicilioCompleto({ ...legajo, domicilio: null })).toBe(false);
  });

  it("si RR.HH. corrige las fechas de una vacación, la notificación firmada deja de valer", () => {
    const v = { anioCorresponde: 2026, diasCorresponden: 7, fechaDesde: new Date("2026-11-02"), fechaHasta: new Date("2026-11-08") };
    const h = hashContenido(contenidoNotifVacaciones(legajo, "Moras SA", v));
    expect(hashContenido(contenidoNotifVacaciones(legajo, "Moras SA", { ...v, fechaHasta: new Date("2026-11-15"), diasCorresponden: 14 }))).not.toBe(h);
  });

  it("estado: nunca firmada / vigente / desactualizada", () => {
    expect(estadoConstancia("a", [])).toBe("para_firmar");
    expect(estadoConstancia("a", [{ hashContenido: "viejo" }, { hashContenido: "a" }])).toBe("completo");
    expect(estadoConstancia("a", [{ hashContenido: "viejo" }])).toBe("desactualizado");
  });
});

describe("Documentos subidos", () => {
  it("solo cuenta como completo lo ACEPTADO — lo que subió el empleado espera revisión", () => {
    expect(estadoDocumento("dni", [{ tipo: "dni", estado: "pendiente" }])).toMatchObject({ estado: "en_revision", leToca: "rrhh" });
    expect(estadoDocumento("dni", [{ tipo: "dni", estado: "aceptado" }])).toMatchObject({ estado: "completo", leToca: null });
    expect(estadoDocumento("dni", [{ tipo: "cuil", estado: "aceptado" }])).toMatchObject({ estado: "falta", leToca: "empleado" });
  });

  it("rechazado vuelve al empleado con el motivo; si después sube otro, pasa a revisión", () => {
    const rech = { tipo: "dni", estado: "rechazado", motivoRechazo: "Foto cortada" };
    expect(estadoDocumento("dni", [rech])).toEqual({ estado: "rechazado", detalle: "Foto cortada", leToca: "empleado" });
    expect(estadoDocumento("dni", [rech, { tipo: "dni", estado: "pendiente" }]).estado).toBe("en_revision");
  });

  it("el alta temprana le toca a RR.HH.; los certificados son opcionales", () => {
    expect(estadoDocumento("alta_temprana", [])).toMatchObject({ estado: "falta", leToca: "rrhh" });
    expect(estadoDocumento("cert_estudios", [])).toMatchObject({ estado: "opcional", leToca: null });
    expect(estadoDocumento("cert_medico", [])).toMatchObject({ estado: "opcional", leToca: null });
  });

  it("lo opcional no cuenta para 'legajo completo'", () => {
    const items = [
      { clave: "dni", nombre: "", estado: "completo", leToca: null, requerido: true },
      { clave: "cert", nombre: "", estado: "opcional", leToca: null, requerido: false },
    ];
    expect(resumenChecklist(items)).toMatchObject({ completos: 1, total: 1, completo: true });
    items.push({ clave: "cuil", nombre: "", estado: "falta", leToca: "empleado", requerido: true });
    expect(resumenChecklist(items)).toMatchObject({ completos: 1, total: 2, completo: false, pendientesEmpleado: 1, pendientesRrhh: 0 });
  });

  it("reconoce el archivo por sus primeros bytes, no por lo que diga el navegador", () => {
    expect(mimeReal(Buffer.from("%PDF-1.7 ..."))).toBe("application/pdf");
    expect(mimeReal(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]))).toBe("image/jpeg");
    expect(mimeReal(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]))).toBe("image/png");
    expect(mimeReal(Buffer.from("<html><script>alert(1)</script>"))).toBeNull(); // un HTML disfrazado de foto
    expect(mimeReal(Buffer.from("MZ\x90\x00"))).toBeNull(); // un .exe
    expect(bufferDesdeBase64("data:image/png;base64,iVBORw0KGgo=")?.length).toBe(8);
    expect(bufferDesdeBase64("")).toBeNull();
    expect(bufferDesdeBase64(null)).toBeNull();
  });

  it("no acepta tipos inventados", () => {
    expect(esTipoDocumento("dni")).toBe(true);
    expect(esTipoDocumento("sancion")).toBe(false);
    expect(esTipoDocumento("constructor")).toBe(false);
    expect(esTipoDocumento(null)).toBe(false);
  });
});

describe("Cambio de datos pedido por el empleado", () => {
  it("se queda solo con lo que cambió de verdad, con el antes y el después", () => {
    const { cambios, error } = armarCambios(legajo, { domicilio: "Calle Nueva 123", localidad: "Benavídez", telefono: " 1144445555 " });
    expect(error).toBeNull();
    expect(cambios).toEqual({ domicilio: { antes: "Av. Siempre Viva 742", despues: "Calle Nueva 123" } });
  });

  it("ignora cualquier campo que no sea de la lista permitida", () => {
    const { cambios } = armarCambios(legajo, { telefono: "1199998888", categoriaId: "gerente", cbu: "000", cuil: "1", condicion: "baja", fechaIngreso: "1990-01-01" });
    expect(Object.keys(cambios)).toEqual(["telefono"]);
  });

  it("rechaza lo inválido", () => {
    expect(armarCambios(legajo, {}).error).toMatch(/No cambiaste/);
    expect(armarCambios(legajo, { domicilio: legajo.domicilio }).error).toMatch(/No cambiaste/);
    expect(armarCambios(legajo, { email: "no-es-un-mail" }).error).toMatch(/email/);
    expect(armarCambios(legajo, { estadoCivil: "Complicado" }).error).toMatch(/opciones/);
    expect(armarCambios(legajo, { domicilio: "" }).error).toMatch(/vacío/);
    expect(armarCambios(legajo, { domicilio: "x".repeat(200) }).error).toMatch(/largo/);
  });

  it("teléfono y email sí se pueden borrar", () => {
    expect(armarCambios(legajo, { telefono: "" }).cambios).toEqual({ telefono: { antes: "1144445555", despues: "" } });
  });
});

describe("Talles", () => {
  it("acepta talles reales y rechaza el resto", () => {
    expect(validarTalles("L", "42")).toBeNull();
    expect(validarTalles("XXL", "39.5")).toBeNull();
    for (const [r, c] of [["", "42"], ["XXXL", "42"], ["L", ""], ["L", "4"], ["L", "99"], ["L", "cuarenta"], ["L", "42.3"]]) expect(validarTalles(r, c), `${r}/${c}`).not.toBeNull();
  });
});
