-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resources" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" UUID NOT NULL,
    "resource_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "starts_at" TIMESTAMPTZ(6) NOT NULL,
    "ends_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "bookings_resource_id_idx" ON "bookings"("resource_id");

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "resources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================================
-- PARTE MANUAL (adicionada à mão) — o núcleo técnico do projeto.
-- ============================================================================

-- A extensão btree_gist permite usar operadores de igualdade (=) sobre tipos
-- escalares (como UUID) dentro de um índice GiST. Sem ela, "resource_id WITH ="
-- na constraint abaixo não é aceito. A imagem postgres:16 já traz a extensão.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Constraint de exclusão: o banco PROÍBE fisicamente duas reservas da mesma
-- quadra com horários que se sobreponham. Não depende de código de aplicação.
--   resource_id WITH =                          -> só compara reservas da MESMA quadra
--   tstzrange(starts_at, ends_at, '[)') WITH && -> e cujos intervalos se cruzam (&&)
--   '[)' = início inclusivo, fim exclusivo -> 10h-11h e 11h-12h NÃO colidem
-- Em caso de conflito, o Postgres lança o erro 23P01 (exclusion_violation),
-- que na Fase 2 vamos capturar e transformar num HTTP 409 limpo.
ALTER TABLE "bookings"
  ADD CONSTRAINT "bookings_no_overlap"
  EXCLUDE USING gist (
    "resource_id" WITH =,
    tstzrange("starts_at", "ends_at", '[)') WITH &&
  );
