export const InvoiceJobStatus = {
  PREVIEW: "preview",
  SUCCESS: "success",
  FAILED: "failed",
  CANCELLED: "cancelled",
} as const;

export type InvoiceJobStatusType =
  (typeof InvoiceJobStatus)[keyof typeof InvoiceJobStatus];
