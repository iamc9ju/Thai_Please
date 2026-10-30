ALTER TABLE "products"
ADD COLUMN "is_recommended" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "idx_products_merchant_recommended"
ON "products" ("merchant_id", "is_recommended", "created_at");
