/*
  Warnings:

  - A unique constraint covering the columns `[periodoId,legajoId,version]` on the table `Liquidacion` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Liquidacion_periodoId_legajoId_key";

-- AlterTable
ALTER TABLE "Liquidacion" ADD COLUMN     "calculadoPor" TEXT,
ADD COLUMN     "convenioId" TEXT,
ADD COLUMN     "fechaCalculo" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "motivo" TEXT,
ADD COLUMN     "motorVersion" TEXT NOT NULL DEFAULT '1.0.0',
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "vigente" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "LiquidacionDetalle" ADD COLUMN     "formulaUsada" TEXT;

-- AlterTable
ALTER TABLE "Periodo" ADD COLUMN     "fueCerradaAlgunaVez" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "LiquidacionNovedad" (
    "id" TEXT NOT NULL,
    "liquidacionId" TEXT NOT NULL,
    "novedadId" TEXT NOT NULL,

    CONSTRAINT "LiquidacionNovedad_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LiquidacionNovedad_liquidacionId_novedadId_key" ON "LiquidacionNovedad"("liquidacionId", "novedadId");

-- CreateIndex
CREATE UNIQUE INDEX "Liquidacion_periodoId_legajoId_version_key" ON "Liquidacion"("periodoId", "legajoId", "version");

-- AddForeignKey
ALTER TABLE "Liquidacion" ADD CONSTRAINT "Liquidacion_convenioId_fkey" FOREIGN KEY ("convenioId") REFERENCES "Convenio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiquidacionNovedad" ADD CONSTRAINT "LiquidacionNovedad_liquidacionId_fkey" FOREIGN KEY ("liquidacionId") REFERENCES "Liquidacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiquidacionNovedad" ADD CONSTRAINT "LiquidacionNovedad_novedadId_fkey" FOREIGN KEY ("novedadId") REFERENCES "Novedad"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
