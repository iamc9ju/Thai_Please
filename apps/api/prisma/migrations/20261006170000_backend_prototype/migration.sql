-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('CONSUMER', 'MERCHANT', 'ADMIN');

-- CreateEnum
CREATE TYPE "WalletBucket" AS ENUM ('PERSONAL', 'SUBSIDY');

-- CreateEnum
CREATE TYPE "WalletEntryType" AS ENUM ('SUBSIDY_GRANT', 'TOPUP', 'PAYMENT');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('DRAFT', 'CHECKED_OUT', 'PAID', 'EXPIRED');

-- CreateEnum
CREATE TYPE "CouponStatus" AS ENUM ('ACTIVE', 'USED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "QuestAssignmentStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "PointEntryType" AS ENUM ('QUEST_REWARD', 'COUPON_REDEMPTION', 'EXPIRY');

-- CreateEnum
CREATE TYPE "IdempotencyStatus" AS ENUM ('COMPLETED');

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "citizen_id" VARCHAR(13) NOT NULL,
    "display_name" VARCHAR(120) NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'CONSUMER',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_sessions" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallets" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'THB',
    "personal_balance" INTEGER NOT NULL DEFAULT 0,
    "subsidy_balance" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallet_ledger_entries" (
    "id" SERIAL NOT NULL,
    "wallet_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "order_id" INTEGER,
    "bucket" "WalletBucket" NOT NULL,
    "type" "WalletEntryType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'THB',
    "business_ref" VARCHAR(160) NOT NULL,
    "correlation_id" VARCHAR(80) NOT NULL,
    "occurred_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallet_ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "merchant_categories" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "merchant_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_categories" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "product_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "merchants" (
    "id" SERIAL NOT NULL,
    "category_id" INTEGER NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "merchants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "merchant_members" (
    "id" SERIAL NOT NULL,
    "merchant_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "merchant_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" SERIAL NOT NULL,
    "merchant_id" INTEGER NOT NULL,
    "category_id" INTEGER NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "price" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'THB',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" SERIAL NOT NULL,
    "merchant_id" INTEGER NOT NULL,
    "user_id" INTEGER,
    "status" "OrderStatus" NOT NULL DEFAULT 'DRAFT',
    "currency" CHAR(3) NOT NULL DEFAULT 'THB',
    "subtotal" INTEGER NOT NULL DEFAULT 0,
    "discount" INTEGER NOT NULL DEFAULT 0,
    "final_amount" INTEGER NOT NULL DEFAULT 0,
    "subsidy_paid" INTEGER NOT NULL DEFAULT 0,
    "personal_paid" INTEGER NOT NULL DEFAULT 0,
    "user_coupon_id" INTEGER,
    "qr_token_hash" CHAR(64),
    "qr_expires_at" TIMESTAMPTZ(3),
    "checked_out_at" TIMESTAMPTZ(3),
    "paid_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" SERIAL NOT NULL,
    "order_id" INTEGER NOT NULL,
    "product_id" INTEGER NOT NULL,
    "product_name_snapshot" VARCHAR(160) NOT NULL,
    "category_id_snapshot" INTEGER NOT NULL,
    "category_name_snapshot" VARCHAR(120) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price" INTEGER NOT NULL,
    "line_total" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'THB',

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receipts" (
    "id" SERIAL NOT NULL,
    "order_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "merchant_id" INTEGER NOT NULL,
    "merchant_name_snapshot" VARCHAR(160) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "subtotal" INTEGER NOT NULL,
    "discount" INTEGER NOT NULL,
    "final_amount" INTEGER NOT NULL,
    "subsidy_paid" INTEGER NOT NULL,
    "personal_paid" INTEGER NOT NULL,
    "paid_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receipt_items" (
    "id" SERIAL NOT NULL,
    "receipt_id" INTEGER NOT NULL,
    "product_id" INTEGER NOT NULL,
    "product_name" VARCHAR(160) NOT NULL,
    "category_id" INTEGER NOT NULL,
    "category_name" VARCHAR(120) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price" INTEGER NOT NULL,
    "line_total" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL,

    CONSTRAINT "receipt_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupon_definitions" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(60) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "discount_amount" INTEGER NOT NULL,
    "points_cost" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coupon_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_coupons" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "definition_id" INTEGER NOT NULL,
    "status" "CouponStatus" NOT NULL DEFAULT 'ACTIVE',
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "redeemed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "used_at" TIMESTAMPTZ(3),
    "used_order_id" INTEGER,

    CONSTRAINT "user_coupons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quests" (
    "id" SERIAL NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "description" VARCHAR(500) NOT NULL,
    "minimum_amount" INTEGER NOT NULL,
    "category_id" INTEGER,
    "reward_points" INTEGER NOT NULL,
    "rule_version" INTEGER NOT NULL DEFAULT 1,
    "provider" VARCHAR(80) NOT NULL,
    "model_version" VARCHAR(80) NOT NULL,
    "policy_version" VARCHAR(80) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_quests" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "quest_id" INTEGER NOT NULL,
    "receipt_id" INTEGER,
    "status" "QuestAssignmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "assigned_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "completed_at" TIMESTAMPTZ(3),

    CONSTRAINT "user_quests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "point_ledger_entries" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "type" "PointEntryType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "business_ref" VARCHAR(160) NOT NULL,
    "correlation_id" VARCHAR(80) NOT NULL,
    "expires_at" TIMESTAMPTZ(3),
    "occurred_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "point_ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "point_allocations" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "source_entry_id" INTEGER NOT NULL,
    "original_amount" INTEGER NOT NULL,
    "remaining_amount" INTEGER NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "point_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_records" (
    "id" SERIAL NOT NULL,
    "scope" VARCHAR(100) NOT NULL,
    "key" VARCHAR(100) NOT NULL,
    "request_hash" CHAR(64) NOT NULL,
    "status" "IdempotencyStatus" NOT NULL DEFAULT 'COMPLETED',
    "status_code" INTEGER NOT NULL,
    "response" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idempotency_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox_events" (
    "id" SERIAL NOT NULL,
    "event_id" UUID NOT NULL,
    "type" VARCHAR(100) NOT NULL,
    "schema_version" INTEGER NOT NULL,
    "aggregate_id" VARCHAR(80) NOT NULL,
    "correlation_id" VARCHAR(80) NOT NULL,
    "payload" JSONB NOT NULL,
    "occurred_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "published_at" TIMESTAMPTZ(3),

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" SERIAL NOT NULL,
    "actor_user_id" INTEGER,
    "action" VARCHAR(100) NOT NULL,
    "target_type" VARCHAR(80) NOT NULL,
    "target_id" VARCHAR(80) NOT NULL,
    "result" VARCHAR(40) NOT NULL,
    "correlation_id" VARCHAR(80) NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_citizen_id_key" ON "users"("citizen_id");

-- CreateIndex
CREATE UNIQUE INDEX "auth_sessions_token_hash_key" ON "auth_sessions"("token_hash");

-- CreateIndex
CREATE INDEX "auth_sessions_user_id_expires_at_idx" ON "auth_sessions"("user_id", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "wallets_user_id_key" ON "wallets"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "wallet_ledger_entries_business_ref_key" ON "wallet_ledger_entries"("business_ref");

-- CreateIndex
CREATE INDEX "wallet_ledger_entries_user_id_occurred_at_id_idx" ON "wallet_ledger_entries"("user_id", "occurred_at", "id");

-- CreateIndex
CREATE INDEX "wallet_ledger_entries_order_id_idx" ON "wallet_ledger_entries"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "merchant_categories_name_key" ON "merchant_categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "product_categories_name_key" ON "product_categories"("name");

-- CreateIndex
CREATE INDEX "merchants_category_id_idx" ON "merchants"("category_id");

-- CreateIndex
CREATE INDEX "merchant_members_user_id_idx" ON "merchant_members"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "merchant_members_merchant_id_user_id_key" ON "merchant_members"("merchant_id", "user_id");

-- CreateIndex
CREATE INDEX "products_merchant_id_active_idx" ON "products"("merchant_id", "active");

-- CreateIndex
CREATE INDEX "products_category_id_idx" ON "products"("category_id");

-- CreateIndex
CREATE UNIQUE INDEX "orders_qr_token_hash_key" ON "orders"("qr_token_hash");

-- CreateIndex
CREATE INDEX "orders_merchant_id_status_created_at_idx" ON "orders"("merchant_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "orders_user_id_paid_at_idx" ON "orders"("user_id", "paid_at");

-- CreateIndex
CREATE INDEX "order_items_order_id_idx" ON "order_items"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "receipts_order_id_key" ON "receipts"("order_id");

-- CreateIndex
CREATE INDEX "receipts_user_id_paid_at_id_idx" ON "receipts"("user_id", "paid_at", "id");

-- CreateIndex
CREATE INDEX "receipts_merchant_id_paid_at_idx" ON "receipts"("merchant_id", "paid_at");

-- CreateIndex
CREATE INDEX "receipt_items_receipt_id_idx" ON "receipt_items"("receipt_id");

-- CreateIndex
CREATE UNIQUE INDEX "coupon_definitions_code_key" ON "coupon_definitions"("code");

-- CreateIndex
CREATE UNIQUE INDEX "user_coupons_used_order_id_key" ON "user_coupons"("used_order_id");

-- CreateIndex
CREATE INDEX "user_coupons_user_id_status_expires_at_idx" ON "user_coupons"("user_id", "status", "expires_at");

-- CreateIndex
CREATE INDEX "user_quests_user_id_status_expires_at_idx" ON "user_quests"("user_id", "status", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "user_quests_user_id_quest_id_key" ON "user_quests"("user_id", "quest_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_quests_id_receipt_id_key" ON "user_quests"("id", "receipt_id");

-- CreateIndex
CREATE UNIQUE INDEX "point_ledger_entries_business_ref_key" ON "point_ledger_entries"("business_ref");

-- CreateIndex
CREATE INDEX "point_ledger_entries_user_id_occurred_at_id_idx" ON "point_ledger_entries"("user_id", "occurred_at", "id");

-- CreateIndex
CREATE INDEX "point_ledger_entries_user_id_expires_at_idx" ON "point_ledger_entries"("user_id", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "point_allocations_source_entry_id_key" ON "point_allocations"("source_entry_id");

-- CreateIndex
CREATE INDEX "point_allocations_user_id_expires_at_id_idx" ON "point_allocations"("user_id", "expires_at", "id");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_records_scope_key_key" ON "idempotency_records"("scope", "key");

-- CreateIndex
CREATE UNIQUE INDEX "outbox_events_event_id_key" ON "outbox_events"("event_id");

-- CreateIndex
CREATE INDEX "outbox_events_published_at_id_idx" ON "outbox_events"("published_at", "id");

-- CreateIndex
CREATE INDEX "audit_events_actor_user_id_created_at_idx" ON "audit_events"("actor_user_id", "created_at");

-- AddForeignKey
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_ledger_entries" ADD CONSTRAINT "wallet_ledger_entries_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_ledger_entries" ADD CONSTRAINT "wallet_ledger_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_ledger_entries" ADD CONSTRAINT "wallet_ledger_entries_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchants" ADD CONSTRAINT "merchants_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "merchant_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchant_members" ADD CONSTRAINT "merchant_members_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchant_members" ADD CONSTRAINT "merchant_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "product_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_coupon_id_fkey" FOREIGN KEY ("user_coupon_id") REFERENCES "user_coupons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipt_items" ADD CONSTRAINT "receipt_items_receipt_id_fkey" FOREIGN KEY ("receipt_id") REFERENCES "receipts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_coupons" ADD CONSTRAINT "user_coupons_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_coupons" ADD CONSTRAINT "user_coupons_definition_id_fkey" FOREIGN KEY ("definition_id") REFERENCES "coupon_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_coupons" ADD CONSTRAINT "user_coupons_used_order_id_fkey" FOREIGN KEY ("used_order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_quests" ADD CONSTRAINT "user_quests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_quests" ADD CONSTRAINT "user_quests_quest_id_fkey" FOREIGN KEY ("quest_id") REFERENCES "quests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_quests" ADD CONSTRAINT "user_quests_receipt_id_fkey" FOREIGN KEY ("receipt_id") REFERENCES "receipts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "point_ledger_entries" ADD CONSTRAINT "point_ledger_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "point_allocations" ADD CONSTRAINT "point_allocations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "point_allocations" ADD CONSTRAINT "point_allocations_source_entry_id_fkey" FOREIGN KEY ("source_entry_id") REFERENCES "point_ledger_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Application invariants that Prisma cannot currently express in its schema DSL.
ALTER TABLE "users" ADD CONSTRAINT "users_citizen_id_format_check" CHECK ("citizen_id" ~ '^[0-9]{13}$');
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_non_negative_check" CHECK ("personal_balance" >= 0 AND "subsidy_balance" >= 0);
ALTER TABLE "wallet_ledger_entries" ADD CONSTRAINT "wallet_ledger_non_zero_check" CHECK ("amount" <> 0);
ALTER TABLE "products" ADD CONSTRAINT "products_price_check" CHECK ("price" >= 0);
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_values_check" CHECK ("quantity" > 0 AND "unit_price" >= 0 AND "line_total" = "quantity" * "unit_price");
ALTER TABLE "orders" ADD CONSTRAINT "orders_amounts_check" CHECK ("subtotal" >= 0 AND "discount" >= 0 AND "final_amount" = "subtotal" - "discount" AND "final_amount" >= 0 AND "subsidy_paid" >= 0 AND "personal_paid" >= 0);
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_amounts_check" CHECK ("subtotal" >= 0 AND "discount" >= 0 AND "final_amount" = "subtotal" - "discount" AND "final_amount" >= 0 AND "subsidy_paid" >= 0 AND "personal_paid" >= 0 AND "final_amount" = "subsidy_paid" + "personal_paid");
ALTER TABLE "receipt_items" ADD CONSTRAINT "receipt_items_values_check" CHECK ("quantity" > 0 AND "unit_price" >= 0 AND "line_total" = "quantity" * "unit_price");
ALTER TABLE "coupon_definitions" ADD CONSTRAINT "coupon_definition_values_check" CHECK ("discount_amount" > 0 AND "points_cost" > 0);
ALTER TABLE "quests" ADD CONSTRAINT "quest_values_check" CHECK ("minimum_amount" > 0 AND "reward_points" > 0);
ALTER TABLE "point_ledger_entries" ADD CONSTRAINT "point_ledger_non_zero_check" CHECK ("amount" <> 0);
ALTER TABLE "point_allocations" ADD CONSTRAINT "point_allocation_values_check" CHECK ("original_amount" > 0 AND "remaining_amount" >= 0 AND "remaining_amount" <= "original_amount");

CREATE FUNCTION prevent_immutable_fact_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'immutable fact cannot be modified';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER wallet_ledger_immutable BEFORE UPDATE OR DELETE ON "wallet_ledger_entries" FOR EACH ROW EXECUTE FUNCTION prevent_immutable_fact_mutation();
CREATE TRIGGER point_ledger_immutable BEFORE UPDATE OR DELETE ON "point_ledger_entries" FOR EACH ROW EXECUTE FUNCTION prevent_immutable_fact_mutation();
CREATE TRIGGER receipt_immutable BEFORE UPDATE OR DELETE ON "receipts" FOR EACH ROW EXECUTE FUNCTION prevent_immutable_fact_mutation();
CREATE TRIGGER receipt_items_immutable BEFORE UPDATE OR DELETE ON "receipt_items" FOR EACH ROW EXECUTE FUNCTION prevent_immutable_fact_mutation();

CREATE FUNCTION prevent_paid_order_mutation() RETURNS trigger AS $$
BEGIN
  IF OLD.status = 'PAID' THEN
    RAISE EXCEPTION 'paid order cannot be modified';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER paid_order_immutable BEFORE UPDATE OR DELETE ON "orders" FOR EACH ROW EXECUTE FUNCTION prevent_paid_order_mutation();
