-- AlterTable
ALTER TABLE "Legajo" ADD COLUMN     "ocultarCumple" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ValorEmpresa" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "emoji" TEXT NOT NULL DEFAULT '⭐',
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ValorEmpresa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reconocimiento" (
    "id" TEXT NOT NULL,
    "legajoId" TEXT NOT NULL,
    "emisorId" TEXT,
    "emisorNombre" TEXT NOT NULL,
    "valor" TEXT NOT NULL,
    "emoji" TEXT NOT NULL DEFAULT '⭐',
    "mensaje" TEXT NOT NULL,
    "oculto" BOOLEAN NOT NULL DEFAULT false,
    "ocultoPor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Reconocimiento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AplausoReconocimiento" (
    "reconocimientoId" TEXT NOT NULL,
    "legajoId" TEXT NOT NULL,

    CONSTRAINT "AplausoReconocimiento_pkey" PRIMARY KEY ("reconocimientoId","legajoId")
);

-- CreateIndex
CREATE UNIQUE INDEX "ValorEmpresa_empresaId_nombre_key" ON "ValorEmpresa"("empresaId", "nombre");

-- CreateIndex
CREATE INDEX "Reconocimiento_legajoId_createdAt_idx" ON "Reconocimiento"("legajoId", "createdAt");

-- CreateIndex
CREATE INDEX "Reconocimiento_emisorId_createdAt_idx" ON "Reconocimiento"("emisorId", "createdAt");

-- AddForeignKey
ALTER TABLE "ValorEmpresa" ADD CONSTRAINT "ValorEmpresa_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reconocimiento" ADD CONSTRAINT "Reconocimiento_legajoId_fkey" FOREIGN KEY ("legajoId") REFERENCES "Legajo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AplausoReconocimiento" ADD CONSTRAINT "AplausoReconocimiento_reconocimientoId_fkey" FOREIGN KEY ("reconocimientoId") REFERENCES "Reconocimiento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AplausoReconocimiento" ADD CONSTRAINT "AplausoReconocimiento_legajoId_fkey" FOREIGN KEY ("legajoId") REFERENCES "Legajo"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- El módulo nuevo "Cultura" en los roles que vienen armados (solo si
-- todavía no lo tienen).
UPDATE "Rol" SET "permisos" = "permisos"::jsonb || '{"cultura":"gestionar"}'::jsonb
  WHERE "id" IN ('rol-rrhh-completo', 'rol-supervisor') AND NOT ("permisos"::jsonb ? 'cultura');
UPDATE "Rol" SET "permisos" = "permisos"::jsonb || '{"cultura":"ver"}'::jsonb
  WHERE "id" = 'rol-solo-lectura' AND NOT ("permisos"::jsonb ? 'cultura');
