-- CreateTable
CREATE TABLE "Turno" (
    "id" TEXT NOT NULL,
    "legajoId" TEXT,
    "convenioId" TEXT,
    "diaSemana" INTEGER NOT NULL,
    "horaIngreso" TEXT NOT NULL,
    "horaSalida" TEXT NOT NULL,
    "vigenciaDesde" TIMESTAMP(3) NOT NULL,
    "vigenciaHasta" TIMESTAMP(3),

    CONSTRAINT "Turno_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TurnoExcepcion" (
    "id" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "legajoId" TEXT,
    "convenioId" TEXT,
    "horaIngreso" TEXT,
    "horaSalida" TEXT,
    "esNoLaborable" BOOLEAN NOT NULL DEFAULT false,
    "motivo" TEXT,

    CONSTRAINT "TurnoExcepcion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Fichada" (
    "id" TEXT NOT NULL,
    "legajoId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "hora" TEXT NOT NULL,
    "origen" TEXT NOT NULL DEFAULT 'reloj',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Fichada_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AsistenciaDia" (
    "id" TEXT NOT NULL,
    "legajoId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "estado" TEXT NOT NULL,
    "horaIngresoReal" TEXT,
    "horaEgresoReal" TEXT,
    "minutosTarde" INTEGER,
    "minutosSalidaAnticipada" INTEGER,
    "origen" TEXT NOT NULL DEFAULT 'automatico',
    "motivoManual" TEXT,
    "novedadGeneradaId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AsistenciaDia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Fichada_legajoId_fecha_idx" ON "Fichada"("legajoId", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "AsistenciaDia_legajoId_fecha_key" ON "AsistenciaDia"("legajoId", "fecha");

-- AddForeignKey
ALTER TABLE "Turno" ADD CONSTRAINT "Turno_legajoId_fkey" FOREIGN KEY ("legajoId") REFERENCES "Legajo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Turno" ADD CONSTRAINT "Turno_convenioId_fkey" FOREIGN KEY ("convenioId") REFERENCES "Convenio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TurnoExcepcion" ADD CONSTRAINT "TurnoExcepcion_legajoId_fkey" FOREIGN KEY ("legajoId") REFERENCES "Legajo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TurnoExcepcion" ADD CONSTRAINT "TurnoExcepcion_convenioId_fkey" FOREIGN KEY ("convenioId") REFERENCES "Convenio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fichada" ADD CONSTRAINT "Fichada_legajoId_fkey" FOREIGN KEY ("legajoId") REFERENCES "Legajo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AsistenciaDia" ADD CONSTRAINT "AsistenciaDia_legajoId_fkey" FOREIGN KEY ("legajoId") REFERENCES "Legajo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
