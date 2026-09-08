-- AlterTable
ALTER TABLE "Concepto" ADD COLUMN     "rubro" TEXT;

-- AlterTable
ALTER TABLE "Periodo" ADD COLUMN     "fechaPago" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "empresas" ADD COLUMN     "domicilio" TEXT;
