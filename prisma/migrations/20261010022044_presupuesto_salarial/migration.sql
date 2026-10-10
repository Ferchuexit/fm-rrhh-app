-- AlterTable
ALTER TABLE "empresas" ADD COLUMN     "pctContribucionesEstimado" DECIMAL(5,2);

-- CreateTable
CREATE TABLE "PresupuestoSalarial" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "centroCostoId" TEXT,
    "fechaDesde" TIMESTAMP(3) NOT NULL,
    "fechaHasta" TIMESTAMP(3) NOT NULL,
    "importe" DECIMAL(16,2) NOT NULL,
    "nota" TEXT,
    "cargadoPor" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PresupuestoSalarial_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PresupuestoSalarial_empresaId_fechaDesde_fechaHasta_idx" ON "PresupuestoSalarial"("empresaId", "fechaDesde", "fechaHasta");

-- AddForeignKey
ALTER TABLE "PresupuestoSalarial" ADD CONSTRAINT "PresupuestoSalarial_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PresupuestoSalarial" ADD CONSTRAINT "PresupuestoSalarial_centroCostoId_fkey" FOREIGN KEY ("centroCostoId") REFERENCES "CentroCosto"("id") ON DELETE CASCADE ON UPDATE CASCADE;
