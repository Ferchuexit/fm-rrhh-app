-- CreateTable
CREATE TABLE "ElementoEpp" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipoModelo" TEXT,
    "marca" TEXT,
    "certificado" BOOLEAN NOT NULL DEFAULT true,
    "vidaUtilDias" INTEGER,
    "talle" TEXT,
    "paraTodos" BOOLEAN NOT NULL DEFAULT false,
    "centroCostoIds" TEXT[],
    "puestoIds" TEXT[],
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ElementoEpp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EntregaEpp" (
    "id" TEXT NOT NULL,
    "legajoId" TEXT NOT NULL,
    "elementoId" TEXT,
    "producto" TEXT NOT NULL,
    "tipoModelo" TEXT,
    "marca" TEXT,
    "certificado" BOOLEAN NOT NULL DEFAULT true,
    "cantidad" INTEGER NOT NULL DEFAULT 1,
    "talle" TEXT,
    "fechaEntrega" TIMESTAMP(3) NOT NULL,
    "vence" TIMESTAMP(3),
    "motivo" TEXT NOT NULL DEFAULT 'reposicion',
    "observacion" TEXT,
    "entregadoPor" TEXT,
    "firmadoEn" TIMESTAMP(3),
    "firmaIp" TEXT,
    "enPapel" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EntregaEpp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ElementoEpp_empresaId_nombre_key" ON "ElementoEpp"("empresaId", "nombre");

-- CreateIndex
CREATE INDEX "EntregaEpp_legajoId_fechaEntrega_idx" ON "EntregaEpp"("legajoId", "fechaEntrega");

-- CreateIndex
CREATE INDEX "EntregaEpp_elementoId_idx" ON "EntregaEpp"("elementoId");

-- AddForeignKey
ALTER TABLE "ElementoEpp" ADD CONSTRAINT "ElementoEpp_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntregaEpp" ADD CONSTRAINT "EntregaEpp_legajoId_fkey" FOREIGN KEY ("legajoId") REFERENCES "Legajo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntregaEpp" ADD CONSTRAINT "EntregaEpp_elementoId_fkey" FOREIGN KEY ("elementoId") REFERENCES "ElementoEpp"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- El módulo nuevo "EPP y ropa de trabajo" en los roles que vienen armados
-- (solo si todavía no lo tienen). El Supervisor lo recibe: es quien
-- entrega en planta, y solo a la gente de su sector.
UPDATE "Rol" SET "permisos" = "permisos"::jsonb || '{"epp":"gestionar"}'::jsonb
  WHERE "id" IN ('rol-rrhh-completo', 'rol-supervisor') AND NOT ("permisos"::jsonb ? 'epp');
UPDATE "Rol" SET "permisos" = "permisos"::jsonb || '{"epp":"ver"}'::jsonb
  WHERE "id" = 'rol-solo-lectura' AND NOT ("permisos"::jsonb ? 'epp');
