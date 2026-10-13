-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "auth_sessions" (
    "auth_session_id" BIGSERIAL NOT NULL,
    "user_id" BIGINT NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "active_role" VARCHAR(20) NOT NULL,
    "active_merchant_id" BIGINT,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),
    "last_used_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("auth_session_id")
);

-- CreateTable
CREATE TABLE "coupons" (
    "coupon_id" BIGSERIAL NOT NULL,
    "merchant_id" BIGINT,
    "coupon_name" VARCHAR(150) NOT NULL,
    "description" TEXT,
    "discount_type" VARCHAR(20) NOT NULL,
    "discount_value" DECIMAL(12,2) NOT NULL,
    "point_cost" INTEGER NOT NULL,
    "min_purchase" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "validity_days" INTEGER NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coupons_pkey" PRIMARY KEY ("coupon_id")
);

-- CreateTable
CREATE TABLE "merchants" (
    "merchant_id" BIGSERIAL NOT NULL,
    "owner_user_id" BIGINT NOT NULL,
    "merchant_name" VARCHAR(150) NOT NULL,
    "description" TEXT,
    "address" TEXT,
    "phone" VARCHAR(20),
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "merchants_pkey" PRIMARY KEY ("merchant_id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "order_item_id" BIGSERIAL NOT NULL,
    "order_id" BIGINT NOT NULL,
    "product_id" BIGINT NOT NULL,
    "category_id" BIGINT NOT NULL,
    "product_name_snapshot" VARCHAR(150) NOT NULL,
    "unit_price" DECIMAL(12,2) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "line_total" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("order_item_id")
);

-- CreateTable
CREATE TABLE "orders" (
    "order_id" BIGSERIAL NOT NULL,
    "user_id" BIGINT,
    "merchant_id" BIGINT NOT NULL,
    "wallet_id" BIGINT,
    "program_id" BIGINT,
    "user_coupon_id" BIGINT,
    "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "discount_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "final_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "subsidy_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "user_paid_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "qr_token" VARCHAR(255),
    "qr_expires_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paid_at" TIMESTAMP(6),

    CONSTRAINT "orders_pkey" PRIMARY KEY ("order_id")
);

-- CreateTable
CREATE TABLE "point_transactions" (
    "point_transaction_id" BIGSERIAL NOT NULL,
    "user_id" BIGINT NOT NULL,
    "user_quest_id" BIGINT,
    "user_coupon_id" BIGINT,
    "transaction_type" VARCHAR(30) NOT NULL,
    "points" INTEGER NOT NULL,
    "expires_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "point_transactions_pkey" PRIMARY KEY ("point_transaction_id")
);

-- CreateTable
CREATE TABLE "product_categories" (
    "category_id" BIGSERIAL NOT NULL,
    "category_name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "product_categories_pkey" PRIMARY KEY ("category_id")
);

-- CreateTable
CREATE TABLE "products" (
    "product_id" BIGSERIAL NOT NULL,
    "merchant_id" BIGINT NOT NULL,
    "category_id" BIGINT NOT NULL,
    "product_name" VARCHAR(150) NOT NULL,
    "description" TEXT,
    "price" DECIMAL(12,2) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "products_pkey" PRIMARY KEY ("product_id")
);

-- CreateTable
CREATE TABLE "quest_generation_logs" (
    "generation_id" BIGSERIAL NOT NULL,
    "user_id" BIGINT NOT NULL,
    "input_summary" JSONB NOT NULL,
    "generated_quest_id" BIGINT NOT NULL,
    "model_version" VARCHAR(100),
    "generated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "prediction_score" DECIMAL(6,5),
    "candidate_scores" JSONB,
    "selection_reason" TEXT,

    CONSTRAINT "quest_generation_logs_pkey" PRIMARY KEY ("generation_id")
);

-- CreateTable
CREATE TABLE "quests" (
    "quest_id" BIGSERIAL NOT NULL,
    "quest_name" VARCHAR(150) NOT NULL,
    "description" TEXT,
    "quest_type" VARCHAR(30) NOT NULL,
    "target_category_id" BIGINT,
    "target_product_id" BIGINT,
    "target_merchant_id" BIGINT,
    "min_spend" DECIMAL(12,2),
    "reward_point" INTEGER NOT NULL,
    "duration_days" INTEGER NOT NULL,
    "generated_by" VARCHAR(20) NOT NULL DEFAULT 'AI',
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quests_pkey" PRIMARY KEY ("quest_id")
);

-- CreateTable
CREATE TABLE "subsidy_programs" (
    "program_id" BIGSERIAL NOT NULL,
    "program_name" VARCHAR(150) NOT NULL,
    "initial_grant" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "subsidy_percentage" DECIMAL(5,2) NOT NULL,
    "user_percentage" DECIMAL(5,2) NOT NULL,
    "daily_subsidy_limit" DECIMAL(12,2) NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subsidy_programs_pkey" PRIMARY KEY ("program_id")
);

-- CreateTable
CREATE TABLE "user_coupons" (
    "user_coupon_id" BIGSERIAL NOT NULL,
    "user_id" BIGINT NOT NULL,
    "coupon_id" BIGINT NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'AVAILABLE',
    "redeemed_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(6) NOT NULL,
    "used_at" TIMESTAMP(6),
    "used_order_id" BIGINT,

    CONSTRAINT "user_coupons_pkey" PRIMARY KEY ("user_coupon_id")
);

-- CreateTable
CREATE TABLE "user_quests" (
    "user_quest_id" BIGSERIAL NOT NULL,
    "user_id" BIGINT NOT NULL,
    "quest_id" BIGINT NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    "assigned_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(6) NOT NULL,
    "completed_at" TIMESTAMP(6),
    "completed_order_id" BIGINT,

    CONSTRAINT "user_quests_pkey" PRIMARY KEY ("user_quest_id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "user_role_id" BIGSERIAL NOT NULL,
    "user_id" BIGINT NOT NULL,
    "role" VARCHAR(20) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    "created_by_admin_id" BIGINT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_role_id")
);

-- CreateTable
CREATE TABLE "users" (
    "user_id" BIGSERIAL NOT NULL,
    "citizen_id" CHAR(13) NOT NULL,
    "full_name" VARCHAR(150) NOT NULL,
    "phone" VARCHAR(20),
    "role" VARCHAR(20) NOT NULL DEFAULT 'CONSUMER',
    "point_balance" INTEGER NOT NULL DEFAULT 0,
    "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "password_hash" VARCHAR(255) NOT NULL,
    "title" VARCHAR(30),
    "first_name" VARCHAR(100),
    "last_name" VARCHAR(100),
    "date_of_birth" DATE,
    "address_line" VARCHAR(255),
    "subdistrict" VARCHAR(120),
    "district" VARCHAR(120),
    "province" VARCHAR(120),
    "postal_code" VARCHAR(10),
    "must_change_password" BOOLEAN NOT NULL DEFAULT false,
    "terms_accepted_at" TIMESTAMPTZ(3),
    "privacy_accepted_at" TIMESTAMPTZ(3),
    "last_login_at" TIMESTAMPTZ(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "wallet_transactions" (
    "wallet_transaction_id" BIGSERIAL NOT NULL,
    "wallet_id" BIGINT NOT NULL,
    "order_id" BIGINT,
    "program_id" BIGINT,
    "fund_type" VARCHAR(20) NOT NULL,
    "transaction_type" VARCHAR(30) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "balance_before" DECIMAL(12,2) NOT NULL,
    "balance_after" DECIMAL(12,2) NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" BIGINT,
    "initiated_by_user_id" BIGINT,
    "wallet_type_snapshot" VARCHAR(20) NOT NULL DEFAULT 'CONSUMER',
    "business_ref" VARCHAR(160) NOT NULL,
    "correlation_id" VARCHAR(80) NOT NULL,
    "transfer_reference" VARCHAR(160),
    "metadata" JSONB,

    CONSTRAINT "wallet_transactions_pkey" PRIMARY KEY ("wallet_transaction_id")
);

-- CreateTable
CREATE TABLE "wallets" (
    "wallet_id" BIGSERIAL NOT NULL,
    "user_id" BIGINT,
    "personal_balance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "subsidy_balance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "wallet_type" VARCHAR(20) NOT NULL DEFAULT 'CONSUMER',
    "merchant_id" BIGINT,
    "subsidy_program_id" BIGINT,
    "merchant_balance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "wallets_pkey" PRIMARY KEY ("wallet_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "auth_sessions_token_hash_key" ON "auth_sessions"("token_hash");

-- CreateIndex
CREATE INDEX "idx_auth_sessions_user_expiry" ON "auth_sessions"("user_id", "expires_at");

-- CreateIndex
CREATE INDEX "idx_order_items_order" ON "order_items"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "orders_qr_token_key" ON "orders"("qr_token");

-- CreateIndex
CREATE INDEX "idx_orders_merchant" ON "orders"("merchant_id");

-- CreateIndex
CREATE INDEX "idx_orders_user" ON "orders"("user_id");

-- CreateIndex
CREATE INDEX "idx_point_transactions_user" ON "point_transactions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_categories_category_name_key" ON "product_categories"("category_name");

-- CreateIndex
CREATE INDEX "idx_user_quests_user_status" ON "user_quests"("user_id", "status");

-- CreateIndex
CREATE INDEX "idx_user_roles_role_status" ON "user_roles"("role", "status");

-- CreateIndex
CREATE UNIQUE INDEX "user_roles_user_id_role_key" ON "user_roles"("user_id", "role");

-- CreateIndex
CREATE UNIQUE INDEX "users_citizen_id_key" ON "users"("citizen_id");

-- CreateIndex
CREATE UNIQUE INDEX "wallet_transactions_business_ref_key" ON "wallet_transactions"("business_ref");

-- CreateIndex
CREATE INDEX "idx_wallet_transactions_daily_subsidy" ON "wallet_transactions"("wallet_id", "fund_type", "transaction_type", "created_at");

-- CreateIndex
CREATE INDEX "idx_wallet_transactions_transfer_reference" ON "wallet_transactions"("transfer_reference") WHERE (transfer_reference IS NOT NULL);

-- CreateIndex
CREATE INDEX "idx_wallet_transactions_user_date" ON "wallet_transactions"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_wallet_transactions_wallet_date" ON "wallet_transactions"("wallet_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "wallet_transactions_transfer_side_key" ON "wallet_transactions"("transfer_reference", "wallet_id", "transaction_type") WHERE (transfer_reference IS NOT NULL);

-- CreateIndex
CREATE UNIQUE INDEX "wallets_user_id_key" ON "wallets"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "wallets_merchant_id_key" ON "wallets"("merchant_id");

-- AddForeignKey
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_active_merchant_id_fkey" FOREIGN KEY ("active_merchant_id") REFERENCES "merchants"("merchant_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("merchant_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "merchants" ADD CONSTRAINT "merchants_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "product_categories"("category_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("order_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("product_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("merchant_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "subsidy_programs"("program_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_coupon_id_fkey" FOREIGN KEY ("user_coupon_id") REFERENCES "user_coupons"("user_coupon_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "wallets"("wallet_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "point_transactions" ADD CONSTRAINT "point_transactions_user_coupon_id_fkey" FOREIGN KEY ("user_coupon_id") REFERENCES "user_coupons"("user_coupon_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "point_transactions" ADD CONSTRAINT "point_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "point_transactions" ADD CONSTRAINT "point_transactions_user_quest_id_fkey" FOREIGN KEY ("user_quest_id") REFERENCES "user_quests"("user_quest_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "product_categories"("category_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("merchant_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "quest_generation_logs" ADD CONSTRAINT "quest_generation_logs_generated_quest_id_fkey" FOREIGN KEY ("generated_quest_id") REFERENCES "quests"("quest_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "quest_generation_logs" ADD CONSTRAINT "quest_generation_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "quests" ADD CONSTRAINT "quests_target_category_id_fkey" FOREIGN KEY ("target_category_id") REFERENCES "product_categories"("category_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "quests" ADD CONSTRAINT "quests_target_merchant_id_fkey" FOREIGN KEY ("target_merchant_id") REFERENCES "merchants"("merchant_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "quests" ADD CONSTRAINT "quests_target_product_id_fkey" FOREIGN KEY ("target_product_id") REFERENCES "products"("product_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_coupons" ADD CONSTRAINT "fk_user_coupons_used_order" FOREIGN KEY ("used_order_id") REFERENCES "orders"("order_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_coupons" ADD CONSTRAINT "user_coupons_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "coupons"("coupon_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_coupons" ADD CONSTRAINT "user_coupons_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_quests" ADD CONSTRAINT "user_quests_completed_order_id_fkey" FOREIGN KEY ("completed_order_id") REFERENCES "orders"("order_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_quests" ADD CONSTRAINT "user_quests_quest_id_fkey" FOREIGN KEY ("quest_id") REFERENCES "quests"("quest_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_quests" ADD CONSTRAINT "user_quests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_created_by_admin_id_fkey" FOREIGN KEY ("created_by_admin_id") REFERENCES "users"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_initiated_by_user_id_fkey" FOREIGN KEY ("initiated_by_user_id") REFERENCES "users"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("order_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "subsidy_programs"("program_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "wallets"("wallet_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("merchant_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_subsidy_program_id_fkey" FOREIGN KEY ("subsidy_program_id") REFERENCES "subsidy_programs"("program_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION;
