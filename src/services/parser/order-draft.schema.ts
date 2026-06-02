import { z } from "zod";

export const orderDraftLineSchema = z.object({
  name: z.string().min(1),
  sku: z.string().optional(),
  qty: z.number().positive(),
  unitPrice: z.number().nonnegative(),
  taxRate: z.number().nonnegative().optional(),
});

export const orderDraftSchema = z.object({
  customerName: z.string().min(1),
  orderNumber: z.string().optional(),
  orderDate: z.string().optional(),
  paymentNote: z.string().optional(),
  lines: z.array(orderDraftLineSchema).min(1),
  currency: z.literal("TRY").default("TRY"),
  subtotal: z.number().optional(),
  taxTotal: z.number().optional(),
  total: z.number().optional(),
  source: z.enum(["pdf_text", "pdf_vision", "manual"]).default("pdf_text"),
});

export type OrderDraft = z.infer<typeof orderDraftSchema>;
export type OrderDraftLine = z.infer<typeof orderDraftLineSchema>;
