-- CreateTable
CREATE TABLE "HorarioTrabajo" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#7FA8C6',
    "dias" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HorarioTrabajo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AsignacionHorario" (
    "id" TEXT NOT NULL,
    "legajoId" TEXT NOT NULL,
    "desde" TIMESTAMP(3) NOT NULL,
    "hasta" TIMESTAMP(3),
    "horarioIds" TEXT[],
    "cargadoPor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AsignacionHorario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HorarioTrabajo_empresaId_nombre_key" ON "HorarioTrabajo"("empresaId", "nombre");

-- CreateIndex
CREATE INDEX "AsignacionHorario_legajoId_desde_idx" ON "AsignacionHorario"("legajoId", "desde");

-- AddForeignKey
ALTER TABLE "HorarioTrabajo" ADD CONSTRAINT "HorarioTrabajo_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AsignacionHorario" ADD CONSTRAINT "AsignacionHorario_legajoId_fkey" FOREIGN KEY ("legajoId") REFERENCES "Legajo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
