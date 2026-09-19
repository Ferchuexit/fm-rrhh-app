-- AlterTable
ALTER TABLE "Fichada" ADD COLUMN     "anulada" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "anuladoPorId" TEXT,
ADD COLUMN     "fechaAnulacion" TIMESTAMP(3),
ADD COLUMN     "motivoAnulacion" TEXT;

-- AddForeignKey
ALTER TABLE "Fichada" ADD CONSTRAINT "Fichada_anuladoPorId_fkey" FOREIGN KEY ("anuladoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
