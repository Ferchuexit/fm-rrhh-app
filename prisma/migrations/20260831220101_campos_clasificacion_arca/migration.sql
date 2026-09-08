-- AlterTable
ALTER TABLE "Legajo" ADD COLUMN     "codigoActividad" TEXT,
ADD COLUMN     "codigoCondicion" TEXT NOT NULL DEFAULT '01',
ADD COLUMN     "codigoLocalidad" TEXT,
ADD COLUMN     "codigoModalidadContrato" TEXT NOT NULL DEFAULT '1',
ADD COLUMN     "codigoSituacionRevista" TEXT NOT NULL DEFAULT '01';
