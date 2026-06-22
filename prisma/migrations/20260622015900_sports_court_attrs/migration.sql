-- CreateEnum
CREATE TYPE "Sport" AS ENUM ('FUTEBOL', 'VOLEI', 'TENIS', 'BEACH_TENNIS', 'FUTEVOLEI', 'BASQUETE');

-- CreateEnum
CREATE TYPE "Surface" AS ENUM ('AREIA', 'SAIBRO', 'SINTETICO', 'CIMENTO', 'GRAMA');

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "sport" "Sport";

-- AlterTable
ALTER TABLE "resources" ADD COLUMN     "pricePerHour" INTEGER,
ADD COLUMN     "sports" "Sport"[],
ADD COLUMN     "surface" "Surface" NOT NULL DEFAULT 'SINTETICO';
