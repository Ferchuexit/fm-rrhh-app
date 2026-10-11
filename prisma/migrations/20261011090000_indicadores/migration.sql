-- El módulo nuevo "Indicadores de Gestión Humana" en los roles que vienen
-- armados (solo si todavía no lo tienen). No cambia ninguna tabla.
UPDATE "Rol" SET "permisos" = "permisos"::jsonb || '{"indicadores":"gestionar"}'::jsonb
  WHERE "id" = 'rol-rrhh-completo' AND NOT ("permisos"::jsonb ? 'indicadores');
UPDATE "Rol" SET "permisos" = "permisos"::jsonb || '{"indicadores":"ver"}'::jsonb
  WHERE "id" = 'rol-solo-lectura' AND NOT ("permisos"::jsonb ? 'indicadores');
