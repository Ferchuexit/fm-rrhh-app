-- CreateTable
CREATE TABLE "ValorConceptoCategoria" (
    "id" TEXT NOT NULL,
    "conceptoId" TEXT NOT NULL,
    "categoriaId" TEXT NOT NULL,
    "vigenciaDesde" TIMESTAMP(3) NOT NULL,
    "vigenciaHasta" TIMESTAMP(3),
    "valor" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "ValorConceptoCategoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ValorConceptoCategoria_conceptoId_categoriaId_vigenciaDesde_key" ON "ValorConceptoCategoria"("conceptoId", "categoriaId", "vigenciaDesde");

-- AddForeignKey
ALTER TABLE "ValorConceptoCategoria" ADD CONSTRAINT "ValorConceptoCategoria_conceptoId_fkey" FOREIGN KEY ("conceptoId") REFERENCES "Concepto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValorConceptoCategoria" ADD CONSTRAINT "ValorConceptoCategoria_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "Categoria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
