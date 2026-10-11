-- CreateTable
CREATE TABLE "ArticuloBiblioteca" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "contenido" TEXT,
    "enlace" TEXT,
    "archivoNombre" TEXT,
    "archivoKey" TEXT,
    "archivoBase64" TEXT,
    "archivoMime" TEXT,
    "archivoTexto" TEXT,
    "centroCostoIds" TEXT[],
    "destacado" BOOLEAN NOT NULL DEFAULT false,
    "estado" TEXT NOT NULL DEFAULT 'borrador',
    "creadoPor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publicadoEn" TIMESTAMP(3),

    CONSTRAINT "ArticuloBiblioteca_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LecturaBiblioteca" (
    "articuloId" TEXT NOT NULL,
    "legajoId" TEXT NOT NULL,
    "leidoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LecturaBiblioteca_pkey" PRIMARY KEY ("articuloId","legajoId")
);

-- CreateIndex
CREATE INDEX "ArticuloBiblioteca_empresaId_estado_categoria_idx" ON "ArticuloBiblioteca"("empresaId", "estado", "categoria");

-- CreateIndex
CREATE INDEX "LecturaBiblioteca_legajoId_idx" ON "LecturaBiblioteca"("legajoId");

-- AddForeignKey
ALTER TABLE "ArticuloBiblioteca" ADD CONSTRAINT "ArticuloBiblioteca_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LecturaBiblioteca" ADD CONSTRAINT "LecturaBiblioteca_articuloId_fkey" FOREIGN KEY ("articuloId") REFERENCES "ArticuloBiblioteca"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LecturaBiblioteca" ADD CONSTRAINT "LecturaBiblioteca_legajoId_fkey" FOREIGN KEY ("legajoId") REFERENCES "Legajo"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- El módulo nuevo "Librería de conocimiento" en los roles que vienen
-- armados (solo si todavía no lo tienen).
UPDATE "Rol" SET "permisos" = "permisos"::jsonb || '{"biblioteca":"gestionar"}'::jsonb
  WHERE "id" = 'rol-rrhh-completo' AND NOT ("permisos"::jsonb ? 'biblioteca');
UPDATE "Rol" SET "permisos" = "permisos"::jsonb || '{"biblioteca":"ver"}'::jsonb
  WHERE "id" IN ('rol-supervisor', 'rol-solo-lectura') AND NOT ("permisos"::jsonb ? 'biblioteca');
