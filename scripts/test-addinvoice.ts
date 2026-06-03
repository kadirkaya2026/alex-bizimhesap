/**
 * Manuel Bizimhesap addinvoice smoke test.
 * Kullanım: BIZIMHESAP_FIRM_ID ve BIZIMHESAP_API_KEY .env içinde olmalı.
 */
import "dotenv/config";

import { buildAddInvoicePayload, postAddInvoice } from "../src/services/bizimhesap/invoice.js";
import type { OrderDraft } from "../src/services/parser/order-draft.schema.js";

const firmId = process.env.BIZIMHESAP_FIRM_ID?.trim();
const apiKey = process.env.BIZIMHESAP_API_KEY?.trim();

if (!firmId || !apiKey) {
  console.error("BIZIMHESAP_FIRM_ID ve BIZIMHESAP_API_KEY .env dosyasında gerekli.");
  process.exit(1);
}

if (firmId === "REPLACE_FIRM_ID") {
  console.error("BIZIMHESAP_FIRM_ID hâlâ REPLACE_FIRM_ID — .env doldurun.");
  process.exit(1);
}

const draft: OrderDraft = {
  customerName: "Test Müşteri Ltd.",
  orderNumber: `test_${Date.now()}`,
  orderDate: new Date().toISOString().slice(0, 10),
  paymentNote: "Test fatura - silinebilir",
  lines: [
    {
      name: "Test Ürün",
      sku: "TEST-001",
      qty: 1,
      unitPrice: 100,
      taxRate: 20,
    },
  ],
  currency: "TRY",
  source: "manual",
};

const payload = buildAddInvoicePayload({
  draft,
  firmId,
  defaultTaxRate: Number(process.env.DEFAULT_TAX_RATE ?? 20),
  defaultDueDays: Number(process.env.DEFAULT_DUE_DAYS ?? 30),
  defaultCurrency: process.env.DEFAULT_CURRENCY ?? "TL",
});

console.log("Payload:", JSON.stringify(payload, null, 2));

const result = await postAddInvoice(payload);

console.log("Sonuç:", result);

if (result.error) {
  process.exit(1);
}
