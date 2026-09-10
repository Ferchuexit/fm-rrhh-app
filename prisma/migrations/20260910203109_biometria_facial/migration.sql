-- CreateTable
CREATE TABLE "BiometriaEmpleado" (
    "id" TEXT NOT NULL,
    "legajoId" TEXT NOT NULL,
    "descriptor" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'activo',
    "dispositivoAltaId" TEXT,
    "fechaAlta" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaRevocacion" TIMESTAMP(3),
    "ultimaValidacion" TIMESTAMP(3),

    CONSTRAINT "BiometriaEmpleado_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BiometriaEmpleado_legajoId_key" ON "BiometriaEmpleado"("legajoId");

-- AddForeignKey
ALTER TABLE "BiometriaEmpleado" ADD CONSTRAINT "BiometriaEmpleado_legajoId_fkey" FOREIGN KEY ("legajoId") REFERENCES "Legajo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BiometriaEmpleado" ADD CONSTRAINT "BiometriaEmpleado_dispositivoAltaId_fkey" FOREIGN KEY ("dispositivoAltaId") REFERENCES "DispositivoAsistencia"("id") ON DELETE SET NULL ON UPDATE CASCADE;
