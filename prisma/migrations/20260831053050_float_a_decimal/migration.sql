/*
  Warnings:

  - You are about to alter the column `importe` on the `CuotaEmbargo` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(16,2)`.
  - You are about to alter the column `montoAnual` on the `DeduccionSiradig` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(16,2)`.
  - You are about to alter the column `porcentaje` on the `Embargo` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(6,2)`.
  - You are about to alter the column `montoTotal` on the `Embargo` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(16,2)`.
  - You are about to alter the column `basico` on the `Escala` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(16,2)`.
  - You are about to alter the column `valorHora` on the `Escala` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(16,2)`.
  - You are about to alter the column `bruto` on the `Liquidacion` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(16,2)`.
  - You are about to alter the column `neto` on the `Liquidacion` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(16,2)`.
  - You are about to alter the column `importe` on the `LiquidacionDetalle` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(16,2)`.
  - You are about to alter the column `cantidad` on the `Novedad` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(12,4)`.
  - You are about to alter the column `valor` on the `Novedad` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(16,2)`.
  - You are about to alter the column `valor` on the `ParametroVigente` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(16,4)`.
  - You are about to alter the column `retencionAcumuladaPrevia` on the `SaldoInicialGanancias` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(16,2)`.
  - You are about to alter the column `aportesAcumuladoPrevio` on the `SaldoInicialGanancias` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(16,2)`.
  - You are about to alter the column `brutoAcumuladoPrevio` on the `SaldoInicialGanancias` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(16,2)`.
  - You are about to alter the column `ganNoImponibleAcum` on the `TablaGananciasMensual` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(16,2)`.
  - You are about to alter the column `deduccionEspecialAcum` on the `TablaGananciasMensual` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(16,2)`.
  - You are about to alter the column `deduccionConyugeAcum` on the `TablaGananciasMensual` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(16,2)`.
  - You are about to alter the column `deduccionHijoAcum` on the `TablaGananciasMensual` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(16,2)`.
  - You are about to alter the column `deduccionHijoIncapAcum` on the `TablaGananciasMensual` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(16,2)`.
  - You are about to alter the column `desde` on the `TramoGananciasMensual` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(16,2)`.
  - You are about to alter the column `hasta` on the `TramoGananciasMensual` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(16,2)`.
  - You are about to alter the column `montoFijo` on the `TramoGananciasMensual` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(16,2)`.
  - You are about to alter the column `alicuota` on the `TramoGananciasMensual` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(6,4)`.
  - You are about to alter the column `sobreExcedenteDe` on the `TramoGananciasMensual` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(16,2)`.
  - You are about to alter the column `valor` on the `ValorConceptoCategoria` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(16,2)`.

*/
-- AlterTable
ALTER TABLE "CuotaEmbargo" ALTER COLUMN "importe" SET DATA TYPE DECIMAL(16,2);

-- AlterTable
ALTER TABLE "DeduccionSiradig" ALTER COLUMN "montoAnual" SET DATA TYPE DECIMAL(16,2);

-- AlterTable
ALTER TABLE "Embargo" ALTER COLUMN "porcentaje" SET DATA TYPE DECIMAL(6,2),
ALTER COLUMN "montoTotal" SET DATA TYPE DECIMAL(16,2);

-- AlterTable
ALTER TABLE "Escala" ALTER COLUMN "basico" SET DATA TYPE DECIMAL(16,2),
ALTER COLUMN "valorHora" SET DATA TYPE DECIMAL(16,2);

-- AlterTable
ALTER TABLE "Liquidacion" ALTER COLUMN "bruto" SET DATA TYPE DECIMAL(16,2),
ALTER COLUMN "neto" SET DATA TYPE DECIMAL(16,2);

-- AlterTable
ALTER TABLE "LiquidacionDetalle" ALTER COLUMN "importe" SET DATA TYPE DECIMAL(16,2);

-- AlterTable
ALTER TABLE "Novedad" ALTER COLUMN "cantidad" SET DATA TYPE DECIMAL(12,4),
ALTER COLUMN "valor" SET DATA TYPE DECIMAL(16,2);

-- AlterTable
ALTER TABLE "ParametroVigente" ALTER COLUMN "valor" SET DATA TYPE DECIMAL(16,4);

-- AlterTable
ALTER TABLE "SaldoInicialGanancias" ALTER COLUMN "retencionAcumuladaPrevia" SET DATA TYPE DECIMAL(16,2),
ALTER COLUMN "aportesAcumuladoPrevio" SET DATA TYPE DECIMAL(16,2),
ALTER COLUMN "brutoAcumuladoPrevio" SET DATA TYPE DECIMAL(16,2);

-- AlterTable
ALTER TABLE "TablaGananciasMensual" ALTER COLUMN "ganNoImponibleAcum" SET DATA TYPE DECIMAL(16,2),
ALTER COLUMN "deduccionEspecialAcum" SET DATA TYPE DECIMAL(16,2),
ALTER COLUMN "deduccionConyugeAcum" SET DATA TYPE DECIMAL(16,2),
ALTER COLUMN "deduccionHijoAcum" SET DATA TYPE DECIMAL(16,2),
ALTER COLUMN "deduccionHijoIncapAcum" SET DATA TYPE DECIMAL(16,2);

-- AlterTable
ALTER TABLE "TramoGananciasMensual" ALTER COLUMN "desde" SET DATA TYPE DECIMAL(16,2),
ALTER COLUMN "hasta" SET DATA TYPE DECIMAL(16,2),
ALTER COLUMN "montoFijo" SET DATA TYPE DECIMAL(16,2),
ALTER COLUMN "alicuota" SET DATA TYPE DECIMAL(6,4),
ALTER COLUMN "sobreExcedenteDe" SET DATA TYPE DECIMAL(16,2);

-- AlterTable
ALTER TABLE "ValorConceptoCategoria" ALTER COLUMN "valor" SET DATA TYPE DECIMAL(16,2);

-- CreateTable
CREATE TABLE "UsuarioEmpresa" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,

    CONSTRAINT "UsuarioEmpresa_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UsuarioEmpresa_usuarioId_empresaId_key" ON "UsuarioEmpresa"("usuarioId", "empresaId");

-- AddForeignKey
ALTER TABLE "UsuarioEmpresa" ADD CONSTRAINT "UsuarioEmpresa_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsuarioEmpresa" ADD CONSTRAINT "UsuarioEmpresa_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
