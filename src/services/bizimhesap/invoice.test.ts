import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  mapDraftCurrencyToBizimhesap,
  resolveInvoiceCurrency,
} from "./currency.js";
import { buildAddInvoicePayload } from "./invoice.js";
import type { OrderDraft } from "../parser/order-draft.schema.js";

describe("mapDraftCurrencyToBizimhesap", () => {
  it("maps TRY to TL", () => {
    assert.equal(mapDraftCurrencyToBizimhesap("TRY"), "TL");
  });

  it("maps USD to USD", () => {
    assert.equal(mapDraftCurrencyToBizimhesap("USD"), "USD");
  });
});

describe("buildAddInvoicePayload", () => {
  const baseDraft: OrderDraft = {
    customerName: "Lucatech - Kaliteyi Keşfet",
    lines: [
      {
        name: "Lucatech LA-031 Ultrasonik Led Işıklı Hava Nemlendirici",
        sku: "LA-031-INVENTED",
        qty: 1,
        unitPrice: 1.55,
        taxRate: 20,
      },
    ],
    currency: "USD",
    total: 1.55,
    source: "pdf_text",
  };

  it("uses Bizimhesap product title and omits GPT sku barcode when mapped", () => {
    const payload = buildAddInvoicePayload({
      draft: baseDraft,
      firmId: "FIRM",
      defaultTaxRate: 20,
      defaultDueDays: 30,
      defaultCurrency: "TL",
      customerId: "C1",
      productMetaByLine: () => ({
        productId: "PROD-LA031",
        bizimhesapTitle: "LA-031",
      }),
      requireMappedIds: true,
    });

    assert.equal(payload.details[0]?.productId, "PROD-LA031");
    assert.equal(payload.details[0]?.productName, "LA-031");
    assert.equal(payload.details[0]?.barcode, undefined);
    assert.equal(payload.amounts.currency, "USD");
  });

  it("includes catalog barcode when provided", () => {
    const payload = buildAddInvoicePayload({
      draft: baseDraft,
      firmId: "FIRM",
      defaultTaxRate: 20,
      defaultDueDays: 30,
      defaultCurrency: "TL",
      customerId: "C1",
      productMetaByLine: () => ({
        productId: "PROD-1",
        bizimhesapTitle: "Test Ürün",
        bizimhesapBarcode: "TEST-001",
      }),
      requireMappedIds: true,
    });

    assert.equal(payload.details[0]?.barcode, "TEST-001");
  });

  it("falls back to tenant currency for TRY drafts", () => {
    const payload = buildAddInvoicePayload({
      draft: { ...baseDraft, currency: "TRY" },
      firmId: "FIRM",
      defaultTaxRate: 20,
      defaultDueDays: 30,
      defaultCurrency: "TL",
      customerId: "C1",
      productMetaByLine: () => ({
        productId: "P1",
        bizimhesapTitle: "LA-031",
      }),
      requireMappedIds: true,
    });

    assert.equal(resolveInvoiceCurrency({ ...baseDraft, currency: "TRY" }, "TL"), "TL");
    assert.equal(payload.amounts.currency, "TL");
  });

  it("throws when mapped productId has no catalog title", () => {
    assert.throws(
      () =>
        buildAddInvoicePayload({
          draft: baseDraft,
          firmId: "FIRM",
          defaultTaxRate: 20,
          defaultDueDays: 30,
          defaultCurrency: "TL",
          customerId: "C1",
          productMetaByLine: () => ({
            productId: "PROD-1",
          }),
          requireMappedIds: true,
        }),
      /katalog başlığı bulunamadı/,
    );
  });

  it("sets note field for fallback product line", () => {
    const payload = buildAddInvoicePayload({
      draft: baseDraft,
      firmId: "FIRM",
      defaultTaxRate: 20,
      defaultDueDays: 30,
      defaultCurrency: "TL",
      customerId: "C1",
      productMetaByLine: () => ({
        productId: "FALLBACK-PROD",
        bizimhesapTitle: "Tanımsız WhatsApp Ürünü",
        invoiceLineNote:
          "Lucatech LA-031 Ultrasonik Led Işıklı Hava Nemlendirici",
      }),
      requireMappedIds: true,
    });

    assert.equal(
      payload.details[0]?.note,
      "Lucatech LA-031 Ultrasonik Led Işıklı Hava Nemlendirici",
    );
    assert.equal(payload.details[0]?.productName, "Tanımsız WhatsApp Ürünü");
  });
});
