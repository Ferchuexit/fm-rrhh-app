-- CreateTable
CREATE TABLE "PeriodoAnteriorTrabajado" (
    "id" TEXT NOT NULL,
    "legajoId" TEXT NOT NULL,
    "empleador" TEXT NOT NULL,
    "fechaDesde" TIMESTAMP(3) NOT NULL,
    "fechaHasta" TIMESTAMP(3),
    "motivo" TEXT,

    CONSTRAINT "PeriodoAnteriorTrabajado_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "PeriodoAnteriorTrabajado" ADD CONSTRAINT "PeriodoAnteriorTrabajado_legajoId_fkey" FOREIGN KEY ("legajoId") REFERENCES "Legajo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
