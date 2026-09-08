-- CreateTable
CREATE TABLE "RelacionLaboral" (
    "id" TEXT NOT NULL,
    "legajoId" TEXT NOT NULL,
    "convenioId" TEXT NOT NULL,
    "categoriaId" TEXT NOT NULL,
    "vigenciaDesde" TIMESTAMP(3) NOT NULL,
    "vigenciaHasta" TIMESTAMP(3),
    "motivo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RelacionLaboral_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "RelacionLaboral" ADD CONSTRAINT "RelacionLaboral_legajoId_fkey" FOREIGN KEY ("legajoId") REFERENCES "Legajo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RelacionLaboral" ADD CONSTRAINT "RelacionLaboral_convenioId_fkey" FOREIGN KEY ("convenioId") REFERENCES "Convenio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RelacionLaboral" ADD CONSTRAINT "RelacionLaboral_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "Categoria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
