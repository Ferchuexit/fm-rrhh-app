-- AlterTable
ALTER TABLE "DocumentoLegajo" ADD COLUMN     "hash" TEXT,
ADD COLUMN     "storageKey" TEXT,
ALTER COLUMN "contenidoBase64" DROP NOT NULL;

-- CreateTable
CREATE TABLE "DescargaDocumento" (
    "id" TEXT NOT NULL,
    "documentoId" TEXT,
    "usuario" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DescargaDocumento_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "DescargaDocumento" ADD CONSTRAINT "DescargaDocumento_documentoId_fkey" FOREIGN KEY ("documentoId") REFERENCES "DocumentoLegajo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
