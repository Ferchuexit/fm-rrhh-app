-- AlterTable
ALTER TABLE "Legajo" ADD COLUMN     "nivelEducativo" TEXT,
ADD COLUMN     "talleCalzado" TEXT,
ADD COLUMN     "talleRopa" TEXT,
ADD COLUMN     "tituloObtenido" TEXT;

-- CreateTable
CREATE TABLE "Embargo" (
    "id" TEXT NOT NULL,
    "legajoId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "fechaInicio" TIMESTAMP(3) NOT NULL,
    "fechaFin" TIMESTAMP(3),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "porcentaje" DOUBLE PRECISION,
    "montoTotal" DOUBLE PRECISION,
    "documentoId" TEXT,

    CONSTRAINT "Embargo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CuotaEmbargo" (
    "id" TEXT NOT NULL,
    "embargoId" TEXT NOT NULL,
    "anio" INTEGER NOT NULL,
    "mes" INTEGER NOT NULL,
    "importe" DOUBLE PRECISION NOT NULL,
    "aplicado" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "CuotaEmbargo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CuotaEmbargo_embargoId_anio_mes_key" ON "CuotaEmbargo"("embargoId", "anio", "mes");

-- AddForeignKey
ALTER TABLE "Embargo" ADD CONSTRAINT "Embargo_legajoId_fkey" FOREIGN KEY ("legajoId") REFERENCES "Legajo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Embargo" ADD CONSTRAINT "Embargo_documentoId_fkey" FOREIGN KEY ("documentoId") REFERENCES "DocumentoLegajo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CuotaEmbargo" ADD CONSTRAINT "CuotaEmbargo_embargoId_fkey" FOREIGN KEY ("embargoId") REFERENCES "Embargo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
