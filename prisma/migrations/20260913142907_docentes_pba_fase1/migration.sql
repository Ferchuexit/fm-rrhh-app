-- CreateTable
CREATE TABLE "DocCargo" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "nivel" TEXT NOT NULL,
    "modalidad" TEXT,
    "indice" DECIMAL(10,4) NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'cargo',
    "unidades" DECIMAL(6,4) NOT NULL DEFAULT 1,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocCargo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocValorIndice" (
    "id" TEXT NOT NULL,
    "vigenciaDesde" TIMESTAMP(3) NOT NULL,
    "valorPorIndice" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocValorIndice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocTramoAntiguedad" (
    "id" TEXT NOT NULL,
    "aniosDesde" INTEGER NOT NULL,
    "porcentaje" DECIMAL(6,2) NOT NULL,

    CONSTRAINT "DocTramoAntiguedad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocConcepto" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "modoCalculo" TEXT NOT NULL,
    "aplicaANivel" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "DocConcepto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocValorConcepto" (
    "id" TEXT NOT NULL,
    "docConceptoId" TEXT NOT NULL,
    "vigenciaDesde" TIMESTAMP(3) NOT NULL,
    "valor" DECIMAL(14,4) NOT NULL,

    CONSTRAINT "DocValorConcepto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocPerfilDocente" (
    "id" TEXT NOT NULL,
    "legajoId" TEXT NOT NULL,
    "antiguedadAnios" INTEGER NOT NULL DEFAULT 0,
    "antiguedadDesde" TIMESTAMP(3),

    CONSTRAINT "DocPerfilDocente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocDesignacion" (
    "id" TEXT NOT NULL,
    "perfilDocenteId" TEXT NOT NULL,
    "docCargoId" TEXT NOT NULL,
    "establecimiento" TEXT,
    "zonaRural" BOOLEAN NOT NULL DEFAULT false,
    "fechaAlta" TIMESTAMP(3) NOT NULL,
    "fechaBaja" TIMESTAMP(3),
    "activa" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "DocDesignacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocLiquidacion" (
    "id" TEXT NOT NULL,
    "legajoId" TEXT NOT NULL,
    "periodo" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'abierta',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocLiquidacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocLiquidacionDetalle" (
    "id" TEXT NOT NULL,
    "docLiquidacionId" TEXT NOT NULL,
    "docDesignacionId" TEXT NOT NULL,
    "conceptoCodigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "importe" DECIMAL(14,2) NOT NULL,
    "tipo" TEXT NOT NULL,

    CONSTRAINT "DocLiquidacionDetalle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DocConcepto_codigo_key" ON "DocConcepto"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "DocPerfilDocente_legajoId_key" ON "DocPerfilDocente"("legajoId");

-- AddForeignKey
ALTER TABLE "DocValorConcepto" ADD CONSTRAINT "DocValorConcepto_docConceptoId_fkey" FOREIGN KEY ("docConceptoId") REFERENCES "DocConcepto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocPerfilDocente" ADD CONSTRAINT "DocPerfilDocente_legajoId_fkey" FOREIGN KEY ("legajoId") REFERENCES "Legajo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocDesignacion" ADD CONSTRAINT "DocDesignacion_perfilDocenteId_fkey" FOREIGN KEY ("perfilDocenteId") REFERENCES "DocPerfilDocente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocDesignacion" ADD CONSTRAINT "DocDesignacion_docCargoId_fkey" FOREIGN KEY ("docCargoId") REFERENCES "DocCargo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocLiquidacion" ADD CONSTRAINT "DocLiquidacion_legajoId_fkey" FOREIGN KEY ("legajoId") REFERENCES "Legajo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocLiquidacionDetalle" ADD CONSTRAINT "DocLiquidacionDetalle_docLiquidacionId_fkey" FOREIGN KEY ("docLiquidacionId") REFERENCES "DocLiquidacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocLiquidacionDetalle" ADD CONSTRAINT "DocLiquidacionDetalle_docDesignacionId_fkey" FOREIGN KEY ("docDesignacionId") REFERENCES "DocDesignacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
