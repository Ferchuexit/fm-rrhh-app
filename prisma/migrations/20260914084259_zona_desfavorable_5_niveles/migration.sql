/*
  Warnings:

  - You are about to drop the column `zonaRural` on the `DocDesignacion` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "DocDesignacion" DROP COLUMN "zonaRural",
ADD COLUMN     "zonaDesfavorabilidad" INTEGER;

-- CreateTable
CREATE TABLE "DocTramoZona" (
    "id" TEXT NOT NULL,
    "nivel" INTEGER NOT NULL,
    "porcentaje" DECIMAL(6,2) NOT NULL,

    CONSTRAINT "DocTramoZona_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DocTramoZona_nivel_key" ON "DocTramoZona"("nivel");
