-- CreateTable
CREATE TABLE "Encuesta" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT,
    "preguntas" JSONB NOT NULL,
    "centroCostoIds" TEXT[],
    "estado" TEXT NOT NULL DEFAULT 'borrador',
    "fechaCierre" TIMESTAMP(3) NOT NULL,
    "creadaPor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "abiertaEn" TIMESTAMP(3),
    "cerradaEn" TIMESTAMP(3),

    CONSTRAINT "Encuesta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParticipacionEncuesta" (
    "encuestaId" TEXT NOT NULL,
    "legajoId" TEXT NOT NULL,

    CONSTRAINT "ParticipacionEncuesta_pkey" PRIMARY KEY ("encuestaId","legajoId")
);

-- CreateTable
CREATE TABLE "RespuestaEncuesta" (
    "id" TEXT NOT NULL,
    "encuestaId" TEXT NOT NULL,
    "sector" TEXT,
    "respuestas" JSONB NOT NULL,

    CONSTRAINT "RespuestaEncuesta_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Encuesta_empresaId_estado_idx" ON "Encuesta"("empresaId", "estado");

-- CreateIndex
CREATE INDEX "RespuestaEncuesta_encuestaId_idx" ON "RespuestaEncuesta"("encuestaId");

-- AddForeignKey
ALTER TABLE "Encuesta" ADD CONSTRAINT "Encuesta_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParticipacionEncuesta" ADD CONSTRAINT "ParticipacionEncuesta_encuestaId_fkey" FOREIGN KEY ("encuestaId") REFERENCES "Encuesta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParticipacionEncuesta" ADD CONSTRAINT "ParticipacionEncuesta_legajoId_fkey" FOREIGN KEY ("legajoId") REFERENCES "Legajo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RespuestaEncuesta" ADD CONSTRAINT "RespuestaEncuesta_encuestaId_fkey" FOREIGN KEY ("encuestaId") REFERENCES "Encuesta"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- El módulo nuevo "Encuestas de clima" en los roles que vienen armados
-- (solo si todavía no lo tienen). El Supervisor NO lo recibe.
UPDATE "Rol" SET "permisos" = "permisos"::jsonb || '{"encuestas":"gestionar"}'::jsonb
  WHERE "id" = 'rol-rrhh-completo' AND NOT ("permisos"::jsonb ? 'encuestas');
UPDATE "Rol" SET "permisos" = "permisos"::jsonb || '{"encuestas":"ver"}'::jsonb
  WHERE "id" = 'rol-solo-lectura' AND NOT ("permisos"::jsonb ? 'encuestas');
