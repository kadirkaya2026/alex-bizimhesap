import { z } from "zod";

export const orderDraftLineSchema = z.object({
  name: z.string().min(1),
  sku: z.string().nullable().optional(),
  qty: z.number().positive(),
  unitPrice: z.number().nonnegative(),
  taxRate: z.number().nonnegative().nullable().optional(),
});

export const orderDraftSchema = z.object({
  customerName: z.string().min(1),
  taxOffice: z.string().nullable().optional(),
  taxNo: z.string().nullable().optional(),
  customerPhone: z.string().nullable().optional(),
  customerAddress: z.string().nullable().optional(),
  orderNumber: z.string().nullable().optional(),
  orderDate: z.string().nullable().optional(),
  paymentNote: z.string().nullable().optional(),
  lines: z.array(orderDraftLineSchema).min(1),
  currency: z.enum(["TRY", "USD", "EUR"]).default("TRY"),
  subtotal: z.number().nullable().optional(),
  taxTotal: z.number().nullable().optional(),
  total: z.number().nullable().optional(),
  source: z.enum(["pdf_text", "pdf_vision", "manual"]).default("pdf_text"),
});

export type OrderDraft = z.infer<typeof orderDraftSchema>;
export type OrderDraftLine = z.infer<typeof orderDraftLineSchema>;

/** Normalize OpenAI strict output (nulls) for downstream use */
export function normalizeOrderDraft(draft: OrderDraft): OrderDraft {
  return {
    ...draft,
    taxOffice: draft.taxOffice ?? undefined,
    taxNo: draft.taxNo ?? undefined,
    customerPhone: draft.customerPhone ?? undefined,
    customerAddress: draft.customerAddress ?? undefined,
    orderNumber: draft.orderNumber ?? undefined,
    orderDate: draft.orderDate ?? undefined,
    paymentNote: draft.paymentNote ?? undefined,
    lines: draft.lines.map((line) => ({
      ...line,
      sku: line.sku ?? undefined,
      taxRate: line.taxRate ?? undefined,
    })),
    subtotal: draft.subtotal ?? undefined,
    taxTotal: draft.taxTotal ?? undefined,
    total: draft.total ?? undefined,
  };
}
