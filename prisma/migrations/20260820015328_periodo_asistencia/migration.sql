-- CreateTable
CREATE TABLE "PeriodoAsistencia" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "fechaDesde" TIMESTAMP(3) NOT NULL,
    "fechaHasta" TIMESTAMP(3) NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'cerrado',
    "fechaCierre" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cerradoPor" TEXT,

    CONSTRAINT "PeriodoAsistencia_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "PeriodoAsistencia" ADD CONSTRAINT "PeriodoAsistencia_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
