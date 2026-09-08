// FM RRHH — motor-reglas.mjs
// Motor de evaluación de `reglas_concepto.formula` + resolución de dependencias.
//
// Decisión de diseño clave: NO se usa eval() ni new Function(). Las fórmulas las
// va a escribir un administrador funcional desde una UI, no un desarrollador —
// tienen que evaluarse en un sandbox real: un parser propio, con una gramática
// chica y una lista blanca de funciones. Nada de lo que se escriba en `formula`
// puede tocar el sistema de archivos, la red, ni ninguna variable que no esté
// explícitamente en el contexto.
//
// PRECISIÓN: toda la aritmética interna usa Decimal (decimal.js), no `number`
// nativo de JS — un `float` no puede representar exactamente la mayoría de
// los decimales (0.1 + 0.2 !== 0.3 en JS), y en una liquidación real eso se
// traduce en centavos que aparecen o desaparecen sin motivo tras muchas
// operaciones encadenadas. Los literales de una fórmula (ej. "0.11") se
// convierten a Decimal DIRECTO DESDE EL TEXTO, nunca pasando por un float
// intermedio — si se hiciera `new Decimal(parseFloat("0.11"))`, ya se
// arrastraría el mismo error que se está tratando de eliminar.
//
// Esto es 100% interno: quien llama a evaluarFormula()/liquidarLegajo() (acá
// mismo o en los tests) sigue pasando y recibiendo `number` normales — la
// conversión a Decimal y de vuelta a number pasa adentro, sin que el resto
// del sistema tenga que cambiar una sola línea.
import Decimal from "decimal.js";

Decimal.set({ rounding: Decimal.ROUND_HALF_UP, precision: 34 });

function toDecimal(x) {
  if (x instanceof Decimal) return x;
  return new Decimal(x);
}

const TOKEN_RE = /\s*(=>|<=|>=|==|!=|[()+\-*/^,?:<>]|"[^"]*"|'[^']*'|[A-Za-z_][A-Za-z0-9_]*|\d+\.?\d*)\s*/y;

function tokenize(formula) {
  const tokens = [];
  let pos = 0;
  TOKEN_RE.lastIndex = 0;
  while (pos < formula.length) {
    TOKEN_RE.lastIndex = pos;
    const m = TOKEN_RE.exec(formula);
    if (!m || m[0].length === 0) {
      throw new SyntaxError(`Fórmula inválida cerca de: "${formula.slice(pos, pos + 15)}"`);
    }
    tokens.push(m[1]);
    pos += m[0].length;
  }
  return tokens;
}

function parse(tokens) {
  let i = 0;
  const peek = () => tokens[i];
  const next = () => tokens[i++];
  const expect = (t) => {
    if (peek() !== t) throw new SyntaxError(`Se esperaba "${t}", se encontró ${peek() === undefined ? "el final de la fórmula (¿falta cerrar un paréntesis?)" : `"${peek()}"`}`);
    return next();
  };

  function parseTernary() {
    let cond = parseComparison();
    if (peek() === "?") {
      next();
      const whenTrue = parseTernary();
      expect(":");
      const whenFalse = parseTernary();
      return { type: "ternary", cond, whenTrue, whenFalse };
    }
    return cond;
  }

  function parseComparison() {
    let left = parseAdditive();
    const ops = ["<=", ">=", "==", "!=", "<", ">"];
    while (ops.includes(peek())) {
      const op = next();
      const right = parseAdditive();
      left = { type: "binop", op, left, right };
    }
    return left;
  }

  function parseAdditive() {
    let left = parseMultiplicative();
    while (peek() === "+" || peek() === "-") {
      const op = next();
      const right = parseMultiplicative();
      left = { type: "binop", op, left, right };
    }
    return left;
  }

  function parseMultiplicative() {
    let left = parsePower();
    while (peek() === "*" || peek() === "/") {
      const op = next();
      const right = parsePower();
      left = { type: "binop", op, left, right };
    }
    return left;
  }

  function parsePower() {
    const base = parseUnary();
    if (peek() === "^") {
      next();
      const exp = parsePower();
      return { type: "binop", op: "^", left: base, right: exp };
    }
    return base;
  }

  function parseUnary() {
    if (peek() === "-") {
      next();
      return { type: "unop", op: "-", value: parseUnary() };
    }
    return parsePrimary();
  }

  function parsePrimary() {
    const t = peek();
    if (t === "(") {
      next();
      const e = parseTernary();
      expect(")");
      return e;
    }
    if (/^\d/.test(t)) {
      next();
      return { type: "number", value: parseFloat(t), raw: t };
    }
    if (/^["']/.test(t)) {
      next();
      return { type: "string", value: t.slice(1, -1) };
    }
    if (/^[A-Za-z_]/.test(t)) {
      next();
      if (peek() === "(") {
        next();
        const args = [];
        if (peek() !== ")") {
          args.push(parseTernary());
          while (peek() === ",") {
            next();
            args.push(parseTernary());
          }
        }
        expect(")");
        return { type: "call", name: t.toUpperCase(), args };
      }
      return { type: "var", name: t.toUpperCase() };
    }
    throw new SyntaxError(`Token inesperado: "${t}"`);
  }

  const ast = parseTernary();
  if (i !== tokens.length) throw new SyntaxError(`Tokens sobrantes desde: "${tokens[i]}"`);
  return ast;
}

const FUNCTIONS = {
  MIN: (...a) => a.reduce((min, x) => (x.lessThan(min) ? x : min)),
  MAX: (...a) => a.reduce((max, x) => (x.greaterThan(max) ? x : max)),
  ROUND: (a, d) => a.toDecimalPlaces(d ? d.toNumber() : 0),
  ABS: (a) => a.abs(),
  IF: (cond, a, b) => (cond ? a : b),
};

function evaluate(ast, context) {
  switch (ast.type) {
    case "number":
      return new Decimal(ast.raw);
    case "string":
      return ast.value;
    case "var": {
      if (ast.name in context.vars) return toDecimal(context.vars[ast.name]);
      throw new ReferenceError(`Variable no definida en el contexto: ${ast.name}`);
    }
    case "unop":
      if (ast.op === "-") return evaluate(ast.value, context).negated();
      break;
    case "binop": {
      const l = evaluate(ast.left, context);
      const r = evaluate(ast.right, context);
      switch (ast.op) {
        case "+": return l.plus(r);
        case "-": return l.minus(r);
        case "*": return l.times(r);
        case "/": return r.isZero() ? new Decimal(0) : l.dividedBy(r);
        case "^": return l.pow(r);
        case "<": return l.lessThan(r);
        case ">": return l.greaterThan(r);
        case "<=": return l.lessThanOrEqualTo(r);
        case ">=": return l.greaterThanOrEqualTo(r);
        case "==": return l.equals(r);
        case "!=": return !l.equals(r);
      }
      break;
    }
    case "ternary":
      return evaluate(ast.cond, context) ? evaluate(ast.whenTrue, context) : evaluate(ast.whenFalse, context);
    case "call": {
      if (ast.name === "CONCEPTO") {
        const codigo = ast.args[0].value;
        if (!(codigo in context.conceptos)) {
          throw new ReferenceError(
            `CONCEPTO('${codigo}') referenciado antes de ser calculado. ¿Falta declarar la dependencia?`
          );
        }
        return toDecimal(context.conceptos[codigo]);
      }
      if (ast.name === "TOPE") {
        const clave = ast.args[0].value;
        if (!context.topes || !(clave in context.topes)) {
          throw new ReferenceError(
            `TOPE('${clave}') no está definido en el contexto — falta cargar el parámetro vigente para el período, o hay un typo en la clave.`
          );
        }
        return toDecimal(context.topes[clave]);
      }
      if (ast.name === "REM_TOTAL") {
        if (context.remTotal === undefined) {
          throw new ReferenceError(
            "REM_TOTAL() se usó en una fórmula de un concepto remunerativo o no remunerativo — solo se puede usar en descuentos (o algo que no sea remunerativo/no_remunerativo), porque necesita que TODOS los remunerativos ya estén calculados."
          );
        }
        return toDecimal(context.remTotal);
      }
      if (ast.name === "NOREM_TOTAL") {
        if (context.noRemTotal === undefined) {
          throw new ReferenceError(
            "NOREM_TOTAL() se usó en una fórmula de un concepto remunerativo o no remunerativo — solo se puede usar en descuentos (o algo que no sea remunerativo/no_remunerativo), por el mismo motivo que REM_TOTAL()."
          );
        }
        return toDecimal(context.noRemTotal);
      }
      if (ast.name === "VALOR_CATEGORIA") {
        const codigoConcepto = ast.args[0].value;
        if (!context.valoresCategoria || !(codigoConcepto in context.valoresCategoria)) {
          throw new ReferenceError(
            `VALOR_CATEGORIA('${codigoConcepto}') no está definido — no hay un valor cargado para la categoría de este legajo y este concepto en este período. Revisar ValorConceptoCategoria.`
          );
        }
        return toDecimal(context.valoresCategoria[codigoConcepto]);
      }
      if (ast.name === "CANTIDAD") {
        const codigo = ast.args.length > 0 ? ast.args[0].value : context.conceptoActual;
        if (!codigo) {
          throw new ReferenceError("CANTIDAD() sin argumento no se puede usar fuera de la fórmula de un concepto (error interno del motor).");
        }
        return toDecimal(context.cantidades?.[codigo] ?? 0);
      }
      if (ast.name === "NETO") {
        if (context.neto === undefined) {
          throw new ReferenceError(
            "NETO() se usó en una fórmula que corre antes de que existan los descuentos — solo se puede usar en conceptos de AJUSTE final (como Redondeo), que se calculan al final de todo."
          );
        }
        return toDecimal(context.neto);
      }
      if (ast.name in FUNCTIONS) {
        return FUNCTIONS[ast.name](...ast.args.map((a) => evaluate(a, context)));
      }
      throw new ReferenceError(`Función no permitida: ${ast.name}`);
    }
  }
  throw new Error(`Nodo AST desconocido: ${ast.type}`);
}

function evaluarFormula(formula, context) {
  const ast = parse(tokenize(formula));
  const resultado = evaluate(ast, context);
  return resultado instanceof Decimal ? resultado.toNumber() : resultado;
}

function formulaConValores(formula, context) {
  const ast = parse(tokenize(formula));
  const num = (n) => {
    const valor = n instanceof Decimal ? n.toNumber() : n;
    if (Number.isInteger(valor)) return String(valor);
    return String(Math.round(valor * 10000) / 10000);
  };

  function recorrer(nodo) {
    switch (nodo.type) {
      case "number":
        return num(nodo.value);
      case "string":
        return `"${nodo.value}"`;
      case "var":
        return num(evaluate(nodo, context));
      case "unop":
        return `-${recorrer(nodo.value)}`;
      case "binop":
        return `(${recorrer(nodo.left)} ${nodo.op} ${recorrer(nodo.right)})`;
      case "ternary":
        return `(${recorrer(nodo.cond)} ? ${recorrer(nodo.whenTrue)} : ${recorrer(nodo.whenFalse)})`;
      case "call": {
        const argsConValores = nodo.args.map(recorrer).join(", ");
        return `${nodo.name}(${argsConValores})=${num(evaluate(nodo, context))}`;
      }
      default:
        return "?";
    }
  }

  return recorrer(ast);
}

function extraerDependencias(formula) {
  const re = /CONCEPTO\(\s*['"]([^'"]+)['"]\s*\)/g;
  const deps = new Set();
  let m;
  while ((m = re.exec(formula))) deps.add(m[1]);
  return [...deps];
}

function extraerTopesReferenciados(formula) {
  const re = /TOPE\(\s*['"]([^'"]+)['"]\s*\)/g;
  const claves = new Set();
  let m;
  while ((m = re.exec(formula))) claves.add(m[1]);
  return [...claves];
}

const VARIABLES_BASE_CONOCIDAS = ["BASICO", "VALOR_HORA", "ANTIGUEDAD_ANIOS", "DIAS_TRABAJADOS", "DIAS_MES", "HORAS_TRABAJADAS"];

function extraerVariablesBase(formula) {
  const encontradas = new Set();
  for (const v of VARIABLES_BASE_CONOCIDAS) {
    const re = new RegExp(`\\b${v}\\b`);
    if (re.test(formula)) encontradas.add(v);
  }
  return [...encontradas];
}

const FUNCIONES_CONOCIDAS = ["REM_TOTAL", "NOREM_TOTAL", "VALOR_CATEGORIA", "CANTIDAD", "NETO", "MIN", "MAX", "ROUND", "ABS", "IF"];

function extraerFuncionesUsadas(formula) {
  const encontradas = new Set();
  for (const f of FUNCIONES_CONOCIDAS) {
    const re = new RegExp(`\\b${f}\\s*\\(`);
    if (re.test(formula)) encontradas.add(f);
  }
  return [...encontradas];
}

function usaNeto(formula) {
  return /\bNETO\s*\(/.test(formula);
}

function ordenTopologico(reglas) {
  const nodos = new Set(reglas.map((r) => r.conceptoCodigo));
  const deps = new Map(reglas.map((r) => [r.conceptoCodigo, extraerDependencias(r.formula)]));

  const visitado = new Map();
  const orden = [];
  const pila = [];

  function visitar(codigo) {
    if (visitado.get(codigo) === "listo") return;
    if (visitado.get(codigo) === "visitando") {
      const ciclo = [...pila.slice(pila.indexOf(codigo)), codigo].join(" → ");
      throw new Error(`Ciclo de dependencias detectado entre conceptos: ${ciclo}`);
    }
    visitado.set(codigo, "visitando");
    pila.push(codigo);
    for (const dep of deps.get(codigo) ?? []) {
      if (nodos.has(dep)) visitar(dep);
    }
    pila.pop();
    visitado.set(codigo, "listo");
    orden.push(codigo);
  }

  for (const codigo of nodos) visitar(codigo);
  return orden;
}

/**
 * @param {object} p
 * @param {object} p.varsBase - variables ya resueltas desde escala/novedades/legajo
 *   (BASICO, VALOR_HORA, HORAS_NORMALES, HORAS_EXTRA_50, HORAS_EXTRA_100,
 *    DIAS_TRABAJADOS, DIAS_MES, ANTIGUEDAD_ANIOS, ...)
 * @param {Array} p.conceptos - [{ codigo, nombre, tipo: 'remunerativo'|'no_remunerativo'|'descuento' }]
 * @param {Array} p.reglas - [{ conceptoCodigo, formula, aporta, contribuye }]
 *   (ya filtradas por convenio + vigencia del período — eso pasa antes de llamar acá)
 * @param {object} [p.insumosDirectos] - { CODIGO: valorYaCargadoEnNovedad } para
 *   conceptos "insumo" (sin regla, viene directo de la novedad importada)
 * @param {object} [p.topes] - { CLAVE: valorNumerico } parámetros vigentes
 *   (tope jubilatorio, SMVM, etc.) para las fórmulas que usan TOPE()
 * @param {object} [p.cantidades] - { CODIGO: cantidadCargada } cantidades de
 *   novedades cargadas, para las fórmulas que usan CANTIDAD()
 * @param {object} [p.valoresCategoria] - { CODIGO: valorFijo } valores por
 *   categoría vigentes, para las fórmulas que usan VALOR_CATEGORIA()
 * @param {object} [p.overrides] - { CODIGO: importeForzado } SOLO para
 *   Liquidación Individual (ver 07/09/2026): fuerza el importe EFECTIVO de
 *   un concepto que sí tiene regla, sin dejar de evaluar su fórmula (el
 *   resultado de la fórmula se sigue calculando y viaja en
 *   detalle[].importeCalculado, para poder mostrar "normal vs. forzado") —
 *   lo que cambia es el valor que queda en contexto para todo lo que
 *   dependa de este concepto (aportes, contribuciones, neto...), que así
 *   recalcula en cascada usando el valor forzado, no el de la fórmula.
 *   Vacío u omitido, el comportamiento es idéntico al de siempre.
 */
function liquidarLegajo({ varsBase, conceptos, reglas, insumosDirectos = {}, topes = {}, cantidades = {}, valoresCategoria = {}, overrides = {} }) {
  const conceptoPorCodigo = new Map(conceptos.map((c) => [c.codigo, c]));
  const tipoDeConcepto = (codigo) => conceptoPorCodigo.get(codigo)?.tipo;

  const reglasEtapa3 = reglas.filter((r) => usaNeto(r.formula));

  const reglasEtapa1 = reglas.filter((r) => {
    if (reglasEtapa3.includes(r)) return false;
    const t = tipoDeConcepto(r.conceptoCodigo);
    return t === "remunerativo" || t === "no_remunerativo";
  });
  const reglasEtapa2 = reglas.filter((r) => !reglasEtapa1.includes(r) && !reglasEtapa3.includes(r));

  const reglaPorCodigo = new Map(reglas.map((r) => [r.conceptoCodigo, r]));
  const detalle = [];
  const context = { vars: varsBase, conceptos: { ...insumosDirectos }, topes, cantidades, valoresCategoria };

  const remunerativoDeInsumos = Object.entries(insumosDirectos)
    .filter(([codigo]) => !reglaPorCodigo.has(codigo) && tipoDeConcepto(codigo) === "remunerativo")
    .reduce((a, [, v]) => a + v, 0);
  const noRemunerativoDeInsumos = Object.entries(insumosDirectos)
    .filter(([codigo]) => !reglaPorCodigo.has(codigo) && tipoDeConcepto(codigo) === "no_remunerativo")
    .reduce((a, [, v]) => a + v, 0);

  function evaluarEtapa(listaDeReglas) {
    const orden = ordenTopologico(listaDeReglas);
    for (const codigo of orden) {
      const regla = reglaPorCodigo.get(codigo);
      context.conceptoActual = codigo;
      const calculado = Math.round(evaluarFormula(regla.formula, context) * 100) / 100;
      const forzado = Object.prototype.hasOwnProperty.call(overrides, codigo);
      const importe = forzado ? Math.round(overrides[codigo] * 100) / 100 : calculado;
      // Lo que queda en contexto es el valor EFECTIVO (forzado si corresponde) —
      // así todo lo que dependa de este concepto vía CONCEPTO(codigo) recalcula
      // en cascada usando el valor forzado, no el de la fórmula.
      context.conceptos[codigo] = importe;
      detalle.push({
        conceptoCodigo: codigo,
        nombre: conceptoPorCodigo.get(codigo)?.nombre ?? codigo,
        tipo: conceptoPorCodigo.get(codigo)?.tipo,
        importe,
        importeCalculado: forzado ? calculado : null,
        forzado,
        aporta: regla.aporta,
        contribuye: regla.contribuye,
        formula: regla.formula,
      });
    }
  }

  evaluarEtapa(reglasEtapa1);

  context.remTotal = detalle.filter((d) => tipoDeConcepto(d.conceptoCodigo) === "remunerativo").reduce((a, d) => a + d.importe, 0) + remunerativoDeInsumos;
  context.noRemTotal = detalle.filter((d) => tipoDeConcepto(d.conceptoCodigo) === "no_remunerativo").reduce((a, d) => a + d.importe, 0) + noRemunerativoDeInsumos;

  evaluarEtapa(reglasEtapa2);

  const brutoHastaAhora = detalle.filter((d) => tipoDeConcepto(d.conceptoCodigo) === "remunerativo" || tipoDeConcepto(d.conceptoCodigo) === "no_remunerativo").reduce((a, d) => a + d.importe, 0) + remunerativoDeInsumos + noRemunerativoDeInsumos;
  const descuentosHastaAhora = detalle.filter((d) => tipoDeConcepto(d.conceptoCodigo) === "descuento").reduce((a, d) => a + d.importe, 0);
  context.neto = brutoHastaAhora - descuentosHastaAhora;

  evaluarEtapa(reglasEtapa3);

  for (const [codigo, importe] of Object.entries(insumosDirectos)) {
    if (!reglaPorCodigo.has(codigo)) {
      detalle.push({
        conceptoCodigo: codigo,
        nombre: conceptoPorCodigo.get(codigo)?.nombre ?? codigo,
        tipo: conceptoPorCodigo.get(codigo)?.tipo,
        importe,
        aporta: conceptoPorCodigo.get(codigo)?.tipo === "remunerativo",
        contribuye: conceptoPorCodigo.get(codigo)?.tipo === "remunerativo",
      });
    }
  }

  const remTotal = detalle.filter((d) => tipoDeConcepto(d.conceptoCodigo) === "remunerativo").reduce((a, d) => a + d.importe, 0);
  const remNoRemun = detalle.filter((d) => tipoDeConcepto(d.conceptoCodigo) === "no_remunerativo").reduce((a, d) => a + d.importe, 0);
  const descuentos = detalle.filter((d) => tipoDeConcepto(d.conceptoCodigo) === "descuento").reduce((a, d) => a + d.importe, 0);
  const remSujetaAportes = detalle.filter((d) => d.aporta).reduce((a, d) => a + d.importe, 0);

  return {
    orden: detalle.map((d) => d.conceptoCodigo),
    detalle,
    remTotal,
    remNoRemun,
    remSujetaAportes,
    bruto: remTotal + remNoRemun,
    neto: remTotal + remNoRemun - descuentos,
  };
}

export { tokenize, parse, evaluate, evaluarFormula, formulaConValores, extraerDependencias, extraerTopesReferenciados, extraerVariablesBase, extraerFuncionesUsadas, ordenTopologico, liquidarLegajo };
