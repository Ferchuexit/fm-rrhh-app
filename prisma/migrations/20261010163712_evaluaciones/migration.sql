-- CreateTable
CREATE TABLE "FormularioEvaluacion" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "competencias" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FormularioEvaluacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CicloEvaluacion" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "formulario" TEXT NOT NULL,
    "competencias" JSONB NOT NULL,
    "fechaLimite" TIMESTAMP(3) NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'abierto',
    "creadoPor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cerradoEn" TIMESTAMP(3),

    CONSTRAINT "CicloEvaluacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evaluacion" (
    "id" TEXT NOT NULL,
    "cicloId" TEXT NOT NULL,
    "legajoId" TEXT NOT NULL,
    "evaluadorId" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'pendiente',
    "puntajes" JSONB,
    "fortalezas" TEXT,
    "aMejorar" TEXT,
    "promedio" DOUBLE PRECISION,
    "completadaPor" TEXT,
    "completadaEn" TIMESTAMP(3),
    "entregadaEn" TIMESTAMP(3),
    "firma" TEXT,
    "comentarioEmpleado" TEXT,
    "firmadoEn" TIMESTAMP(3),
    "firmaIp" TEXT,

    CONSTRAINT "Evaluacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FormularioEvaluacion_empresaId_nombre_key" ON "FormularioEvaluacion"("empresaId", "nombre");

-- CreateIndex
CREATE INDEX "CicloEvaluacion_empresaId_estado_idx" ON "CicloEvaluacion"("empresaId", "estado");

-- CreateIndex
CREATE INDEX "Evaluacion_evaluadorId_estado_idx" ON "Evaluacion"("evaluadorId", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "Evaluacion_cicloId_legajoId_key" ON "Evaluacion"("cicloId", "legajoId");

-- AddForeignKey
ALTER TABLE "FormularioEvaluacion" ADD CONSTRAINT "FormularioEvaluacion_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CicloEvaluacion" ADD CONSTRAINT "CicloEvaluacion_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluacion" ADD CONSTRAINT "Evaluacion_cicloId_fkey" FOREIGN KEY ("cicloId") REFERENCES "CicloEvaluacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluacion" ADD CONSTRAINT "Evaluacion_legajoId_fkey" FOREIGN KEY ("legajoId") REFERENCES "Legajo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluacion" ADD CONSTRAINT "Evaluacion_evaluadorId_fkey" FOREIGN KEY ("evaluadorId") REFERENCES "Legajo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- El módulo nuevo "Evaluación de desempeño" en los roles que vienen armados
-- (solo si todavía no lo tienen). El Supervisor NO lo recibe: los
-- resultados de una evaluación son de RR.HH.
UPDATE "Rol" SET "permisos" = "permisos"::jsonb || '{"evaluaciones":"gestionar"}'::jsonb
  WHERE "id" = 'rol-rrhh-completo' AND NOT ("permisos"::jsonb ? 'evaluaciones');
UPDATE "Rol" SET "permisos" = "permisos"::jsonb || '{"evaluaciones":"ver"}'::jsonb
  WHERE "id" = 'rol-solo-lectura' AND NOT ("permisos"::jsonb ? 'evaluaciones');
