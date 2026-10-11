-- AlterTable
ALTER TABLE "Busqueda" ADD COLUMN     "palabrasClave" TEXT[],
ADD COLUMN     "preguntas" JSONB NOT NULL DEFAULT '[]';

-- AlterTable
ALTER TABLE "Candidato" ADD COLUMN     "cumpleExcluyentes" BOOLEAN,
ADD COLUMN     "cvTexto" TEXT,
ADD COLUMN     "noCumple" TEXT[],
ADD COLUMN     "palabrasHalladas" TEXT[],
ADD COLUMN     "puntajeFiltro" INTEGER,
ADD COLUMN     "respuestas" JSONB;

