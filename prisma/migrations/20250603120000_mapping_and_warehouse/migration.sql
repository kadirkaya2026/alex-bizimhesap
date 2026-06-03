-- AlterTable
ALTER TABLE "tenants" ADD COLUMN "default_warehouse_id" TEXT;

-- AlterTable
ALTER TABLE "invoice_jobs" ADD COLUMN "mapping_json" JSONB;

-- Partial unique index for SKU-based product mappings
CREATE UNIQUE INDEX "product_mappings_tenant_id_local_sku_key"
  ON "product_mappings"("tenant_id", "local_sku")
  WHERE "local_sku" IS NOT NULL;
