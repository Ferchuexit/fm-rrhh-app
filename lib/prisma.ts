// FM RRHH — lib/prisma.ts
// Patrón estándar de Next.js para evitar abrir una conexión nueva en cada
// hot-reload durante desarrollo.
//
// Client Extension (migración Float → Decimal) — SEGUNDA VERSIÓN.
//
// La primera versión de esto usaba una extensión de tipo `query` con
// `$allOperations`, que convierte los valores bien EN TIEMPO REAL (eso
// nunca fue el problema), pero TypeScript no tiene forma de saber que esa
// transformación genérica cambia el tipo de los campos — por eso
// `npx tsc --noEmit` tiraba decenas de errores "Decimal is not assignable
// to number" en archivos que ni siquiera tocamos, a pesar de que en
// producción esos mismos números ya venían bien.
//
// Esta versión usa una extensión de tipo `result` — más repetitiva de
// escribir (hay que declarar cada campo Decimal de cada modelo a mano),
// pero es la forma que Prisma sí sabe tipar correctamente: cada `compute()`
// le dice a TypeScript exactamente qué tipo devuelve, así que el cliente
// extendido queda con `bruto: number` en sus tipos, no `bruto: Decimal`.
//
// Si en algún momento se agrega un campo Decimal nuevo a algún modelo y
// no aparece acá, vuelve a fallar el chequeo de tipos en cualquier lugar
// que lo use — es la señal de que hay que agregarlo a esta lista.
import { PrismaClient, Prisma } from "@prisma/client";

function numOrNull(d: Prisma.Decimal | null): number | null {
  return d === null ? null : d.toNumber();
}

function crearPrismaClient() {
  return new PrismaClient().$extends({
    result: {
      escala: {
        basico: { needs: { basico: true }, compute: (e) => e.basico.toNumber() },
        valorHora: { needs: { valorHora: true }, compute: (e) => e.valorHora.toNumber() },
      },
      valorConceptoCategoria: {
        valor: { needs: { valor: true }, compute: (v) => v.valor.toNumber() },
      },
      parametroVigente: {
        valor: { needs: { valor: true }, compute: (p) => p.valor.toNumber() },
      },
      novedad: {
        cantidad: { needs: { cantidad: true }, compute: (n) => numOrNull(n.cantidad) },
        valor: { needs: { valor: true }, compute: (n) => numOrNull(n.valor) },
      },
      deduccionSiradig: {
        montoAnual: { needs: { montoAnual: true }, compute: (d) => d.montoAnual.toNumber() },
      },
      tablaGananciasMensual: {
        ganNoImponibleAcum: { needs: { ganNoImponibleAcum: true }, compute: (t) => t.ganNoImponibleAcum.toNumber() },
        deduccionEspecialAcum: { needs: { deduccionEspecialAcum: true }, compute: (t) => t.deduccionEspecialAcum.toNumber() },
        deduccionConyugeAcum: { needs: { deduccionConyugeAcum: true }, compute: (t) => t.deduccionConyugeAcum.toNumber() },
        deduccionHijoAcum: { needs: { deduccionHijoAcum: true }, compute: (t) => t.deduccionHijoAcum.toNumber() },
        deduccionHijoIncapAcum: { needs: { deduccionHijoIncapAcum: true }, compute: (t) => t.deduccionHijoIncapAcum.toNumber() },
      },
      tramoGananciasMensual: {
        desde: { needs: { desde: true }, compute: (t) => t.desde.toNumber() },
        hasta: { needs: { hasta: true }, compute: (t) => numOrNull(t.hasta) },
        montoFijo: { needs: { montoFijo: true }, compute: (t) => t.montoFijo.toNumber() },
        alicuota: { needs: { alicuota: true }, compute: (t) => t.alicuota.toNumber() },
        sobreExcedenteDe: { needs: { sobreExcedenteDe: true }, compute: (t) => t.sobreExcedenteDe.toNumber() },
      },
      saldoInicialGanancias: {
        brutoAcumuladoPrevio: { needs: { brutoAcumuladoPrevio: true }, compute: (s) => s.brutoAcumuladoPrevio.toNumber() },
        aportesAcumuladoPrevio: { needs: { aportesAcumuladoPrevio: true }, compute: (s) => s.aportesAcumuladoPrevio.toNumber() },
        retencionAcumuladaPrevia: { needs: { retencionAcumuladaPrevia: true }, compute: (s) => s.retencionAcumuladaPrevia.toNumber() },
      },
      embargo: {
        porcentaje: { needs: { porcentaje: true }, compute: (e) => numOrNull(e.porcentaje) },
        montoTotal: { needs: { montoTotal: true }, compute: (e) => numOrNull(e.montoTotal) },
      },
      cuotaEmbargo: {
        importe: { needs: { importe: true }, compute: (c) => c.importe.toNumber() },
      },
      liquidacion: {
        bruto: { needs: { bruto: true }, compute: (l) => l.bruto.toNumber() },
        neto: { needs: { neto: true }, compute: (l) => l.neto.toNumber() },
      },
      liquidacionDetalle: {
        importe: { needs: { importe: true }, compute: (d) => d.importe.toNumber() },
        importeCalculado: { needs: { importeCalculado: true }, compute: (d) => numOrNull(d.importeCalculado) },
      },
      liquidacionDetalleEdicion: {
        valorAnterior: { needs: { valorAnterior: true }, compute: (e) => numOrNull(e.valorAnterior) },
        valorNuevo: { needs: { valorNuevo: true }, compute: (e) => numOrNull(e.valorNuevo) },
      },
    },
  });
}

const globalForPrisma = globalThis as unknown as { prisma?: ReturnType<typeof crearPrismaClient> };

export const prisma = globalForPrisma.prisma ?? crearPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
