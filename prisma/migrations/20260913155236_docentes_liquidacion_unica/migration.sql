/*
  Warnings:

  - A unique constraint covering the columns `[legajoId,periodo]` on the table `DocLiquidacion` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "DocConcepto" ADD COLUMN     "aportaAportes" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE UNIQUE INDEX "DocLiquidacion_legajoId_periodo_key" ON "DocLiquidacion"("legajoId", "periodo");
