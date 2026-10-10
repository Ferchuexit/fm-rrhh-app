-- AlterTable
ALTER TABLE "AsignacionHorario" ADD COLUMN     "diaDeCiclo" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "HorarioTrabajo" ADD COLUMN     "ciclo" JSONB;

