-- CreateTable
CREATE TABLE "AccesoPortal" (
    "id" TEXT NOT NULL,
    "legajoId" TEXT NOT NULL,
    "pinHash" TEXT NOT NULL,
    "debeCambiarPin" BOOLEAN NOT NULL DEFAULT true,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "intentosFallidos" INTEGER NOT NULL DEFAULT 0,
    "bloqueadoHasta" TIMESTAMP(3),
    "ultimoIngreso" TIMESTAMP(3),
    "generadoPor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccesoPortal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReciboDigital" (
    "id" TEXT NOT NULL,
    "liquidacionId" TEXT NOT NULL,
    "legajoId" TEXT NOT NULL,
    "primeraVistaEn" TIMESTAMP(3),
    "firma" TEXT,
    "firmadoEn" TIMESTAMP(3),
    "observacion" TEXT,
    "ipFirma" TEXT,
    "userAgentFirma" TEXT,
    "hashContenido" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReciboDigital_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AccesoPortal_legajoId_key" ON "AccesoPortal"("legajoId");

-- CreateIndex
CREATE UNIQUE INDEX "ReciboDigital_liquidacionId_key" ON "ReciboDigital"("liquidacionId");

-- CreateIndex
CREATE INDEX "ReciboDigital_legajoId_idx" ON "ReciboDigital"("legajoId");

-- AddForeignKey
ALTER TABLE "AccesoPortal" ADD CONSTRAINT "AccesoPortal_legajoId_fkey" FOREIGN KEY ("legajoId") REFERENCES "Legajo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReciboDigital" ADD CONSTRAINT "ReciboDigital_liquidacionId_fkey" FOREIGN KEY ("liquidacionId") REFERENCES "Liquidacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReciboDigital" ADD CONSTRAINT "ReciboDigital_legajoId_fkey" FOREIGN KEY ("legajoId") REFERENCES "Legajo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
