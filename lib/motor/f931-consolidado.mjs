// FM RRHH — f931-consolidado.mjs
//
// A diferencia de lsd-v1.mjs, ESTO NO ES UN FORMATO DE ARCHIVO PLANO DE ARCA.
// Es deliberado: revisando 'Liquidacion_Sueldos_Multiconvenio_v9.xlsx', hoja
// 6.1_F931, se confirmó que no hay ninguna fórmula que genere un TXT de ancho
// fijo para F.931 — esa hoja arma la tabla consolidada por CUIL (remuneraciones,
// aportes, contribuciones) que después se transcribe o carga en el portal
// "Declaración en Línea" de ARCA. No existe una spec de archivo verificable acá
// para replicar, así que este módulo replica lo que el Excel SÍ hace: producir
// el consolidado, no inventar un layout de presentación.
//
// Las columnas son las mismas que las de 6.1_F931 (fila 12 del Excel original).

const COLUMNAS = [
  "legajo", "cuil", "apellidoNombre", "categoria",
  "remQuincenalMadera", "remMensualComercio", "remVacaciones", "remFinales",
  "remTotal", "noRemunerativo", "remSujetaAportesTopeada",
  "aporteJubilacion11", "aporteLey19032_3", "aporteObraSocial3",
  "contribPatronalSipa", "contribPatronalObraSocial6", "art", "contribSeguroVida", "cuotaSindical",
];

const NOMBRE_COLUMNA = {
  legajo: "Legajo", cuil: "CUIL", apellidoNombre: "Apellido y Nombre", categoria: "Categoría",
  remQuincenalMadera: "Rem. Quinc. Madera", remMensualComercio: "Rem. Mensual Comercio",
  remVacaciones: "Rem. Vacaciones", remFinales: "Rem. Finales", remTotal: "Rem. Total (remun.)",
  noRemunerativo: "No Remunerativo", remSujetaAportesTopeada: "Rem. Sujeta a Aportes (informativo, ver nota)",
  aporteJubilacion11: "Aporte Jubilación", aporteLey19032_3: "Aporte Ley 19032",
  aporteObraSocial3: "Aporte O.Social", contribPatronalSipa: "Contrib. Patr. SIPA/INSSJP/FNE/AAFF",
  contribPatronalObraSocial6: "Contrib. Patr. Obra Social", art: "ART", contribSeguroVida: "Contrib. Seguro Vida (Madera)",
  cuotaSindical: "Cuota Sindical",
};

/**
 * Consolida remuneraciones de varias fuentes (quincenal, mensual, vacaciones,
 * liquidación final) por CUIL — igual que hace J13 = F13+G13+H13+I13 en el Excel.
 *
 * A DIFERENCIA de la versión anterior, esta función NO recalcula aportes ni
 * contribuciones aplicando tasas propias — los recibe YA CALCULADOS por el
 * motor de liquidación (montosPorCuil), leídos de LiquidacionDetalle. Esto es
 * deliberado: el F.931 tiene que declarar EXACTAMENTE lo que se liquidó y se
 * le retuvo a cada empleado, no una reconstrucción independiente que podría
 * no coincidir centavo a centavo con el recibo real (ver 22-seed-completo-y-f931-real.md
 * y la nota arquitectónica de Fernando sobre este punto).
 *
 * @param {Array} legajos - [{ legajo, cuil, apellidoNombre, categoria }]
 * @param {Array} remuneracionesPorFuente - [{ cuil, fuente: 'quincenalMadera'|'mensualComercio'|'vacaciones'|'finales', importe }]
 * @param {Array} noRemunerativoPorCuil - [{ cuil, importe }]
 * @param {Map<string, object>} montosPorCuil - por CUIL: { aporteJubilacion11, aporteLey19032_3,
 *   aporteObraSocial3, contribPatronalSipa, contribPatronalObraSocial6, art, contribSeguroVida,
 *   cuotaSindical } — TODOS estos montos vienen de sumar LiquidacionDetalle por concepto, no de
 *   aplicar un porcentaje acá.
 * @param {number} topeBaseImponible - solo para la columna informativa remSujetaAportesTopeada.
 */
function consolidarF931(legajos, remuneracionesPorFuente, noRemunerativoPorCuil, montosPorCuil, topeBaseImponible) {
  const porCuil = new Map(legajos.map((l) => [l.cuil, { ...l, fuentes: {} }]));

  for (const r of remuneracionesPorFuente) {
    const reg = porCuil.get(r.cuil);
    if (!reg) continue;
    reg.fuentes[r.fuente] = (reg.fuentes[r.fuente] ?? 0) + r.importe;
  }
  const noRemPorCuil = new Map(noRemunerativoPorCuil.map((n) => [n.cuil, n.importe]));

  const filas = [];
  for (const [cuil, reg] of porCuil) {
    const remQuincenalMadera = reg.fuentes.quincenalMadera ?? 0;
    const remMensualComercio = reg.fuentes.mensualComercio ?? 0;
    const remVacaciones = reg.fuentes.vacaciones ?? 0;
    const remFinales = reg.fuentes.finales ?? 0;
    const remTotal = remQuincenalMadera + remMensualComercio + remVacaciones + remFinales;
    const noRemunerativo = noRemPorCuil.get(cuil) ?? 0;
    const remSujetaAportesTopeada = Math.min(remTotal, topeBaseImponible);

    const montos = montosPorCuil.get(cuil) ?? {};

    filas.push({
      legajo: reg.legajo, cuil, apellidoNombre: reg.apellidoNombre, categoria: reg.categoria,
      remQuincenalMadera, remMensualComercio, remVacaciones, remFinales, remTotal, noRemunerativo,
      remSujetaAportesTopeada,
      aporteJubilacion11: round2(montos.aporteJubilacion11 ?? 0),
      aporteLey19032_3: round2(montos.aporteLey19032_3 ?? 0),
      aporteObraSocial3: round2(montos.aporteObraSocial3 ?? 0),
      contribPatronalSipa: round2(montos.contribPatronalSipa ?? 0),
      contribPatronalObraSocial6: round2(montos.contribPatronalObraSocial6 ?? 0),
      art: round2(montos.art ?? 0),
      contribSeguroVida: round2(montos.contribSeguroVida ?? 0),
      cuotaSindical: round2(montos.cuotaSindical ?? 0),
    });
  }

  return filas;
}

function round2(v) {
  return Math.round(v * 100) / 100;
}

function aCSV(filas) {
  const encabezado = COLUMNAS.map((c) => NOMBRE_COLUMNA[c]).join(";");
  const lineas = filas.map((f) =>
    COLUMNAS.map((c) => {
      if (c === "legajo") return String(f[c]);
      return typeof f[c] === "number" ? f[c].toFixed(2).replace(".", ",") : f[c];
    }).join(";")
  );
  return [encabezado, ...lineas].join("\r\n");
}

export { consolidarF931, aCSV, COLUMNAS, NOMBRE_COLUMNA };
