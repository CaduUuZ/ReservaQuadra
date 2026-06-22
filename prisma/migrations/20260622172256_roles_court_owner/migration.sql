-- CreateEnum
CREATE TYPE "Role" AS ENUM ('JOGADOR', 'EMPRESA');

-- AlterTable
ALTER TABLE "resources" ADD COLUMN     "owner_id" UUID;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "role" "Role" NOT NULL DEFAULT 'JOGADOR';

-- CreateIndex
CREATE INDEX "resources_owner_id_idx" ON "resources"("owner_id");

-- AddForeignKey
ALTER TABLE "resources" ADD CONSTRAINT "resources_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
