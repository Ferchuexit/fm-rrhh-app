-- AlterTable
ALTER TABLE "DocumentoLegajo" ADD COLUMN     "estado" TEXT NOT NULL DEFAULT 'aceptado',
ADD COLUMN     "motivoRechazo" TEXT,
ADD COLUMN     "origen" TEXT NOT NULL DEFAULT 'rrhh',
ADD COLUMN     "revisadoEn" TIMESTAMP(3),
ADD COLUMN     "revisadoPor" TEXT,
ADD COLUMN     "tipo" TEXT;

-- CreateTable
CREATE TABLE "ConstanciaFirmada" (
    "id" TEXT NOT NULL,
    "legajoId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "vacacionId" TEXT,
    "contenido" JSONB NOT NULL,
    "hashContenido" TEXT NOT NULL,
    "firmadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipFirma" TEXT,
    "userAgentFirma" TEXT,

    CONSTRAINT "ConstanciaFirmada_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SolicitudCambioDatos" (
    "id" TEXT NOT NULL,
    "legajoId" TEXT NOT NULL,
    "cambios" JSONB NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'pendiente',
    "respuesta" TEXT,
    "resueltoPor" TEXT,
    "resueltoEn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SolicitudCambioDatos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ConstanciaFirmada_legajoId_tipo_idx" ON "ConstanciaFirmada"("legajoId", "tipo");

-- CreateIndex
CREATE INDEX "SolicitudCambioDatos_legajoId_estado_idx" ON "SolicitudCambioDatos"("legajoId", "estado");

-- AddForeignKey
ALTER TABLE "ConstanciaFirmada" ADD CONSTRAINT "ConstanciaFirmada_legajoId_fkey" FOREIGN KEY ("legajoId") REFERENCES "Legajo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConstanciaFirmada" ADD CONSTRAINT "ConstanciaFirmada_vacacionId_fkey" FOREIGN KEY ("vacacionId") REFERENCES "Vacacion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolicitudCambioDatos" ADD CONSTRAINT "SolicitudCambioDatos_legajoId_fkey" FOREIGN KEY ("legajoId") REFERENCES "Legajo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
