-- CreateTable
CREATE TABLE "participants" (
    "id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "user_id" UUID,
    "guest_name" TEXT,
    "team" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "participants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "participants_booking_id_idx" ON "participants"("booking_id");

-- AddForeignKey
ALTER TABLE "participants" ADD CONSTRAINT "participants_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participants" ADD CONSTRAINT "participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================================
-- PARTE MANUAL: garante que todo participante é OU um usuário cadastrado
-- (user_id) OU um convidado (guest_name) — exatamente um dos dois.
-- O "<>" (XOR) sobre os dois testes "IS NOT NULL" só passa quando há um único.
-- ============================================================================
ALTER TABLE "participants"
  ADD CONSTRAINT "participant_user_xor_guest"
  CHECK ((user_id IS NOT NULL) <> (guest_name IS NOT NULL));
