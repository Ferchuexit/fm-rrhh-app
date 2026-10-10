// Horarios de trabajo: rotaciones, turnos noche y su efecto en asistencia (lib/turnos-reglas.ts, lib/asistencia-jornada.ts).
import { describe, it, expect } from "vitest";
import * as T from "../lib/turnos-reglas.ts";
import { clasificarJornada } from "../lib/asistencia-jornada.ts";

const f = (t) => new Date(t + "T00:00:00Z");
const LaV = (ingreso, salida) => Object.fromEntries([1, 2, 3, 4, 5].map((d) => [String(d), { ingreso, salida }]));
const maniana = { id: "m", nombre: "Mañana", color: "#000", dias: LaV("06:00", "14:00") };
const tarde = { id: "t", nombre: "Tarde", color: "#000", dias: LaV("14:00", "22:00") };
const noche = { id: "n", nombre: "Noche", color: "#000", dias: LaV("22:00", "06:00") };
const horarios = new Map([maniana, tarde, noche].map((h) => [h.id, h]));
// 2026-11-02 es lunes.
const fijo = (id, desde = "2026-11-02") => [{ desde: f(desde), hasta: null, horarioIds: [id] }];

describe("Carga de un horario", () => {
  it("acepta días válidos y descarta los vacíos", () => {
    const r = T.limpiarDias({ 1: { ingreso: "06:00", salida: "14:00" }, 2: null, 6: { ingreso: "06:00", salida: "10:00" }, 9: { ingreso: "06:00", salida: "10:00" } });
    expect(r.error).toBeNull();
    expect(Object.keys(r.dias)).toEqual(["1", "6"]);
  });
  it("rechaza horas mal escritas, iguales, o ningún día", () => {
    expect(T.limpiarDias({ 1: { ingreso: "6", salida: "14:00" } }).error).toMatch(/lunes/);
    expect(T.limpiarDias({ 3: { ingreso: "25:00", salida: "14:00" } }).error).toMatch(/miércoles/);
    expect(T.limpiarDias({ 1: { ingreso: "08:00", salida: "08:00" } }).error).toMatch(/misma hora/);
    expect(T.limpiarDias({}).error).toMatch(/al menos un día/);
    expect(T.limpiarDias(null).error).toMatch(/al menos un día/);
  });
  it("reconoce el turno que termina al día siguiente y cuenta bien las horas", () => {
    expect(T.esNocturno({ ingreso: "22:00", salida: "06:00" })).toBe(true);
    expect(T.esNocturno({ ingreso: "06:00", salida: "14:00" })).toBe(false);
    expect(T.horasDelDia({ ingreso: "22:00", salida: "06:00" })).toBe(8);
    expect(T.horasDelDia({ ingreso: "07:00", salida: "17:00" })).toBe(10);
  });
  it("lo resume en una línea", () => {
    expect(T.resumenHorario(maniana.dias)).toBe("Lun a Vie 06:00–14:00");
    expect(T.resumenHorario({ ...maniana.dias, 6: { ingreso: "06:00", salida: "10:00" } })).toBe("Lun a Vie 06:00–14:00 · Sáb 06:00–10:00");
    expect(T.resumenHorario({ 6: { ingreso: "08:00", salida: "12:00" }, 0: { ingreso: "08:00", salida: "12:00" } })).toBe("Sáb a Dom 08:00–12:00");
    expect(T.resumenHorario({ 1: { ingreso: "08:00", salida: "12:00" }, 3: { ingreso: "08:00", salida: "12:00" } })).toBe("Lun 08:00–12:00 · Mié 08:00–12:00");
  });
});

describe("Qué le toca a cada uno cada día", () => {
  it("el lunes de cada semana", () => {
    expect(T.lunesDe(f("2026-11-02"))).toEqual(f("2026-11-02"));
    expect(T.lunesDe(f("2026-11-08"))).toEqual(f("2026-11-02")); // domingo
    expect(T.lunesDe(f("2026-11-09"))).toEqual(f("2026-11-09"));
  });
  it("horario fijo: trabaja de lunes a viernes, franco el fin de semana", () => {
    expect(T.jornadaDelDia(f("2026-11-04"), fijo("m"), horarios)).toMatchObject({ tipo: "trabaja", ingreso: "06:00", salida: "14:00", nocturno: false });
    expect(T.jornadaDelDia(f("2026-11-07"), fijo("m"), horarios).tipo).toBe("franco");
  });
  it("antes de la fecha de inicio, o sin asignación, no tiene horario", () => {
    expect(T.jornadaDelDia(f("2026-10-30"), fijo("m"), horarios).tipo).toBe("sin_asignar");
    expect(T.jornadaDelDia(f("2026-11-04"), [], horarios).tipo).toBe("sin_asignar");
    expect(T.jornadaDelDia(f("2026-11-04"), fijo("borrado"), horarios).tipo).toBe("sin_asignar");
  });
  it("rotación: cambia cada lunes y vuelve a empezar", () => {
    const rot = [{ desde: f("2026-11-02"), hasta: null, horarioIds: ["m", "t", "n"] }];
    const nombre = (fecha) => T.jornadaDelDia(f(fecha), rot, horarios).horario.nombre;
    expect(nombre("2026-11-02")).toBe("Mañana");
    expect(nombre("2026-11-06")).toBe("Mañana");
    expect(nombre("2026-11-09")).toBe("Tarde");
    expect(nombre("2026-11-16")).toBe("Noche");
    expect(nombre("2026-11-23")).toBe("Mañana");
  });
  it("una rotación que arranca un miércoles cambia igual el lunes", () => {
    const rot = [{ desde: f("2026-11-04"), hasta: null, horarioIds: ["m", "t"] }];
    expect(T.jornadaDelDia(f("2026-11-06"), rot, horarios).horario.nombre).toBe("Mañana");
    expect(T.jornadaDelDia(f("2026-11-09"), rot, horarios).horario.nombre).toBe("Tarde");
  });
  it("al cambiar de horario, el anterior sigue valiendo para las fechas viejas", () => {
    const historia = [{ desde: f("2026-11-02"), hasta: f("2026-11-15"), horarioIds: ["m"] }, { desde: f("2026-11-16"), hasta: null, horarioIds: ["t"] }];
    expect(T.jornadaDelDia(f("2026-11-10"), historia, horarios).horario.nombre).toBe("Mañana");
    expect(T.jornadaDelDia(f("2026-11-16"), historia, horarios).horario.nombre).toBe("Tarde");
  });
});

describe("Asistencia con el horario asignado", () => {
  const legajo = (asignaciones) => ({ id: "L", convenioId: "c", fichadaObligatoria: true, asignaciones });
  const con = (porFecha) => (fecha) => porFecha[fecha.toISOString().slice(0, 10)] ?? [];
  const clasificar = (fecha, asignaciones, fichadas, respaldo = []) => clasificarJornada(f(fecha), legajo(asignaciones), horarios, respaldo, con(fichadas));

  it("turno de día: presente, tarde, ausente", () => {
    expect(clasificar("2026-11-04", fijo("m"), { "2026-11-04": ["05:55:00", "14:02:00"] })).toMatchObject({ estado: "P", minutosTarde: 0 });
    expect(clasificar("2026-11-04", fijo("m"), { "2026-11-04": ["06:20:00", "14:02:00"] })).toMatchObject({ estado: "T", minutosTarde: 20 });
    expect(clasificar("2026-11-04", fijo("m"), {}).estado).toBe("A");
  });

  it("turno noche: junta la entrada de un día con la salida del siguiente", () => {
    const fichadas = { "2026-11-04": ["21:58:00"], "2026-11-05": ["06:03:00", "21:55:00"], "2026-11-06": ["06:01:00"] };
    expect(clasificar("2026-11-04", fijo("n"), fichadas)).toMatchObject({ estado: "P", horaIngresoReal: "21:58:00", horaEgresoReal: "06:03:00", minutosTarde: 0, minutosSalidaAnticipada: 0 });
    // el jueves no "hereda" la salida de las 06:03 como si fuera una entrada
    expect(clasificar("2026-11-05", fijo("n"), fichadas)).toMatchObject({ estado: "P", horaIngresoReal: "21:55:00", horaEgresoReal: "06:01:00" });
  });
  it("turno noche: llegó tarde, o se fue antes", () => {
    expect(clasificar("2026-11-04", fijo("n"), { "2026-11-04": ["22:25:00"], "2026-11-05": ["06:00:00"] })).toMatchObject({ estado: "T", minutosTarde: 25 });
    expect(clasificar("2026-11-04", fijo("n"), { "2026-11-04": ["22:00:00"], "2026-11-05": ["05:30:00"] })).toMatchObject({ estado: "SA", minutosSalidaAnticipada: 30, horaEgresoReal: "05:30:00" });
    expect(clasificar("2026-11-04", fijo("n"), { "2026-11-04": ["22:00:00"] }).estado).toBe("IMPAR"); // no marcó la salida
    expect(clasificar("2026-11-04", fijo("n"), {}).estado).toBe("A");
  });
  it("el sábado después del último turno noche es franco, no un día trabajado", () => {
    const fichadas = { "2026-11-06": ["22:00:00"], "2026-11-07": ["06:02:00"] };
    expect(clasificar("2026-11-06", fijo("n"), fichadas).estado).toBe("P");
    expect(clasificar("2026-11-07", fijo("n"), fichadas).estado).toBe("FRANCO");
  });
  it("franco por horario en día de semana: no es ausencia ni 'sin turno'", () => {
    const martesFranco = { id: "x", nombre: "Mié a Dom", color: "#000", dias: Object.fromEntries([3, 4, 5, 6, 0].map((d) => [String(d), { ingreso: "08:00", salida: "16:00" }])) };
    const hs = new Map([[martesFranco.id, martesFranco]]);
    const r = clasificarJornada(f("2026-11-03"), legajo(fijo("x")), hs, [], () => []);
    expect(r.estado).toBe("FRANCO");
  });
  it("quien no tiene horario asignado sigue con el turno de respaldo, como antes", () => {
    const respaldo = [{ legajoId: null, convenioId: "c", diaSemana: 3, horaIngreso: "07:00", horaSalida: "17:00", vigenciaDesde: f("2026-01-01"), vigenciaHasta: null }];
    expect(clasificar("2026-11-04", [], { "2026-11-04": ["07:10:00", "17:00:00"] }, respaldo)).toMatchObject({ estado: "T", minutosTarde: 10 });
    expect(clasificar("2026-11-04", [], { "2026-11-04": ["07:10:00", "17:00:00"] }, []).estado).toBe("SIN_TURNO");
    // y si tiene horario asignado, el de respaldo no cuenta
    expect(clasificar("2026-11-04", fijo("m"), { "2026-11-04": ["06:00:00", "14:00:00"] }, respaldo).estado).toBe("P");
  });
});

describe("Feriados y cambios de un día", () => {
  const exc = (feriados = {}, cambios = {}) => ({ feriados: new Map(Object.entries(feriados)), cambios: new Map(Object.entries(cambios)) });
  const legajo = (asignaciones, excepciones) => ({ id: "L", convenioId: "c", fichadaObligatoria: true, asignaciones, excepciones });
  const con = (porFecha) => (fecha) => porFecha[fecha.toISOString().slice(0, 10)] ?? [];

  it("Pascua y los feriados que dependen de ella", () => {
    expect(T.pascua(2026)).toEqual(f("2026-04-05"));
    expect(T.pascua(2027)).toEqual(f("2027-03-28"));
    expect(T.pascua(2025)).toEqual(f("2025-04-20"));
    const de2026 = T.feriadosInamovibles(2026).map((x) => x.fecha.toISOString().slice(0, 10));
    for (const d of ["2026-01-01", "2026-02-16", "2026-02-17", "2026-03-24", "2026-04-02", "2026-04-03", "2026-05-01", "2026-05-25", "2026-06-20", "2026-07-09", "2026-12-08", "2026-12-25"]) expect(de2026, d).toContain(d);
    expect(de2026).toHaveLength(12);
    expect(de2026).not.toContain("2026-10-12"); // trasladable: se carga a mano
  });

  it("feriado: la jornada lo dice, y recuerda qué le tocaba", () => {
    const j = T.jornadaDelDia(f("2026-11-04"), fijo("m"), horarios, exc({ "2026-11-04": "Día de prueba" }));
    expect(j).toMatchObject({ tipo: "feriado", nombre: "Día de prueba", base: { tipo: "trabaja", ingreso: "06:00" } });
    expect(T.jornadaDelDia(f("2026-11-05"), fijo("m"), horarios, exc({ "2026-11-04": "x" })).tipo).toBe("trabaja");
  });
  it("cambio de un día: franco o en otro horario, y le gana al feriado", () => {
    expect(T.jornadaDelDia(f("2026-11-04"), fijo("m"), horarios, exc({}, { "2026-11-04": { tipo: "franco" } }))).toMatchObject({ tipo: "franco", cambio: true });
    expect(T.jornadaDelDia(f("2026-11-04"), fijo("m"), horarios, exc({}, { "2026-11-04": { tipo: "horario", ingreso: "22:00", salida: "06:00" } }))).toMatchObject({ tipo: "trabaja", ingreso: "22:00", nocturno: true, cambio: true });
    expect(T.jornadaDelDia(f("2026-11-04"), fijo("m"), horarios, exc({ "2026-11-04": "Feriado" }, { "2026-11-04": { tipo: "horario", ingreso: "08:00", salida: "12:00" } }))).toMatchObject({ tipo: "trabaja", ingreso: "08:00" });
    // sábado (franco por horario) que le toca trabajar por un cambio
    expect(T.jornadaDelDia(f("2026-11-07"), fijo("m"), horarios, exc({}, { "2026-11-07": { tipo: "horario", ingreso: "06:00", salida: "12:00" } })).tipo).toBe("trabaja");
    // quien no tiene horario asignado también puede tener un cambio puntual
    expect(T.jornadaDelDia(f("2026-11-04"), [], horarios, exc({}, { "2026-11-04": { tipo: "horario", ingreso: "08:00", salida: "12:00" } })).tipo).toBe("trabaja");
  });
  it("valida el cambio que llega del formulario", () => {
    expect(T.validarCambio("franco")).toBeNull();
    expect(T.validarCambio("horario", "14:00", "22:00")).toBeNull();
    expect(T.validarCambio("horario", "14", "22:00")).toMatch(/dos horas/);
    expect(T.validarCambio("horario", "14:00", "14:00")).toMatch(/misma hora/);
    expect(T.validarCambio("otra")).toMatch(/qué cambia/);
  });

  it("asistencia: feriado sin fichadas es 'F', no ausente", () => {
    const r = clasificarJornada(f("2026-11-04"), legajo(fijo("m"), exc({ "2026-11-04": "Feriado" })), horarios, [], con({}));
    expect(r.estado).toBe("F");
  });
  it("asistencia: si trabajó el feriado, se compara contra su horario", () => {
    const r = clasificarJornada(f("2026-11-04"), legajo(fijo("m"), exc({ "2026-11-04": "Feriado" })), horarios, [], con({ "2026-11-04": ["06:15:00", "14:00:00"] }));
    expect(r).toMatchObject({ estado: "T", minutosTarde: 15 });
  });
  it("asistencia: feriado también para quien usa el turno de respaldo", () => {
    const respaldo = [{ legajoId: null, convenioId: "c", diaSemana: 3, horaIngreso: "07:00", horaSalida: "17:00", vigenciaDesde: f("2026-01-01"), vigenciaHasta: null }];
    expect(clasificarJornada(f("2026-11-04"), legajo([], exc({ "2026-11-04": "Feriado" })), horarios, respaldo, con({})).estado).toBe("F");
  });
  it("asistencia: con un cambio de un día se compara contra el horario del cambio", () => {
    const cubre = exc({}, { "2026-11-04": { tipo: "horario", ingreso: "14:00", salida: "22:00" } });
    expect(clasificarJornada(f("2026-11-04"), legajo(fijo("m"), cubre), horarios, [], con({ "2026-11-04": ["14:00:00", "22:00:00"] })).estado).toBe("P");
    const libre = exc({}, { "2026-11-04": { tipo: "franco" } });
    expect(clasificarJornada(f("2026-11-04"), legajo(fijo("m"), libre), horarios, [], con({})).estado).toBe("FRANCO");
  });
});
