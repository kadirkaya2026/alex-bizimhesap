/**
 * OpenAI Structured Outputs (strict) schema for order_draft.
 * All properties required; use null when unknown.
 */
export const ORDER_DRAFT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    customerName: { type: "string", description: "Müşteri/cari ünvanı" },
    taxOffice: {
      type: ["string", "null"],
      description: "Vergi dairesi; yoksa null",
    },
    taxNo: {
      type: ["string", "null"],
      description: "VKN veya TCKN; yoksa null",
    },
    customerPhone: { type: ["string", "null"] },
    customerAddress: { type: ["string", "null"] },
    orderNumber: { type: ["string", "null"] },
    orderDate: {
      type: ["string", "null"],
      description: "YYYY-MM-DD",
    },
    paymentNote: { type: ["string", "null"] },
    currency: { type: "string", enum: ["TRY"] },
    subtotal: { type: ["number", "null"] },
    taxTotal: { type: ["number", "null"] },
    total: { type: ["number", "null"] },
    source: { type: "string", enum: ["pdf_text", "pdf_vision", "manual"] },
    lines: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string" },
          sku: { type: ["string", "null"] },
          qty: { type: "number" },
          unitPrice: { type: "number" },
          taxRate: { type: ["number", "null"] },
        },
        required: ["name", "sku", "qty", "unitPrice", "taxRate"],
      },
    },
  },
  required: [
    "customerName",
    "taxOffice",
    "taxNo",
    "customerPhone",
    "customerAddress",
    "orderNumber",
    "orderDate",
    "paymentNote",
    "currency",
    "subtotal",
    "taxTotal",
    "total",
    "source",
    "lines",
  ],
} as const;
