-- CreateTable
CREATE TABLE "DocumentoLegajo" (
    "id" TEXT NOT NULL,
    "legajoId" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "nombreArchivoOriginal" TEXT NOT NULL,
    "tipoMime" TEXT NOT NULL,
    "contenidoBase64" TEXT NOT NULL,
    "fechaSubida" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "subidoPor" TEXT,

    CONSTRAINT "DocumentoLegajo_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "DocumentoLegajo" ADD CONSTRAINT "DocumentoLegajo_legajoId_fkey" FOREIGN KEY ("legajoId") REFERENCES "Legajo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
