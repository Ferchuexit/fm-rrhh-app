-- CreateTable
CREATE TABLE "Feriado" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "Feriado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CambioDeTurno" (
    "id" TEXT NOT NULL,
    "legajoId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "tipo" TEXT NOT NULL,
    "ingreso" TEXT,
    "salida" TEXT,
    "motivo" TEXT,
    "cargadoPor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CambioDeTurno_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Feriado_empresaId_fecha_key" ON "Feriado"("empresaId", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "CambioDeTurno_legajoId_fecha_key" ON "CambioDeTurno"("legajoId", "fecha");

-- AddForeignKey
ALTER TABLE "Feriado" ADD CONSTRAINT "Feriado_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CambioDeTurno" ADD CONSTRAINT "CambioDeTurno_legajoId_fkey" FOREIGN KEY ("legajoId") REFERENCES "Legajo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
