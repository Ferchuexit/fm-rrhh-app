// FM RRHH — motor-auditoria.mjs
// Corre DESPUÉS del motor de reglas (motor-reglas.mjs) y ANTES de que un período
// pueda pasar de "validada" a "cerrada". No liquida nada — audita lo ya liquidado.
//
// Cada regla es una función independiente: (contexto) => Alerta[]. Agregar una
// regla nueva es agregar una función a REGLAS, no tocar las demás. Igual que el
// motor de reglas, esto es deliberado: la lista de chequeos va a crecer con el uso
// real del sistema y no debería requerir tocar código existente para hacerlo.
import { extraerVariablesBase } from "./motor-reglas.mjs";

// ────────────────────────────────────────────────────────────
// Validación de CUIL (algoritmo real de dígito verificador — mod 11)
// ────────────────────────────────────────────────────────────

function cuilValido(cuil) {
  if (typeof cuil !== "string" || !/^\d{11}$/.test(cuil)) return false;
  const d = cuil.split("").map(Number);
  const coef = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const suma = d.slice(0, 10).reduce((acc, dig, i) => acc + dig * coef[i], 0);
  let verificador = 11 - (suma % 11);
  if (verificador === 11) verificador = 0;
  if (verificador === 10) return false; // caso especial no autoasignable, se trata como inválido
  return verificador === d[10];
}

// ────────────────────────────────────────────────────────────
// Reglas de auditoría — cada una devuelve una Alerta por legajo afectado
// ────────────────────────────────────────────────────────────

function reglaBajoEscala({ liquidaciones, legajos, escalas }) {  const alertas = [];
  for (const liq of liquidaciones) {
    const legajo = legajos.find((l) => l.id === liq.legajoId);
    const escala = escalas.find((e) => e.categoriaId === legajo.categoriaId);
    if (escala && liq.bruto < escala.basico) {
      alertas.push({
        severidad: "rojo",
        tipo: "bajo_escala",
        legajoId: legajo.id,
        mensaje: `${legajo.apellido}, ${legajo.nombre} (legajo ${legajo.numero}): remuneración bruta $${liq.bruto.toLocaleString("es-AR")} inferior al básico de escala $${escala.basico.toLocaleString("es-AR")}`,
      });
    }
  }
  return alertas;
}

function reglaVariacionMesAnterior({ liquidaciones, legajos, liquidacionesMesAnterior }, umbralPct = 30) {
  const alertas = [];
  for (const liq of liquidaciones) {
    const anterior = liquidacionesMesAnterior.find((l) => l.legajoId === liq.legajoId);
    if (!anterior || anterior.bruto === 0) continue;
    const variacion = ((liq.bruto - anterior.bruto) / anterior.bruto) * 100;
    if (Math.abs(variacion) > umbralPct) {
      const legajo = legajos.find((l) => l.id === liq.legajoId);
      alertas.push({
        severidad: "amarillo",
        tipo: "variacion_mes_anterior",
        legajoId: legajo.id,
        mensaje: `${legajo.apellido}, ${legajo.nombre} (legajo ${legajo.numero}): variación de ${variacion > 0 ? "+" : ""}${variacion.toFixed(1)}% respecto del mes anterior`,
      });
    }
  }
  return alertas;
}

function reglaSinObraSocial({ legajos }) {
  return legajos
    .filter((l) => l.condicion === "activo" && !l.obraSocialId)
    .map((l) => ({
      severidad: "rojo",
      tipo: "sin_obra_social",
      legajoId: l.id,
      mensaje: `${l.apellido}, ${l.nombre} (legajo ${l.numero}): sin obra social cargada`,
    }));
}

function reglaSinNovedades({ legajos, formulaBasicoPorConvenio = {}, legajosConHorasCargadas = [] }) {
  const legajosConHoras = new Set(legajosConHorasCargadas);
  return legajos
    .filter((l) => {
      if (l.condicion !== "activo") return false;
      const formula = formulaBasicoPorConvenio[l.convenioId];
      const dependeDeHoras = formula ? extraerVariablesBase(formula).includes("HORAS_TRABAJADAS") : false;

      if (dependeDeHoras) {
        // Lo que importa acá es específicamente la novedad de horas —
        // tener otra novedad (un adelanto, un premio) no alcanza para
        // saber cuánto trabajó de verdad.
        return !legajosConHoras.has(l.id);
      }
      // Básico fijo (no depende de horas) — cualquier novedad alcanza para
      // no avisar; si no tiene ninguna, es lo esperado (jornada normal sin
      // novedades) y tampoco hace falta avisar.
      return false;
    })
    .map((l) => ({
      severidad: "amarillo",
      tipo: "sin_novedades",
      legajoId: l.id,
      mensaje: `${l.apellido}, ${l.nombre} (legajo ${l.numero}): sin novedad de horas cargada — se está asumiendo jornada completa`,
    }));
}

function reglaNovedadesFueraDeTermino({ novedades, periodo }) {
  if (!periodo.fechaTopeCarga) return [];
  const tope = new Date(periodo.fechaTopeCarga);
  const tardias = novedades.filter((n) => new Date(n.createdAt) > tope);
  if (tardias.length === 0) return [];
  return [
    {
      severidad: "amarillo",
      tipo: "novedades_fuera_de_termino",
      legajoId: null,
      mensaje: `${tardias.length} novedad(es) cargadas después de la fecha tope (${periodo.fechaTopeCarga})`,
      cantidadAgrupada: tardias.length,
    },
  ];
}

function reglaDeduccionesAnormales({ liquidaciones, legajos }, umbralPct = 50) {
  const alertas = [];
  for (const liq of liquidaciones) {
    if (liq.bruto === 0) continue;
    const descuentos = liq.bruto - liq.neto;
    const pct = (descuentos / liq.bruto) * 100;
    if (pct > umbralPct) {
      const legajo = legajos.find((l) => l.id === liq.legajoId);
      alertas.push({
        severidad: "rojo",
        tipo: "deducciones_anormales",
        legajoId: legajo.id,
        mensaje: `${legajo.apellido}, ${legajo.nombre} (legajo ${legajo.numero}): deducciones equivalen al ${pct.toFixed(1)}% del bruto`,
      });
    }
  }
  return alertas;
}

function reglaCuilInvalido({ legajos }) {
  return legajos
    .filter((l) => !cuilValido(l.cuil))
    .map((l) => ({
      severidad: "rojo",
      tipo: "cuil_invalido",
      legajoId: l.id,
      mensaje: `${l.apellido}, ${l.nombre} (legajo ${l.numero}): CUIL "${l.cuil}" no pasa la validación de dígito verificador`,
    }));
}

function reglaDatosFaltantesArca({ legajos }) {
  const alertas = [];
  for (const l of legajos) {
    if (l.condicion !== "activo") continue;
    const faltantes = [];
    if (!l.cbu) faltantes.push("CBU");
    if (!l.bancoId) faltantes.push("banco");
    if (!l.obraSocialId) faltantes.push("obra social");
    if (faltantes.length > 0) {
      alertas.push({
        severidad: "rojo",
        tipo: "datos_faltantes_arca",
        legajoId: l.id,
        mensaje: `${l.apellido}, ${l.nombre} (legajo ${l.numero}): faltan datos requeridos para LSD/F.931 (${faltantes.join(", ")})`,
      });
    }
  }
  return alertas;
}

// Pedido explícito: no se puede cerrar (y por lo tanto no se puede
// exportar LSD/F.931) si queda algún legajo activo sin liquidar en el
// período — evita presentar un F.931 con gente afuera por descuido.
function reglaLegajosSinLiquidar({ liquidaciones, legajos }) {
  const legajosConLiquidacion = new Set(liquidaciones.map((l) => l.legajoId));
  return legajos
    .filter((l) => l.condicion === "activo" && !legajosConLiquidacion.has(l.id))
    .map((l) => ({
      severidad: "rojo",
      tipo: "sin_liquidar",
      legajoId: l.id,
      mensaje: `${l.apellido}, ${l.nombre} (legajo ${l.numero}): todavía no está liquidado en este período`,
    }));
}

const REGLAS = [
  reglaBajoEscala,
  reglaVariacionMesAnterior,
  reglaSinObraSocial,
  reglaSinNovedades,
  reglaNovedadesFueraDeTermino,
  reglaDeduccionesAnormales,
  reglaCuilInvalido,
  reglaDatosFaltantesArca,
  reglaLegajosSinLiquidar,
];

// Etiqueta cada regla como 'pre' (no necesita liquidaciones calculadas —
// se puede correr ANTES de liquidar) o 'post' (necesita el resultado real
// del cálculo). Agregado para distinguir auditoría de Preliquidación de
// Post-liquidación (documento de mejora, Prioridad 6) — ninguna regla
// existente cambió su lógica, solo se las clasificó.
reglaBajoEscala.momento = "post";
reglaVariacionMesAnterior.momento = "post";
reglaSinObraSocial.momento = "pre";
reglaSinNovedades.momento = "pre";
reglaNovedadesFueraDeTermino.momento = "pre";
reglaDeduccionesAnormales.momento = "post";
reglaCuilInvalido.momento = "pre";
reglaDatosFaltantesArca.momento = "pre";
reglaLegajosSinLiquidar.momento = "post";

// ────────────────────────────────────────────────────────────
// Orquestador: corre todas las reglas y arma el resumen agrupado
// ────────────────────────────────────────────────────────────

function auditarPeriodo(contexto, { momento = "post" } = {}) {
  // Por defecto ("post") corren TODAS las reglas — comportamiento
  // idéntico al de siempre, ningún llamador existente tiene que cambiar.
  // Con momento="pre" (antes de liquidar) solo corren las reglas que no
  // necesitan `liquidaciones` — ver el etiquetado arriba de REGLAS.
  const reglasAEjecutar = momento === "pre" ? REGLAS.filter((r) => r.momento === "pre") : REGLAS;
  const alertas = reglasAEjecutar.flatMap((regla) => regla(contexto));

  // Agrupar por tipo para el resumen tipo "🔴 3 empleados tienen..."
  const grupos = new Map();
  for (const a of alertas) {
    if (!grupos.has(a.tipo)) grupos.set(a.tipo, { severidad: a.severidad, tipo: a.tipo, alertas: [] });
    grupos.get(a.tipo).alertas.push(a);
  }

  const MENSAJE_RESUMEN = {
    bajo_escala: (n) => `${n} empleado${n > 1 ? "s" : ""} ${n > 1 ? "tienen" : "tiene"} una remuneración inferior a la escala vigente`,
    variacion_mes_anterior: (n) => `${n} empleado${n > 1 ? "s" : ""} ${n > 1 ? "presentan" : "presenta"} una variación superior al 30% respecto del mes anterior`,
    sin_obra_social: (n) => `${n} empleado${n > 1 ? "s" : ""} no ${n > 1 ? "tienen" : "tiene"} obra social cargada`,
    sin_novedades: (n) => `${n} empleado${n > 1 ? "s" : ""} de convenios liquidados por hora, sin la novedad de horas reales cargada`,
    novedades_fuera_de_termino: (n) => `${n} novedad${n > 1 ? "es fueron" : " fue"} cargada${n > 1 ? "s" : ""} después de la fecha tope`,
    deducciones_anormales: (n) => `${n} empleado${n > 1 ? "s" : ""} con deducciones anormalmente altas`,
    cuil_invalido: (n) => `${n} empleado${n > 1 ? "s" : ""} con CUIL inválido`,
    datos_faltantes_arca: (n) => `${n} empleado${n > 1 ? "s" : ""} con datos faltantes para LSD/F.931`,
    sin_liquidar: (n) => `${n} legajo${n > 1 ? "s" : ""} activo${n > 1 ? "s" : ""} sin liquidar todavía en este período`,
  };

  const resumen = [...grupos.values()].map((g) => ({
    severidad: g.severidad,
    tipo: g.tipo,
    cantidad: g.alertas.length,
    mensaje: (MENSAJE_RESUMEN[g.tipo] ?? (() => `${g.alertas.length} alertas de ${g.tipo}`))(g.alertas.length),
    detalle: g.alertas,
  }));

  const hayRojo = resumen.some((r) => r.severidad === "rojo");
  const hayAmarillo = resumen.some((r) => r.severidad === "amarillo");
  const estadoGeneral = hayRojo ? "rojo" : hayAmarillo ? "amarillo" : "verde";
  const puedeCerrar = !hayRojo;

  return {
    resumen,
    estadoGeneral,
    puedeCerrar,
    mensajeGeneral:
      estadoGeneral === "verde"
        ? "Liquidación validada: sin inconsistencias críticas"
        : hayRojo
        ? "Liquidación con inconsistencias críticas — no se puede cerrar hasta resolverlas"
        : "Liquidación con observaciones — se puede cerrar, pero conviene revisarlas",
  };
}

export { cuilValido, auditarPeriodo, REGLAS };
