-- AlterTable
ALTER TABLE "Busqueda" ADD COLUMN     "premioReferido" TEXT,
ADD COLUMN     "referidos" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Candidato" ADD COLUMN     "premioReferidoEn" TIMESTAMP(3),
ADD COLUMN     "referidoPorId" TEXT,
ADD COLUMN     "referidoPorNombre" TEXT,
ADD COLUMN     "relacionReferido" TEXT;

-- CreateTable
CREATE TABLE "Evento" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT,
    "lugar" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL,
    "hora" TEXT,
    "centroCostoIds" TEXT[],
    "pideConfirmacion" BOOLEAN NOT NULL DEFAULT true,
    "limiteConfirmar" TIMESTAMP(3),
    "cupo" INTEGER,
    "maxAcompanantes" INTEGER NOT NULL DEFAULT 0,
    "estado" TEXT NOT NULL DEFAULT 'borrador',
    "creadoPor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publicadoEn" TIMESTAMP(3),

    CONSTRAINT "Evento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AsistenciaEvento" (
    "eventoId" TEXT NOT NULL,
    "legajoId" TEXT NOT NULL,
    "va" BOOLEAN NOT NULL,
    "acompanantes" INTEGER NOT NULL DEFAULT 0,
    "asistio" BOOLEAN,
    "respondioEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AsistenciaEvento_pkey" PRIMARY KEY ("eventoId","legajoId")
);

-- CreateIndex
CREATE INDEX "Evento_empresaId_fecha_idx" ON "Evento"("empresaId", "fecha");

-- CreateIndex
CREATE INDEX "AsistenciaEvento_legajoId_idx" ON "AsistenciaEvento"("legajoId");

-- CreateIndex
CREATE INDEX "Candidato_referidoPorId_idx" ON "Candidato"("referidoPorId");

-- AddForeignKey
ALTER TABLE "Evento" ADD CONSTRAINT "Evento_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AsistenciaEvento" ADD CONSTRAINT "AsistenciaEvento_eventoId_fkey" FOREIGN KEY ("eventoId") REFERENCES "Evento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AsistenciaEvento" ADD CONSTRAINT "AsistenciaEvento_legajoId_fkey" FOREIGN KEY ("legajoId") REFERENCES "Legajo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

