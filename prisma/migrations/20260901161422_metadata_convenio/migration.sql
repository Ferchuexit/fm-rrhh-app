-- AlterTable
ALTER TABLE "Convenio" ADD COLUMN     "actividad" TEXT,
ADD COLUMN     "fuentesNormativas" TEXT,
ADD COLUMN     "jurisdiccion" TEXT,
ADD COLUMN     "sindicato" TEXT,
ADD COLUMN     "vigenciaDesde" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "AprobacionPeriodo" (
    "id" TEXT NOT NULL,
    "periodoId" TEXT NOT NULL,
    "estado" TEXT NOT NULL,
    "observaciones" TEXT,
    "usuario" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AprobacionPeriodo_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "AprobacionPeriodo" ADD CONSTRAINT "AprobacionPeriodo_periodoId_fkey" FOREIGN KEY ("periodoId") REFERENCES "Periodo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
