-- AlterTable
ALTER TABLE "UsuarioEmpresa" ADD COLUMN     "rolId" TEXT;

-- CreateTable
CREATE TABLE "Rol" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "permisos" JSONB NOT NULL,
    "predefinido" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Rol_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Rol_nombre_key" ON "Rol"("nombre");

-- AddForeignKey
ALTER TABLE "UsuarioEmpresa" ADD CONSTRAINT "UsuarioEmpresa_rolId_fkey" FOREIGN KEY ("rolId") REFERENCES "Rol"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Los 4 roles que vienen armados (lib/permisos.ts, ROLES_PREDEFINIDOS). Van en la
-- migración para que existan apenas se aplica, sin correr ningún script aparte.
INSERT INTO "Rol" ("id", "nombre", "descripcion", "permisos", "predefinido", "updatedAt") VALUES ('rol-rrhh-completo', 'RR.HH. completo', 'Todo el trabajo de RR.HH. y liquidación de la empresa, sin tocar la configuración del cálculo.', '{"legajos":"gestionar","novedades":"gestionar","liquidaciones":"gestionar","cierre":"gestionar","exportar":"gestionar","reportes":"gestionar","noticias":"gestionar","legajo_digital":"gestionar","vacaciones":"gestionar","firmas_recibos":"gestionar","asistencia":"gestionar","dispositivos":"gestionar","accesos_portal":"gestionar"}'::jsonb, true, CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "Rol" ("id", "nombre", "descripcion", "permisos", "predefinido", "updatedAt") VALUES ('rol-liquidador', 'Liquidador', 'Liquida sueldos de punta a punta. De Gestión Humana solo ve asistencia, vacaciones y firmas.', '{"legajos":"gestionar","novedades":"gestionar","liquidaciones":"gestionar","cierre":"gestionar","exportar":"gestionar","reportes":"ver","asistencia":"ver","vacaciones":"ver","firmas_recibos":"ver"}'::jsonb, true, CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "Rol" ("id", "nombre", "descripcion", "permisos", "predefinido", "updatedAt") VALUES ('rol-supervisor', 'Supervisor', 'Gestiona a la gente (asistencia, vacaciones, legajo digital, noticias) sin ver sueldos ni liquidaciones.', '{"legajos":"ver","asistencia":"gestionar","vacaciones":"gestionar","legajo_digital":"gestionar","noticias":"gestionar","accesos_portal":"gestionar"}'::jsonb, true, CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "Rol" ("id", "nombre", "descripcion", "permisos", "predefinido", "updatedAt") VALUES ('rol-solo-lectura', 'Solo lectura', 'Ve todo lo de la empresa (menos la configuración) sin poder modificar nada.', '{"legajos":"ver","novedades":"ver","liquidaciones":"ver","cierre":"ver","exportar":"ver","reportes":"ver","noticias":"ver","legajo_digital":"ver","vacaciones":"ver","firmas_recibos":"ver","asistencia":"ver","accesos_portal":"ver"}'::jsonb, true, CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
