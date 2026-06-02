-- CreateTable
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "bizimhesap_firm_id" TEXT NOT NULL,
    "bizimhesap_api_key" TEXT NOT NULL,
    "default_tax_rate" DECIMAL(5,2) NOT NULL DEFAULT 20,
    "default_due_days" INTEGER NOT NULL DEFAULT 30,
    "default_currency" TEXT NOT NULL DEFAULT 'TL',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "allowed_phones" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "phone_e164" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "allowed_phones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "phone_e164" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'idle',
    "context_json" JSONB,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_jobs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "phone_e164" TEXT NOT NULL,
    "order_number" TEXT,
    "draft_json" JSONB NOT NULL,
    "draft_hash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "bizimhesap_guid" TEXT,
    "bizimhesap_url" TEXT,
    "error_message" TEXT,
    "whatsapp_msg_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "posted_at" TIMESTAMP(3),

    CONSTRAINT "invoice_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_mappings" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "local_name" TEXT NOT NULL,
    "bizimhesap_customer_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_mappings" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "local_sku" TEXT,
    "local_name" TEXT NOT NULL,
    "bizimhesap_product_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inbound_message_logs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT,
    "phone_e164" TEXT NOT NULL,
    "message_type" TEXT NOT NULL,
    "payload_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inbound_message_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "allowed_phones_phone_e164_key" ON "allowed_phones"("phone_e164");

-- CreateIndex
CREATE INDEX "allowed_phones_tenant_id_idx" ON "allowed_phones"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "conversations_tenant_id_phone_e164_key" ON "conversations"("tenant_id", "phone_e164");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_jobs_tenant_id_order_number_key" ON "invoice_jobs"("tenant_id", "order_number");

-- CreateIndex
CREATE INDEX "invoice_jobs_tenant_id_status_idx" ON "invoice_jobs"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "customer_mappings_tenant_id_local_name_key" ON "customer_mappings"("tenant_id", "local_name");

-- CreateIndex
CREATE UNIQUE INDEX "product_mappings_tenant_id_local_name_key" ON "product_mappings"("tenant_id", "local_name");

-- CreateIndex
CREATE INDEX "inbound_message_logs_phone_e164_created_at_idx" ON "inbound_message_logs"("phone_e164", "created_at");

-- AddForeignKey
ALTER TABLE "allowed_phones" ADD CONSTRAINT "allowed_phones_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_jobs" ADD CONSTRAINT "invoice_jobs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_mappings" ADD CONSTRAINT "customer_mappings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_mappings" ADD CONSTRAINT "product_mappings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inbound_message_logs" ADD CONSTRAINT "inbound_message_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
