-- CreateTable
CREATE TABLE "AcuerdoBancoHoras" (
    "id" TEXT NOT NULL,
    "legajoId" TEXT NOT NULL,
    "desde" TIMESTAMP(3) NOT NULL,
    "hasta" TIMESTAMP(3),
    "origen" TEXT NOT NULL DEFAULT 'individual',
    "topeHoras" INTEGER,
    "plazoDias" INTEGER,
    "equivalencia" TEXT NOT NULL DEFAULT 'recargo',
    "observaciones" TEXT,
    "aceptadoEn" TIMESTAMP(3),
    "aceptadoIp" TEXT,
    "enPapel" BOOLEAN NOT NULL DEFAULT false,
    "finalizadoEn" TIMESTAMP(3),
    "creadoPor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AcuerdoBancoHoras_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MovimientoBancoHoras" (
    "id" TEXT NOT NULL,
    "legajoId" TEXT NOT NULL,
    "acuerdoId" TEXT,
    "tipo" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "minutos" INTEGER NOT NULL,
    "minutosTrabajados" INTEGER,
    "recargo" INTEGER,
    "estado" TEXT NOT NULL DEFAULT 'aprobado',
    "origen" TEXT NOT NULL DEFAULT 'manual',
    "motivo" TEXT,
    "novedadId" TEXT,
    "cargadoPor" TEXT,
    "resueltoPor" TEXT,
    "resueltoEn" TIMESTAMP(3),
    "anulado" BOOLEAN NOT NULL DEFAULT false,
    "motivoAnulacion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MovimientoBancoHoras_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AcuerdoBancoHoras_legajoId_idx" ON "AcuerdoBancoHoras"("legajoId");

-- CreateIndex
CREATE INDEX "MovimientoBancoHoras_legajoId_fecha_idx" ON "MovimientoBancoHoras"("legajoId", "fecha");

-- AddForeignKey
ALTER TABLE "AcuerdoBancoHoras" ADD CONSTRAINT "AcuerdoBancoHoras_legajoId_fkey" FOREIGN KEY ("legajoId") REFERENCES "Legajo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoBancoHoras" ADD CONSTRAINT "MovimientoBancoHoras_legajoId_fkey" FOREIGN KEY ("legajoId") REFERENCES "Legajo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoBancoHoras" ADD CONSTRAINT "MovimientoBancoHoras_acuerdoId_fkey" FOREIGN KEY ("acuerdoId") REFERENCES "AcuerdoBancoHoras"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- El módulo nuevo "Banco de horas" en los roles que vienen armados (solo si
-- todavía no lo tienen). El Supervisor lo mira: ve el saldo de su gente
-- para organizar los francos, pero acreditar y pagar es de RR.HH.
UPDATE "Rol" SET "permisos" = "permisos"::jsonb || '{"banco_horas":"gestionar"}'::jsonb
  WHERE "id" = 'rol-rrhh-completo' AND NOT ("permisos"::jsonb ? 'banco_horas');
UPDATE "Rol" SET "permisos" = "permisos"::jsonb || '{"banco_horas":"ver"}'::jsonb
  WHERE "id" IN ('rol-supervisor', 'rol-solo-lectura') AND NOT ("permisos"::jsonb ? 'banco_horas');
