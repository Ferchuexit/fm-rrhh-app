-- AlterTable
ALTER TABLE "empresas" ADD COLUMN     "motivosReclamo" JSONB;

-- CreateTable
CREATE TABLE "ReclamoHaberes" (
    "id" TEXT NOT NULL,
    "legajoId" TEXT NOT NULL,
    "liquidacionId" TEXT,
    "periodoNombre" TEXT,
    "items" JSONB NOT NULL,
    "comentario" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'pendiente',
    "respuesta" TEXT,
    "periodoAjuste" TEXT,
    "novedadIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "resueltoPor" TEXT,
    "resueltoEn" TIMESTAMP(3),
    "vistoEn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReclamoHaberes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReclamoHaberes_legajoId_idx" ON "ReclamoHaberes"("legajoId");

-- AddForeignKey
ALTER TABLE "ReclamoHaberes" ADD CONSTRAINT "ReclamoHaberes_legajoId_fkey" FOREIGN KEY ("legajoId") REFERENCES "Legajo"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- El módulo nuevo "Reclamos de haberes" en los roles que vienen armados.
-- El Supervisor no: son datos de sueldo.
UPDATE "Rol" SET "permisos" = "permisos"::jsonb || '{"reclamos":"gestionar"}'::jsonb
  WHERE "id" = 'rol-rrhh-completo' AND NOT ("permisos"::jsonb ? 'reclamos');
UPDATE "Rol" SET "permisos" = "permisos"::jsonb || '{"reclamos":"ver"}'::jsonb
  WHERE "id" = 'rol-solo-lectura' AND NOT ("permisos"::jsonb ? 'reclamos');
