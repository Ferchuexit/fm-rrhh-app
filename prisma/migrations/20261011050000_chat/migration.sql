-- AlterTable
ALTER TABLE "empresas" ADD COLUMN     "chatEntreEmpleados" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "Conversacion" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "nombre" TEXT,
    "descripcion" TEXT,
    "emoji" TEXT NOT NULL DEFAULT '💬',
    "todos" BOOLEAN NOT NULL DEFAULT false,
    "centroCostoIds" TEXT[],
    "soloAnuncios" BOOLEAN NOT NULL DEFAULT false,
    "empleadoId" TEXT,
    "clave" TEXT,
    "archivada" BOOLEAN NOT NULL DEFAULT false,
    "leidoRRHHEn" TIMESTAMP(3),
    "ultimoMensajeEn" TIMESTAMP(3),
    "ultimoTexto" TEXT,
    "creadoPor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Conversacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MiembroConversacion" (
    "conversacionId" TEXT NOT NULL,
    "legajoId" TEXT NOT NULL,
    "agregado" BOOLEAN NOT NULL DEFAULT true,
    "admin" BOOLEAN NOT NULL DEFAULT false,
    "leidoHasta" TIMESTAMP(3),

    CONSTRAINT "MiembroConversacion_pkey" PRIMARY KEY ("conversacionId","legajoId")
);

-- CreateTable
CREATE TABLE "MensajeChat" (
    "id" TEXT NOT NULL,
    "conversacionId" TEXT NOT NULL,
    "autorId" TEXT,
    "autorNombre" TEXT NOT NULL,
    "deRRHH" BOOLEAN NOT NULL DEFAULT false,
    "texto" TEXT NOT NULL,
    "borradoEn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MensajeChat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Conversacion_clave_key" ON "Conversacion"("clave");

-- CreateIndex
CREATE INDEX "Conversacion_empresaId_tipo_ultimoMensajeEn_idx" ON "Conversacion"("empresaId", "tipo", "ultimoMensajeEn");

-- CreateIndex
CREATE INDEX "MiembroConversacion_legajoId_idx" ON "MiembroConversacion"("legajoId");

-- CreateIndex
CREATE INDEX "MensajeChat_conversacionId_createdAt_idx" ON "MensajeChat"("conversacionId", "createdAt");

-- AddForeignKey
ALTER TABLE "Conversacion" ADD CONSTRAINT "Conversacion_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MiembroConversacion" ADD CONSTRAINT "MiembroConversacion_conversacionId_fkey" FOREIGN KEY ("conversacionId") REFERENCES "Conversacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MiembroConversacion" ADD CONSTRAINT "MiembroConversacion_legajoId_fkey" FOREIGN KEY ("legajoId") REFERENCES "Legajo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MensajeChat" ADD CONSTRAINT "MensajeChat_conversacionId_fkey" FOREIGN KEY ("conversacionId") REFERENCES "Conversacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- El módulo nuevo "Chat interno" en los roles que vienen armados (solo si
-- todavía no lo tienen). El Supervisor no lo recibe: las consultas a
-- RR.HH. son de toda la empresa.
UPDATE "Rol" SET "permisos" = "permisos"::jsonb || '{"chat":"gestionar"}'::jsonb
  WHERE "id" = 'rol-rrhh-completo' AND NOT ("permisos"::jsonb ? 'chat');
UPDATE "Rol" SET "permisos" = "permisos"::jsonb || '{"chat":"ver"}'::jsonb
  WHERE "id" = 'rol-solo-lectura' AND NOT ("permisos"::jsonb ? 'chat');
