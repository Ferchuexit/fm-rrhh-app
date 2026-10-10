-- AlterTable
ALTER TABLE "CicloEvaluacion" ADD COLUMN     "conAutoevaluacion" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Evaluacion" ADD COLUMN     "autoComentario" TEXT,
ADD COLUMN     "autoCompletadaEn" TIMESTAMP(3),
ADD COLUMN     "autoPuntajes" JSONB;

-- CreateTable
CREATE TABLE "Objetivo" (
    "id" TEXT NOT NULL,
    "legajoId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT,
    "fechaLimite" TIMESTAMP(3) NOT NULL,
    "avance" INTEGER NOT NULL DEFAULT 0,
    "estado" TEXT NOT NULL DEFAULT 'en_curso',
    "nota" TEXT,
    "notaPor" TEXT,
    "actualizadoEn" TIMESTAMP(3),
    "comentarioCierre" TEXT,
    "creadoPor" TEXT NOT NULL,
    "cerradoPor" TEXT,
    "cerradoEn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Objetivo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanCarrera" (
    "id" TEXT NOT NULL,
    "legajoId" TEXT NOT NULL,
    "puestoObjetivo" TEXT NOT NULL,
    "fechaObjetivo" TIMESTAMP(3),
    "notas" TEXT,
    "requisitos" JSONB NOT NULL,
    "actualizadoPor" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanCarrera_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Objetivo_legajoId_estado_idx" ON "Objetivo"("legajoId", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "PlanCarrera_legajoId_key" ON "PlanCarrera"("legajoId");

-- AddForeignKey
ALTER TABLE "Objetivo" ADD CONSTRAINT "Objetivo_legajoId_fkey" FOREIGN KEY ("legajoId") REFERENCES "Legajo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanCarrera" ADD CONSTRAINT "PlanCarrera_legajoId_fkey" FOREIGN KEY ("legajoId") REFERENCES "Legajo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- El módulo nuevo "Objetivos y plan de carrera" en los roles que vienen
-- armados (solo si todavía no lo tienen).
UPDATE "Rol" SET "permisos" = "permisos"::jsonb || '{"objetivos":"gestionar"}'::jsonb
  WHERE "id" IN ('rol-rrhh-completo', 'rol-supervisor') AND NOT ("permisos"::jsonb ? 'objetivos');
UPDATE "Rol" SET "permisos" = "permisos"::jsonb || '{"objetivos":"ver"}'::jsonb
  WHERE "id" = 'rol-solo-lectura' AND NOT ("permisos"::jsonb ? 'objetivos');
