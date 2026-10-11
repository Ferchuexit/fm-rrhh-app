-- AlterTable
ALTER TABLE "Evento" ADD COLUMN     "categoria" TEXT NOT NULL DEFAULT 'social';

-- El módulo nuevo "Organigrama" (solo consulta) en los roles que vienen
-- armados (solo si todavía no lo tienen).
UPDATE "Rol" SET "permisos" = "permisos"::jsonb || '{"organigrama":"gestionar"}'::jsonb
  WHERE "id" = 'rol-rrhh-completo' AND NOT ("permisos"::jsonb ? 'organigrama');
UPDATE "Rol" SET "permisos" = "permisos"::jsonb || '{"organigrama":"ver"}'::jsonb
  WHERE "id" IN ('rol-supervisor', 'rol-solo-lectura') AND NOT ("permisos"::jsonb ? 'organigrama');
