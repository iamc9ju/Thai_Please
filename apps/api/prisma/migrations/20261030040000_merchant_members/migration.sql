-- CreateTable
CREATE TABLE IF NOT EXISTS "merchant_members" (
    "merchant_member_id" BIGSERIAL NOT NULL,
    "merchant_id" BIGINT NOT NULL,
    "user_id" BIGINT NOT NULL,
    "role" VARCHAR(20) NOT NULL DEFAULT 'STAFF',
    "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "merchant_members_pkey" PRIMARY KEY ("merchant_member_id"),
    CONSTRAINT "uq_merchant_members_merchant_user" UNIQUE ("merchant_id", "user_id"),
    CONSTRAINT "merchant_members_role_check" CHECK ("role" IN ('OWNER', 'STAFF')),
    CONSTRAINT "merchant_members_status_check" CHECK ("status" IN ('ACTIVE', 'SUSPENDED', 'REMOVED')),
    CONSTRAINT "fk_merchant_members_merchant" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("merchant_id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "fk_merchant_members_user" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE NO ACTION
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_merchant_members_user" ON "merchant_members"("user_id");
CREATE INDEX IF NOT EXISTS "idx_merchant_members_merchant_status" ON "merchant_members"("merchant_id", "status");

-- Backfill existing merchants with their owner as OWNER member
INSERT INTO "merchant_members" ("merchant_id", "user_id", "role", "status", "created_at", "updated_at")
SELECT "merchant_id", "owner_user_id", 'OWNER', 'ACTIVE', "created_at", CURRENT_TIMESTAMP
FROM "merchants"
ON CONFLICT ("merchant_id", "user_id") DO NOTHING;
