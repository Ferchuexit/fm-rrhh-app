-- AlterTable
ALTER TABLE "empresas" ADD COLUMN     "muroConAprobacion" BOOLEAN NOT NULL DEFAULT false;


-- CreateTable
CREATE TABLE "Publicacion" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "autorId" TEXT,
    "autorNombre" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "fotoKey" TEXT,
    "fotoBase64" TEXT,
    "fotoMime" TEXT,
    "pendiente" BOOLEAN NOT NULL DEFAULT false,
    "oculto" BOOLEAN NOT NULL DEFAULT false,
    "ocultoPor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Publicacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeGustaPublicacion" (
    "publicacionId" TEXT NOT NULL,
    "legajoId" TEXT NOT NULL,

    CONSTRAINT "MeGustaPublicacion_pkey" PRIMARY KEY ("publicacionId","legajoId")
);

-- CreateTable
CREATE TABLE "ComentarioPublicacion" (
    "id" TEXT NOT NULL,
    "publicacionId" TEXT NOT NULL,
    "autorId" TEXT,
    "autorNombre" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "oculto" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComentarioPublicacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Publicacion_empresaId_createdAt_idx" ON "Publicacion"("empresaId", "createdAt");

-- CreateIndex
CREATE INDEX "ComentarioPublicacion_publicacionId_createdAt_idx" ON "ComentarioPublicacion"("publicacionId", "createdAt");

-- AddForeignKey
ALTER TABLE "Publicacion" ADD CONSTRAINT "Publicacion_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeGustaPublicacion" ADD CONSTRAINT "MeGustaPublicacion_publicacionId_fkey" FOREIGN KEY ("publicacionId") REFERENCES "Publicacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeGustaPublicacion" ADD CONSTRAINT "MeGustaPublicacion_legajoId_fkey" FOREIGN KEY ("legajoId") REFERENCES "Legajo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComentarioPublicacion" ADD CONSTRAINT "ComentarioPublicacion_publicacionId_fkey" FOREIGN KEY ("publicacionId") REFERENCES "Publicacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- El módulo nuevo "Agenda" en los roles que vienen armados (solo si
-- todavía no lo tienen).
UPDATE "Rol" SET "permisos" = "permisos"::jsonb || '{"agenda":"gestionar"}'::jsonb
  WHERE "id" = 'rol-rrhh-completo' AND NOT ("permisos"::jsonb ? 'agenda');
UPDATE "Rol" SET "permisos" = "permisos"::jsonb || '{"agenda":"ver"}'::jsonb
  WHERE "id" IN ('rol-supervisor', 'rol-solo-lectura') AND NOT ("permisos"::jsonb ? 'agenda');
