-- CreateTable
CREATE TABLE "SolicitudAusencia" (
    "id" TEXT NOT NULL,
    "legajoId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "fechaDesde" TIMESTAMP(3) NOT NULL,
    "fechaHasta" TIMESTAMP(3) NOT NULL,
    "dias" INTEGER NOT NULL,
    "motivo" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'pendiente',
    "respuesta" TEXT,
    "resueltoPor" TEXT,
    "resueltoEn" TIMESTAMP(3),
    "vacacionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SolicitudAusencia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SolicitudAusencia_vacacionId_key" ON "SolicitudAusencia"("vacacionId");

-- CreateIndex
CREATE INDEX "SolicitudAusencia_legajoId_estado_idx" ON "SolicitudAusencia"("legajoId", "estado");

-- AddForeignKey
ALTER TABLE "SolicitudAusencia" ADD CONSTRAINT "SolicitudAusencia_legajoId_fkey" FOREIGN KEY ("legajoId") REFERENCES "Legajo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolicitudAusencia" ADD CONSTRAINT "SolicitudAusencia_vacacionId_fkey" FOREIGN KEY ("vacacionId") REFERENCES "Vacacion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
