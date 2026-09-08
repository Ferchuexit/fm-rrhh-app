-- AlterTable
ALTER TABLE "Periodo" ADD COLUMN     "convenioId" TEXT;

-- AddForeignKey
ALTER TABLE "Periodo" ADD CONSTRAINT "Periodo_convenioId_fkey" FOREIGN KEY ("convenioId") REFERENCES "Convenio"("id") ON DELETE SET NULL ON UPDATE CASCADE;
