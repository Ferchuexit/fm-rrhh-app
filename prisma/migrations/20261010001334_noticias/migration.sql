-- CreateTable
CREATE TABLE "Noticia" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "cuerpo" TEXT NOT NULL,
    "centroCostoId" TEXT,
    "requiereAcuse" BOOLEAN NOT NULL DEFAULT false,
    "estado" TEXT NOT NULL DEFAULT 'publicada',
    "publicadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publicadaPor" TEXT,
    "adjuntoNombre" TEXT,
    "adjuntoMime" TEXT,
    "adjuntoStorageKey" TEXT,
    "adjuntoBase64" TEXT,

    CONSTRAINT "Noticia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NoticiaLectura" (
    "id" TEXT NOT NULL,
    "noticiaId" TEXT NOT NULL,
    "legajoId" TEXT NOT NULL,
    "leidaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acuseEn" TIMESTAMP(3),
    "ipAcuse" TEXT,

    CONSTRAINT "NoticiaLectura_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Noticia_empresaId_estado_publicadaEn_idx" ON "Noticia"("empresaId", "estado", "publicadaEn");

-- CreateIndex
CREATE UNIQUE INDEX "NoticiaLectura_noticiaId_legajoId_key" ON "NoticiaLectura"("noticiaId", "legajoId");

-- AddForeignKey
ALTER TABLE "Noticia" ADD CONSTRAINT "Noticia_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Noticia" ADD CONSTRAINT "Noticia_centroCostoId_fkey" FOREIGN KEY ("centroCostoId") REFERENCES "CentroCosto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoticiaLectura" ADD CONSTRAINT "NoticiaLectura_noticiaId_fkey" FOREIGN KEY ("noticiaId") REFERENCES "Noticia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoticiaLectura" ADD CONSTRAINT "NoticiaLectura_legajoId_fkey" FOREIGN KEY ("legajoId") REFERENCES "Legajo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
