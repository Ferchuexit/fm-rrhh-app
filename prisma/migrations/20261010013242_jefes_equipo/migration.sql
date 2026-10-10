-- AlterTable
ALTER TABLE "Legajo" ADD COLUMN     "jefeId" TEXT;

-- AlterTable
ALTER TABLE "SolicitudAusencia" ADD COLUMN     "solicitadoPorId" TEXT;

-- CreateIndex
CREATE INDEX "Legajo_jefeId_idx" ON "Legajo"("jefeId");

-- AddForeignKey
ALTER TABLE "Legajo" ADD CONSTRAINT "Legajo_jefeId_fkey" FOREIGN KEY ("jefeId") REFERENCES "Legajo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolicitudAusencia" ADD CONSTRAINT "SolicitudAusencia_solicitadoPorId_fkey" FOREIGN KEY ("solicitadoPorId") REFERENCES "Legajo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
