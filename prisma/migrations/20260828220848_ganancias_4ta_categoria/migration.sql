-- CreateTable
CREATE TABLE "CargaFamiliarGanancias" (
    "id" TEXT NOT NULL,
    "legajoId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "descripcion" TEXT,
    "vigenciaDesde" TIMESTAMP(3) NOT NULL,
    "vigenciaHasta" TIMESTAMP(3),

    CONSTRAINT "CargaFamiliarGanancias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeduccionSiradig" (
    "id" TEXT NOT NULL,
    "legajoId" TEXT NOT NULL,
    "anio" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "descripcion" TEXT,
    "montoAnual" DOUBLE PRECISION NOT NULL,
    "vigente" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "DeduccionSiradig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TablaGananciasMensual" (
    "id" TEXT NOT NULL,
    "anio" INTEGER NOT NULL,
    "mes" INTEGER NOT NULL,
    "ganNoImponibleAcum" DOUBLE PRECISION NOT NULL,
    "deduccionEspecialAcum" DOUBLE PRECISION NOT NULL,
    "deduccionConyugeAcum" DOUBLE PRECISION NOT NULL,
    "deduccionHijoAcum" DOUBLE PRECISION NOT NULL,
    "deduccionHijoIncapAcum" DOUBLE PRECISION NOT NULL,
    "fuente" TEXT,

    CONSTRAINT "TablaGananciasMensual_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TramoGananciasMensual" (
    "id" TEXT NOT NULL,
    "tablaId" TEXT NOT NULL,
    "desde" DOUBLE PRECISION NOT NULL,
    "hasta" DOUBLE PRECISION,
    "montoFijo" DOUBLE PRECISION NOT NULL,
    "alicuota" DOUBLE PRECISION NOT NULL,
    "sobreExcedenteDe" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "TramoGananciasMensual_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaldoInicialGanancias" (
    "id" TEXT NOT NULL,
    "legajoId" TEXT NOT NULL,
    "anio" INTEGER NOT NULL,
    "ultimoMesConDatos" INTEGER NOT NULL,
    "gananciaAcumuladaPrevia" DOUBLE PRECISION NOT NULL,
    "retencionAcumuladaPrevia" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "SaldoInicialGanancias_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TablaGananciasMensual_anio_mes_key" ON "TablaGananciasMensual"("anio", "mes");

-- CreateIndex
CREATE UNIQUE INDEX "SaldoInicialGanancias_legajoId_anio_key" ON "SaldoInicialGanancias"("legajoId", "anio");

-- AddForeignKey
ALTER TABLE "CargaFamiliarGanancias" ADD CONSTRAINT "CargaFamiliarGanancias_legajoId_fkey" FOREIGN KEY ("legajoId") REFERENCES "Legajo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeduccionSiradig" ADD CONSTRAINT "DeduccionSiradig_legajoId_fkey" FOREIGN KEY ("legajoId") REFERENCES "Legajo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TramoGananciasMensual" ADD CONSTRAINT "TramoGananciasMensual_tablaId_fkey" FOREIGN KEY ("tablaId") REFERENCES "TablaGananciasMensual"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaldoInicialGanancias" ADD CONSTRAINT "SaldoInicialGanancias_legajoId_fkey" FOREIGN KEY ("legajoId") REFERENCES "Legajo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
