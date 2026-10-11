-- AlterTable
ALTER TABLE "Legajo" ADD COLUMN     "puestoId" TEXT;

-- CreateTable
CREATE TABLE "Puesto" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "centroCostoId" TEXT,
    "reportaAId" TEXT,
    "mision" TEXT,
    "tareas" TEXT,
    "requisitos" TEXT,
    "condiciones" TEXT,
    "habilidades" JSONB NOT NULL DEFAULT '[]',
    "dotacion" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Puesto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Busqueda" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "puestoId" TEXT,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "requisitos" TEXT,
    "ofrecemos" TEXT,
    "lugar" TEXT,
    "vacantes" INTEGER NOT NULL DEFAULT 1,
    "publica" BOOLEAN NOT NULL DEFAULT true,
    "interna" BOOLEAN NOT NULL DEFAULT false,
    "estado" TEXT NOT NULL DEFAULT 'borrador',
    "motivoCierre" TEXT,
    "creadaPor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "abiertaEn" TIMESTAMP(3),
    "cerradaEn" TIMESTAMP(3),

    CONSTRAINT "Busqueda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Candidato" (
    "id" TEXT NOT NULL,
    "busquedaId" TEXT NOT NULL,
    "apellido" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT,
    "telefono" TEXT,
    "localidad" TEXT,
    "mensaje" TEXT,
    "fuente" TEXT NOT NULL DEFAULT 'web',
    "empleadoId" TEXT,
    "cvNombre" TEXT,
    "cvKey" TEXT,
    "cvBase64" TEXT,
    "etapa" TEXT NOT NULL DEFAULT 'postulado',
    "etapaDesde" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "motivoDescarte" TEXT,
    "puntaje" INTEGER,
    "notas" TEXT,
    "consentimientoEn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Candidato_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Puesto_empresaId_nombre_key" ON "Puesto"("empresaId", "nombre");

-- CreateIndex
CREATE INDEX "Busqueda_empresaId_estado_idx" ON "Busqueda"("empresaId", "estado");

-- CreateIndex
CREATE INDEX "Candidato_busquedaId_etapa_idx" ON "Candidato"("busquedaId", "etapa");

-- CreateIndex
CREATE INDEX "Candidato_email_idx" ON "Candidato"("email");

-- AddForeignKey
ALTER TABLE "Legajo" ADD CONSTRAINT "Legajo_puestoId_fkey" FOREIGN KEY ("puestoId") REFERENCES "Puesto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Puesto" ADD CONSTRAINT "Puesto_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Puesto" ADD CONSTRAINT "Puesto_centroCostoId_fkey" FOREIGN KEY ("centroCostoId") REFERENCES "CentroCosto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Puesto" ADD CONSTRAINT "Puesto_reportaAId_fkey" FOREIGN KEY ("reportaAId") REFERENCES "Puesto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Busqueda" ADD CONSTRAINT "Busqueda_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Busqueda" ADD CONSTRAINT "Busqueda_puestoId_fkey" FOREIGN KEY ("puestoId") REFERENCES "Puesto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Candidato" ADD CONSTRAINT "Candidato_busquedaId_fkey" FOREIGN KEY ("busquedaId") REFERENCES "Busqueda"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- El módulo nuevo "Puestos y reclutamiento" en los roles que vienen
-- armados (solo si todavía no lo tienen). El Supervisor NO lo recibe.
UPDATE "Rol" SET "permisos" = "permisos"::jsonb || '{"reclutamiento":"gestionar"}'::jsonb
  WHERE "id" = 'rol-rrhh-completo' AND NOT ("permisos"::jsonb ? 'reclutamiento');
UPDATE "Rol" SET "permisos" = "permisos"::jsonb || '{"reclutamiento":"ver"}'::jsonb
  WHERE "id" = 'rol-solo-lectura' AND NOT ("permisos"::jsonb ? 'reclutamiento');
