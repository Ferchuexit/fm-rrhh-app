/*
  Warnings:

  - You are about to drop the column `gananciaAcumuladaPrevia` on the `SaldoInicialGanancias` table. All the data in the column will be lost.
  - Added the required column `aportesAcumuladoPrevio` to the `SaldoInicialGanancias` table without a default value. This is not possible if the table is not empty.
  - Added the required column `brutoAcumuladoPrevio` to the `SaldoInicialGanancias` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "SaldoInicialGanancias" DROP COLUMN "gananciaAcumuladaPrevia",
ADD COLUMN     "aportesAcumuladoPrevio" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "brutoAcumuladoPrevio" DOUBLE PRECISION NOT NULL;
